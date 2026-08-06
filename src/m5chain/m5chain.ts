import createM5ChainDevice from "createM5ChainDevice";
import { normalizeDeviceClasses } from "deviceRegistry";
import Serial from "embedded:io/serial";
import config from "mc/config";
import Modules from "modules";
import Timer from "timer";
import type {
	DeviceListChangeHandler,
	M5ChainDeviceClass,
	M5ChainErrorContext,
	M5ChainErrorHandler,
	PacketBuffer,
	PacketMatch,
	RegisteredM5ChainDevice,
	WaitForPacketOptions,
	WaitForPacketResult,
} from "types";

export type {
	LedColor,
	M5ChainDeviceClass,
	M5ChainDeviceLike,
	M5ChainErrorContext,
	M5ChainErrorHandler,
	M5ChainErrorSource,
	M5ChainUnknownDeviceLike,
	RegisteredM5ChainDevice,
} from "types";

export type M5ChainOptions<TClasses extends readonly M5ChainDeviceClass[]> = {
	deviceClasses: TClasses;
	transmit?: number;
	receive?: number;
	debug?: boolean;
	pollingInterval?: number;
	connectionCheckInterval?: number;
};

declare const device: {
	I2C: {
		default: {
			data: number;
			clock: number;
		};
	};
};

// biome-ignore lint/suspicious/noExplicitAny: Match the type definition of mc/config
type ConfigRecord = Record<string, any>;
type connectionConfig = {
	transmit: number;
	receive: number;
};

type QueuedRequest = {
	id: number;
	cmd: number;
	data: Uint8Array;
	size: number;
	timeoutMs: number;
	match: PacketMatch | null;
	rejectFailures: boolean;
	resolve: (result: WaitForPacketResult) => void;
	reject: (reason?: unknown) => void;
};

function loadConnectionConfig(): connectionConfig {
	const modConfig: ConfigRecord | undefined = Modules.has("mod/config")
		? (Modules.importNow("mod/config") as ConfigRecord)
		: undefined;
	if (modConfig && typeof modConfig === "object") {
		return {
			transmit: modConfig.m5chain.transmit,
			receive: modConfig.m5chain.receive,
		};
	} else if (config && typeof config === "object") {
		return {
			transmit: config.m5chain.transmit,
			receive: config.m5chain.receive,
		};
	}

	return {
		transmit: device.I2C.default.data,
		receive: device.I2C.default.clock,
	};
}

export default class M5Chain<TClasses extends readonly M5ChainDeviceClass[]> {
	static CMD = Object.freeze({
		GET_DEVICE_TYPE: 0xfb /**< Get device type. */,
		ENUM_PLEASE: 0xfc /**< Enumeration request. */,
		HEARTBEAT: 0xfd /**< Heartbeat packet. */,
		ENUM: 0xfe /**< Enumeration response. */,
		RESET: 0xff /**< Reset command. */,
	} as const);

	onDeviceListChanged?: DeviceListChangeHandler<RegisteredM5ChainDevice<TClasses>>;
	onError?: M5ChainErrorHandler;
	debug: boolean;
	pollingInterval: number;
	connectionCheckInterval: number;
	running = false;
	readonly maxPayloadSize: number;

	#serial;
	cmdBuffer = new Uint8Array(256);
	#enumBuffer = new Uint8Array(1);
	#sendBuffer = new Uint8Array(256);
	#receiveResolve: ((result: WaitForPacketResult) => void) | null = null;
	#receiveReject: ((reason?: unknown) => void) | null = null;
	#receiveTimeoutId: ReturnType<typeof Timer.set> | null = null;
	#rejectRequestFailures = false;
	#requestQueue: QueuedRequest[] | null = null;
	#enumPending = false;
	#enumTimer: ReturnType<typeof Timer.set> | null = null;
	#enumRunning = false;
	#receiveMatch: PacketMatch | null = null;
	#pollFailureCounts: number[] = [];
	#pollRequested = false;
	#pollRunning = false;
	#pollTask: Promise<void> | null = null;
	#pollDelayTimer: ReturnType<typeof Timer.set> | null = null;
	#pollDelayResolve: (() => void) | null = null;
	#connectionFailureCount = 0;
	#connectionCheckTimer: ReturnType<typeof Timer.set> | null = null;
	#connectionCheckRunning = false;
	#sendCmd: number | null = null;
	#sendId: number | null = null;
	#rxBuffer = new Uint8Array(512);
	#rxLength = 0;
	#deviceList: RegisteredM5ChainDevice<TClasses>[] = [];
	readonly #deviceClasses: TClasses;
	#started = false;
	#closed = false;

	constructor(options: M5ChainOptions<TClasses>) {
		const self = this;
		if (!options || typeof options !== "object" || Array.isArray(options)) {
			throw new TypeError("options must be an object.");
		}
		this.#deviceClasses = normalizeDeviceClasses(options.deviceClasses) as TClasses;
		this.maxPayloadSize = this.#sendBuffer.length - 9;
		this.debug = !!options?.debug;
		this.pollingInterval = options.pollingInterval ?? 30;
		this.connectionCheckInterval = options.connectionCheckInterval ?? 1000;
		if (!Number.isFinite(this.pollingInterval) || this.pollingInterval < 0) {
			throw new RangeError("pollingInterval must be a non-negative number.");
		}
		if (!Number.isFinite(this.connectionCheckInterval) || this.connectionCheckInterval < 0) {
			throw new RangeError("connectionCheckInterval must be a non-negative number.");
		}
		let connectionConfig: connectionConfig;
		if (options.transmit !== undefined && options.receive !== undefined) {
			connectionConfig = { transmit: options.transmit, receive: options.receive };
		} else {
			connectionConfig = loadConnectionConfig();
			connectionConfig.transmit = options.transmit ?? connectionConfig.transmit;
			connectionConfig.receive = options.receive ?? connectionConfig.receive;
		}
		this.#serial = new Serial({
			transmit: connectionConfig.transmit,
			receive: connectionConfig.receive,
			baud: 115200,
			format: "buffer",
			port: 1,
			onReadable: function (this: Serial, bytesReadable: number) {
				const readResult = this.read(bytesReadable);
				if (!(readResult instanceof ArrayBuffer)) return;
				const chunk = new Uint8Array(readResult);
				if (chunk.length === 0) return;

				// Append to rx buffer (grow if needed)
				if (self.#rxLength + chunk.length > self.#rxBuffer.length) {
					const next = new Uint8Array(Math.max(self.#rxBuffer.length * 2, self.#rxLength + chunk.length));
					next.set(self.#rxBuffer.subarray(0, self.#rxLength));
					self.#rxBuffer = next;
				}
				self.#rxBuffer.set(chunk, self.#rxLength);
				self.#rxLength += chunk.length;

				// Parse as many complete frames as possible
				while (self.#rxLength >= 9) {
					// Seek header 0xAA 0x55
					if (self.#rxBuffer[0] !== 0xaa || self.#rxBuffer[1] !== 0x55) {
						let idx = 1;
						for (; idx + 1 < self.#rxLength; idx++) {
							if (self.#rxBuffer[idx] === 0xaa && self.#rxBuffer[idx + 1] === 0x55) break;
						}
						// Drop bytes before the next possible header
						self.#rxBuffer.copyWithin(0, idx, self.#rxLength);
						self.#rxLength -= idx;
						if (self.#rxLength < 9) break;
					}

					const length = (self.#rxBuffer[2] & 0xff) | ((self.#rxBuffer[3] & 0xff) << 8);
					const packetSize = 4 + length + 2;

					// Sanity check: header(2)+len(2)+payload+footer(2). Length includes id/cmd/data/crc.
					if (packetSize < 9 || packetSize > 300) {
						// Corrupted length; drop one byte and retry
						self.#rxBuffer.copyWithin(0, 1, self.#rxLength);
						self.#rxLength -= 1;
						continue;
					}

					if (self.#rxLength < packetSize) {
						// Wait for more bytes
						break;
					}

					// Footer check
					if (self.#rxBuffer[packetSize - 2] !== 0x55 || self.#rxBuffer[packetSize - 1] !== 0xaa) {
						// Not a valid frame; drop one byte and retry
						self.#rxBuffer.copyWithin(0, 1, self.#rxLength);
						self.#rxLength -= 1;
						continue;
					}

					const frame = self.#rxBuffer.slice(0, packetSize);
					// Consume this frame
					self.#rxBuffer.copyWithin(0, packetSize, self.#rxLength);
					self.#rxLength -= packetSize;

					if (self.debug) {
						self.#log("RX Packet =>");
						self.#dumpPacket(frame, packetSize);
					}

					const crc8 = self.#calculateCRC(frame, packetSize);
					if (crc8 !== frame[packetSize - 3]) {
						self.#log("crc8 error");
						continue;
					}

					const packetId = frame[4];
					const packetCmd = frame[5];

					const shouldResolve =
						!!self.#receiveResolve &&
						packetId === self.#sendId &&
						packetCmd === self.#sendCmd &&
						(!self.#receiveMatch || self.#receiveMatch(frame, packetSize));

					if (shouldResolve) {
						self.#completeRequest(frame);
						continue;
					}

					if (packetCmd === 0xe0) {
						const device = self.#deviceList.find((candidate) => candidate.id === packetId);
						if (device) {
							self.#invokeUserCallback(() => device.onDispatchEvent?.(frame), {
								source: "deviceEvent",
								device,
							});
						} else {
							self.#log(`Unknown device ID: ${packetId}`);
						}
					} else if (packetCmd === M5Chain.CMD.ENUM_PLEASE) {
						self.#scheduleEnum();
					} else {
						// Late or unmatched response (e.g., response arrived after wait cleared).
						// Silently ignore unless debug is enabled.
						if (self.debug) {
							self.#log(
								`Late or unmatched response: id=${packetId}, cmd=0x${packetCmd
									.toString(16)
									.toUpperCase()
									.padStart(2, "0")}`,
							);
						}
					}
				}
			},
		});
	}
	#log(message: string, level = "INFO") {
		trace(`[m5chain][${level}] ${message}\n`);
	}
	#reportUserCallbackError(error: unknown, context: M5ChainErrorContext) {
		if (this.onError) {
			try {
				const result = this.onError(error, context);
				if (result && typeof (result as PromiseLike<void>).then === "function") {
					void Promise.resolve(result).catch((onErrorFailure: unknown) => {
						const message = onErrorFailure instanceof Error ? onErrorFailure.message : String(onErrorFailure);
						this.#log(`onError callback failed: ${message}`, "WARN");
					});
				}
				return;
			} catch (onErrorFailure: unknown) {
				const message = onErrorFailure instanceof Error ? onErrorFailure.message : String(onErrorFailure);
				this.#log(`onError callback failed: ${message}`, "WARN");
			}
		}

		const message = error instanceof Error ? error.message : String(error);
		this.#log(`${context.source} callback failed: ${message}`, "WARN");
	}
	#invokeUserCallback(callback: () => unknown, context: M5ChainErrorContext) {
		try {
			const result = callback();
			if (result && typeof (result as PromiseLike<unknown>).then === "function") {
				void Promise.resolve(result).catch((error: unknown) => {
					this.#reportUserCallbackError(error, context);
				});
			}
		} catch (error: unknown) {
			this.#reportUserCallbackError(error, context);
		}
	}
	#dumpPacket(buffer: Uint8Array, size: number) {
		let line = `Packet dump(${size} bytes):`;
		for (let i = 0; i < size; i++) {
			line += ` 0x${buffer[i].toString(16).toUpperCase().padStart(2, "0")}`;
		}
		trace(`[m5chain] ${line}\n`);
	}

	#calculateCRC(buffer: Uint8Array, size: number) {
		let crc8 = 0;
		for (let i = 4; i < size - 3; i++) {
			crc8 = (crc8 + buffer[i]) & 0xff;
		}
		return crc8;
	}

	sendPacket(id: number, cmd: number, data: Uint8Array, size: number) {
		if (this.#closed) {
			throw new Error("M5Chain is closed.");
		}
		if (!Number.isInteger(size) || size < 0 || size > this.maxPayloadSize) {
			throw new RangeError(`packet data size must be between 0 and ${this.maxPayloadSize} bytes.`);
		}
		if (data.length < size) {
			throw new RangeError(`packet data contains ${data.length} bytes, but ${size} bytes were requested.`);
		}

		const cmdSize = size + 3;
		const sendBufferSize = size + 9;

		const sendBuffer = this.#sendBuffer;
		sendBuffer[0] = 0xaa;
		sendBuffer[1] = 0x55;
		sendBuffer[2] = cmdSize & 0xff;
		sendBuffer[3] = (cmdSize >> 8) & 0xff;
		sendBuffer[4] = id;
		sendBuffer[5] = cmd;

		sendBuffer.set(data.subarray(0, size), 6);
		const crc8 = this.#calculateCRC(sendBuffer, sendBufferSize);
		sendBuffer[sendBufferSize - 3] = crc8;
		sendBuffer[sendBufferSize - 2] = 0x55;
		sendBuffer[sendBufferSize - 1] = 0xaa;

		if (this.debug) {
			this.#log("TX Packet =>");
			this.#dumpPacket(sendBuffer, sendBufferSize);
		}

		this.#serial.write(sendBuffer.subarray(0, sendBufferSize));
	}

	#clearPendingRequest() {
		if (this.#receiveTimeoutId) {
			Timer.clear(this.#receiveTimeoutId);
			this.#receiveTimeoutId = null;
		}
		this.#receiveResolve = null;
		this.#receiveReject = null;
		this.#receiveMatch = null;
		this.#rejectRequestFailures = false;
		this.#sendCmd = null;
		this.#sendId = null;
	}

	#completeRequest(result: WaitForPacketResult, error?: unknown) {
		const resolve = this.#receiveResolve;
		const reject = this.#receiveReject;
		const rejectFailures = this.#rejectRequestFailures;
		this.#clearPendingRequest();

		if (error !== undefined) {
			reject?.(error);
		} else if (rejectFailures && !(result instanceof Uint8Array)) {
			if (result.__m5chain === "timeout") {
				reject?.(
					new Error(
						`waitForPacket timeout (id=${result.id}, cmd=0x${result.cmd.toString(16).toUpperCase().padStart(2, "0")})`,
					),
				);
			} else {
				reject?.(new Error(`waitForPacket aborted (${result.reason})`));
			}
		} else {
			resolve?.(result);
		}

		const request = this.#requestQueue?.shift();
		if (!request) {
			this.#requestQueue = null;
			return;
		}
		if (this.#requestQueue?.length === 0) {
			this.#requestQueue = null;
		}
		this.#startRequest(
			request.id,
			request.cmd,
			request.data,
			request.size,
			request.timeoutMs,
			request.match,
			request.rejectFailures,
			request.resolve,
			request.reject,
		);
	}

	#startRequest(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		timeoutMs: number,
		match: PacketMatch | null,
		rejectFailures: boolean,
		resolve: (result: WaitForPacketResult) => void,
		reject: (reason?: unknown) => void,
	) {
		this.#sendId = id;
		this.#sendCmd = cmd;
		this.#receiveMatch = match;
		this.#rejectRequestFailures = rejectFailures;
		this.#receiveResolve = resolve;
		this.#receiveReject = reject;

		if (timeoutMs > 0) {
			this.#receiveTimeoutId = Timer.set(() => {
				if (!this.#receiveResolve) return;
				this.#completeRequest({
					__m5chain: "timeout",
					id: this.#sendId ?? "?",
					cmd: this.#sendCmd ?? 0,
				});
			}, timeoutMs);
		}

		try {
			this.sendPacket(id, cmd, data, size);
		} catch (error: unknown) {
			this.#completeRequest({ __m5chain: "abort", reason: "send failed" }, error);
		}
	}

	#abortRequests(reason: string) {
		const result = { __m5chain: "abort", reason } as const;
		const resolve = this.#receiveResolve;
		const reject = this.#receiveReject;
		const rejectFailures = this.#rejectRequestFailures;
		this.#clearPendingRequest();
		if (rejectFailures) {
			reject?.(new Error(`waitForPacket aborted (${reason})`));
		} else {
			resolve?.(result);
		}

		const queue = this.#requestQueue;
		this.#requestQueue = null;
		if (!queue) return;
		for (const request of queue) {
			if (request.rejectFailures) {
				request.reject(new Error(`waitForPacket aborted (${reason})`));
			} else {
				request.resolve(result);
			}
		}
	}

	#scheduleEnum() {
		if (this.#enumPending) return;

		this.#enumPending = true;

		if (this.#enumTimer) {
			Timer.clear(this.#enumTimer);
		}

		this.#enumTimer = Timer.set(() => {
			this.#enumPending = false;
			this.#enumTimer = null;
			void this.#handleEnumPlease();
		}, 500);
	}

	sendAndWaitForResult(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options: WaitForPacketOptions | undefined = undefined,
	): Promise<WaitForPacketResult> {
		return this.#enqueueRequest(id, cmd, data, size, options?.timeoutMs ?? 800, options?.match ?? null, false);
	}

	#enqueueRequest(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		timeoutMs: number,
		match: PacketMatch | null,
		rejectFailures: boolean,
	): Promise<WaitForPacketResult> {
		if (!Number.isInteger(size) || size < 0 || size > this.maxPayloadSize) {
			return Promise.reject(new RangeError(`packet data size must be between 0 and ${this.maxPayloadSize} bytes.`));
		}
		if (data.length < size) {
			return Promise.reject(
				new RangeError(`packet data contains ${data.length} bytes, but ${size} bytes were requested.`),
			);
		}

		return new Promise((resolve, reject) => {
			if (!this.#receiveResolve) {
				this.#startRequest(id, cmd, data, size, timeoutMs, match, rejectFailures, resolve, reject);
				return;
			}

			const queuedData = new Uint8Array(size);
			if (size > 0) {
				queuedData.set(data.subarray(0, size));
			}
			const request: QueuedRequest = {
				id,
				cmd,
				data: queuedData,
				size,
				timeoutMs,
				match,
				rejectFailures,
				resolve,
				reject,
			};
			if (this.#requestQueue) {
				this.#requestQueue.push(request);
			} else {
				this.#requestQueue = [request];
			}
		});
	}

	sendAndWait(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options: WaitForPacketOptions | undefined = undefined,
	): Promise<PacketBuffer> {
		return this.#enqueueRequest(
			id,
			cmd,
			data,
			size,
			options?.timeoutMs ?? 800,
			options?.match ?? null,
			true,
		) as Promise<PacketBuffer>;
	}

	#handlePollingFailure(device: RegisteredM5ChainDevice<TClasses>, error?: unknown) {
		const failureCount = (this.#pollFailureCounts[device.id] ?? 0) + 1;
		this.#pollFailureCounts[device.id] = failureCount;
		const detail = error === undefined ? "" : `: ${error instanceof Error ? error.message : String(error)}`;
		this.#log(`polling failed for device id=${device.id} (count=${failureCount})${detail}`, "WARN");

		if (failureCount >= 3) {
			this.#log(`Device id=${device.id} considered disconnected`, "WARN");
			this.#pollFailureCounts[device.id] = 0;
			this.#deviceList = this.#deviceList.filter((candidate) => candidate !== device);
			device._markDisconnected?.();
			this.#invokeUserCallback(() => device.onDisconnected?.(), {
				source: "deviceDisconnected",
				device,
			});
			this.#notifyDeviceListChanged();
			this.#updatePollingState();
			this.#updateConnectionMonitoringState();
			return true;
		}
		return false;
	}

	async start() {
		if (this.#closed) {
			throw new Error("M5Chain is closed.");
		}
		if (this.#started) return;
		this.#started = true;

		await this.#scan();
		if (!this.#started) return;
		this.#notifyDeviceListChanged();
		this.#updatePollingState();
		this.#updateConnectionMonitoringState();
	}

	async stop() {
		if (!this.#started && !this.#pollTask && this.#deviceList.length === 0) return;

		this.#started = false;
		this.#stopPolling();
		this.#stopConnectionMonitoring();
		this.#abortRequests("M5Chain stopped");

		const pollTask = this.#pollTask;
		if (pollTask) {
			try {
				await pollTask;
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				this.#log(`poll loop stopped with an error: ${message}`, "WARN");
			}
		}

		if (this.#enumTimer) {
			Timer.clear(this.#enumTimer);
			this.#enumTimer = null;
		}
		this.#enumPending = false;

		const oldDevices = [...this.#deviceList];
		this.#deviceList = [];
		this.#pollFailureCounts.length = 0;
		for (const device of oldDevices) {
			device._markDisconnected?.();
			this.#invokeUserCallback(() => device.onDisconnected?.(), {
				source: "deviceDisconnected",
				device,
			});
		}
		this.#notifyDeviceListChanged();
	}

	async close() {
		if (this.#closed) return;
		this.#closed = true;
		await this.stop();
		this.#serial.close();
		this.#rxLength = 0;
	}

	get closed(): boolean {
		return this.#closed;
	}

	async #pollLoop() {
		try {
			while (this.#pollRequested) {
				await this.#pollDevices();
				if (this.#pollRequested) {
					await this.#waitForNextPoll();
				}
			}
		} finally {
			this.running = false;
			this.#pollTask = null;
			this.#pollRunning = false;
			if (this.#hasActiveSampleHandler()) {
				this.#startPolling();
			}
		}
	}

	#waitForNextPoll() {
		return new Promise<void>((resolve) => {
			this.#pollDelayResolve = resolve;
			this.#pollDelayTimer = Timer.set(() => {
				this.#pollDelayTimer = null;
				this.#pollDelayResolve = null;
				resolve();
			}, this.pollingInterval);
		});
	}

	#cancelPollDelay() {
		if (!this.#pollDelayResolve) return;

		Timer.clear(this.#pollDelayTimer);
		this.#pollDelayTimer = null;
		const resolve = this.#pollDelayResolve;
		this.#pollDelayResolve = null;
		resolve();
	}

	async #pollDevices() {
		for (const device of this.#deviceList) {
			if (!device?.hasOnSample?.() || typeof device.readSample !== "function") {
				continue;
			}

			try {
				const value = await device.readSample();
				this.#pollFailureCounts[device.id] = 0;

				if (value !== undefined) {
					this.#invokeUserCallback(() => device.dispatchOnSample?.(value), {
						source: "sample",
						device,
					});
				}
			} catch (error: unknown) {
				if (this.#handlePollingFailure(device, error)) return;
			}
		}
	}

	// internal (not for app)
	_notifyPollingStateChanged() {
		this.#updatePollingState();
	}
	#hasActiveSampleHandler() {
		return this.#deviceList.some((d) => typeof d?.hasOnSample === "function" && d.hasOnSample());
	}
	#startPolling() {
		if (!this.#started || this.#closed) return;
		this.#pollRequested = true;
		if (this.#pollRunning) return;

		this.#pollRunning = true;
		this.running = true;
		this.#pollTask = this.#pollLoop();
	}
	#stopPolling() {
		this.#pollRequested = false;
		this.running = false;
		this.#cancelPollDelay();
	}
	#updatePollingState() {
		if (this.#hasActiveSampleHandler()) {
			this.#startPolling();
		} else {
			this.#stopPolling();
		}
	}

	#scheduleConnectionCheck() {
		if (
			!this.#started ||
			this.#closed ||
			this.connectionCheckInterval === 0 ||
			this.#connectionCheckTimer ||
			this.#connectionCheckRunning
		) {
			return;
		}

		this.#connectionCheckTimer = Timer.set(() => {
			this.#connectionCheckTimer = null;
			void this.#checkConnections();
		}, this.connectionCheckInterval);
	}

	#stopConnectionMonitoring() {
		if (this.#connectionCheckTimer) {
			Timer.clear(this.#connectionCheckTimer);
			this.#connectionCheckTimer = null;
		}
		this.#connectionFailureCount = 0;
	}

	#updateConnectionMonitoringState() {
		if (this.#started && !this.#closed && this.connectionCheckInterval > 0) {
			this.#scheduleConnectionCheck();
		} else {
			this.#stopConnectionMonitoring();
		}
	}

	async #checkConnections() {
		if (this.#connectionCheckRunning) return;
		this.#connectionCheckRunning = true;

		try {
			if (!this.#started || this.#closed || this.#enumRunning) return;

			try {
				if (this.#deviceList.length === 0) {
					const connected = await this.isDeviceConnected();
					if (!this.#started || this.#closed) return;
					this.#connectionFailureCount = 0;
					if (connected) {
						await this.#handleEnumPlease();
					}
					return;
				}

				const packet = (await this.#enqueueRequest(
					0xff,
					M5Chain.CMD.ENUM,
					this.#enumBuffer,
					1,
					300,
					null,
					true,
				)) as PacketBuffer;
				const deviceCount = packet[6];
				if (!this.#started || this.#closed) return;
				this.#connectionFailureCount = 0;
				if (this.#deviceList.length !== deviceCount) {
					await this.#handleEnumPlease();
				}
			} catch (error: unknown) {
				if (!this.#started || this.#closed) return;
				const message = error instanceof Error ? error.message : String(error);
				this.#log(`connection check failed: ${message}`, "WARN");
				this.#connectionFailureCount += 1;
				if (this.#connectionFailureCount >= 3) {
					this.#connectionFailureCount = 0;
					await this.#handleEnumPlease();
				}
			}
		} finally {
			this.#connectionCheckRunning = false;
			this.#updateConnectionMonitoringState();
		}
	}

	async getDeviceType(id: number): Promise<number> {
		const packet = await this.sendAndWait(id, M5Chain.CMD.GET_DEVICE_TYPE, this.cmdBuffer, 0);
		const deviceType = (packet[7] << 8) | packet[6];
		return deviceType;
	}

	getDeviceNum(options: WaitForPacketOptions | undefined = undefined): Promise<number> {
		return this.sendAndWait(0xff, M5Chain.CMD.ENUM, this.#enumBuffer, 1, options).then((packet) => packet[6]);
	}

	isDeviceConnected(): Promise<boolean> {
		const id = 0xff;
		const cmd = M5Chain.CMD.HEARTBEAT;
		return this.#enqueueRequest(id, cmd, this.cmdBuffer, 0, 300, null, false).then(
			(result) => result instanceof Uint8Array,
		);
	}

	async #scan() {
		this.#log("scan start");
		this.#deviceList = [];
		this.#pollFailureCounts.length = 0;
		try {
			if (await this.isDeviceConnected()) {
				const deviceNum = await this.getDeviceNum();
				const deviceList = await this.getDeviceList(deviceNum);
				for (let i = 0; i < deviceList.length; i++) {
					const device = createM5ChainDevice(this.#deviceClasses, this, {
						id: i + 1,
						type: deviceList[i],
					});
					try {
						await device.init();
						this.#deviceList.push(device);
						this.#log(
							`found ${device.known ? "known" : "unknown"} device id=${device.id ?? "?"}, type=0x${(device.type ?? 0).toString(16).toUpperCase()} uuid=${device.uuid}`,
						);
					} catch (error: unknown) {
						const message = error instanceof Error ? error.message : String(error);
						this.#log(`device initialization failed for id=${device.id}: ${message}`, "WARN");
					}
				}
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			this.#log(`scan failed: ${message}`);
			this.#deviceList = [];
		}
		return this.#deviceList;
	}

	async getDeviceList(deviceNum: number): Promise<number[]> {
		const deviceList: number[] = [];
		for (let i = 0; i < deviceNum; i++) {
			const deviceType = await this.getDeviceType(i + 1);
			deviceList.push(deviceType);
		}
		return deviceList;
	}

	async #handleEnumPlease() {
		if (this.#enumRunning) return;
		this.#enumRunning = true;
		if (this.#enumTimer) {
			Timer.clear(this.#enumTimer);
			this.#enumTimer = null;
		}
		this.#enumPending = false;
		this.#log(`handleEnumPlease`);

		const oldDevices = [...this.#deviceList];
		for (const d of oldDevices) {
			d._markDisconnected?.();
			this.#invokeUserCallback(() => d.onDisconnected?.(), {
				source: "deviceDisconnected",
				device: d,
			});
		}

		this.#stopPolling();

		await this.#scan();
		if (!this.#started || this.#closed) {
			this.#enumRunning = false;
			return;
		}

		this.#notifyDeviceListChanged();
		this.#updatePollingState();
		this.#updateConnectionMonitoringState();

		this.#enumRunning = false;
	}

	#notifyDeviceListChanged() {
		const devices = [...this.#deviceList];
		this.#invokeUserCallback(() => this.onDeviceListChanged?.(devices), {
			source: "deviceListChanged",
		});
	}

	get devices(): readonly RegisteredM5ChainDevice<TClasses>[] {
		return [...this.#deviceList];
	}
}
