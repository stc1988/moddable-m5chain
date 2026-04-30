import createM5ChainDevice from "createM5ChainDevice";
import Serial from "embedded:io/serial";
import Timer from "timer";
import type {
	DeviceListChangeHandler,
	M5ChainDeviceLike,
	PacketBuffer,
	PacketMatch,
	WaitForPacketOptions,
	WaitForPacketResult,
} from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

type M5ChainOptions = {
	transmit?: number;
	receive?: number;
	debug?: boolean;
	pollingInterval?: number;
	presenceCheckInterval?: number;
};

declare const device: {
	I2C: {
		default: {
			data: number;
			clock: number;
		};
	};
};

export default class M5Chain {
	static CMD = {
		GET_DEVICE_TYPE: 0xfb /**< Get device type. */,
		ENUM_PLEASE: 0xfc /**< Enumeration request. */,
		HEARTBEAT: 0xfd /**< Heartbeat packet. */,
		ENUM: 0xfe /**< Enumeration response. */,
		RESET: 0xff /**< Reset command. */,
	} as const;

	onDeviceListChanged?: DeviceListChangeHandler;
	debug: boolean;
	pollingInterval: number;
	presenceCheckInterval: number;
	running = false;

	#serial;
	#mutex: Promise<unknown> = Promise.resolve();
	cmdBuffer = new Uint8Array(256);
	#sendBuffer = new Uint8Array(256);
	#receiveResolve: ((result: WaitForPacketResult) => void) | null = null;
	#receiveReject: ((reason?: unknown) => void) | null = null;
	#receiveTimeoutId: ReturnType<typeof Timer.set> | null = null;
	#enumPending = false;
	#enumTimer: ReturnType<typeof Timer.set> | null = null;
	#enumRunning = false;
	#receiveMatch: PacketMatch | null = null;
	#pollFailureCount = 0;
	#pollReadFailed = false;
	#presenceFailureCount = 0;
	#presenceRunning = false;
	#sendCmd: number | null = null;
	#sendId: number | null = null;
	#rxBuffer = new Uint8Array(512);
	#rxLength = 0;
	#deviceList: M5ChainDeviceLike[] = [];
	#started = false;

	constructor(options: M5ChainOptions = {}) {
		const self = this;
		this.debug = !!options?.debug;
		this.pollingInterval = options.pollingInterval ?? 30;
		this.presenceCheckInterval = options.presenceCheckInterval ?? 500;
		this.#serial = new Serial({
			transmit: options?.transmit ?? device.I2C.default.data,
			receive: options?.receive ?? device.I2C.default.clock,
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
						(self.#receiveMatch ? self.#receiveMatch(frame, packetSize) : packetCmd === self.#sendCmd);

					if (shouldResolve) {
						const resolve = self.#receiveResolve;
						if (!resolve) {
							continue;
						}
						resolve(frame);
						self.#clearPendingWait();
						continue;
					}

					if (packetCmd === 0xe0) {
						const device = self.#deviceList[packetId - 1];
						if (device) {
							device.onDispatchEvent?.(frame);
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
	async lock() {
		let unlock: (() => void) | undefined;
		const p = new Promise<void>((resolve) => {
			unlock = () => {
				resolve();
			};
		});
		const prev = this.#mutex;
		this.#mutex = prev.then(() => p);
		await prev;
		if (!unlock) {
			throw new Error("lock initialization failed");
		}
		return unlock;
	}

	async withLock<T>(fn: () => Promise<T>): Promise<T> {
		const unlock = await this.lock();
		try {
			return await fn();
		} finally {
			unlock();
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

	#clearPendingWait() {
		if (this.#receiveTimeoutId) {
			Timer.clear(this.#receiveTimeoutId);
			this.#receiveTimeoutId = null;
		}
		this.#receiveResolve = null;
		this.#receiveReject = null;
		this.#receiveMatch = null;
		this.#sendCmd = null;
		this.#sendId = null;
	}

	#abortPendingWait(reason: string) {
		// Resolve the in-flight request with an abort marker so the lock can be released
		// without producing an unhandled rejection.
		if (this.#receiveResolve) {
			try {
				this.#receiveResolve({ __m5chain: "abort", reason });
			} catch {
				// ignore
			}
		}
		this.#clearPendingWait();
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

	async waitForPacket(cmd: number, options: WaitForPacketOptions = {}): Promise<WaitForPacketResult> {
		const timeoutMs = options.timeoutMs ?? 800;
		const match = options.match;

		// Defensive: if a previous wait is still pending, abort it to avoid wedging the mutex.
		if (this.#receiveResolve || this.#receiveReject) {
			this.#abortPendingWait("waitForPacket overlapped");
		}

		return new Promise((resolve, reject) => {
			this.#sendCmd = cmd;
			this.#receiveResolve = resolve;
			this.#receiveReject = reject;
			this.#receiveMatch = typeof match === "function" ? match : null;

			if (timeoutMs > 0) {
				this.#receiveTimeoutId = Timer.set(() => {
					// Timeout must release the lock and clear pending state.
					// Resolve with a timeout marker to avoid an unhandled rejection break in the debugger.
					if (this.#receiveResolve) {
						try {
							this.#receiveResolve({ __m5chain: "timeout", id: this.#sendId ?? "?", cmd });
						} catch {
							// ignore
						}
					}
					this.#clearPendingWait();
				}, timeoutMs);
			}
		});
	}

	async sendAndWaitForResult(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options: WaitForPacketOptions | undefined = undefined,
	): Promise<WaitForPacketResult> {
		const baseMatch = options?.match;
		const match = (buffer: PacketBuffer, bytesReadable: number) => {
			// Always match both id and cmd to avoid resolving the wrong in-flight request.
			if (buffer[4] !== id) return false;
			if (buffer[5] !== cmd) return false;
			return typeof baseMatch === "function" ? baseMatch(buffer, bytesReadable) : true;
		};

		return this.withLock(async () => {
			this.#sendId = id;
			this.sendPacket(id, cmd, data, size);
			const result = await this.waitForPacket(cmd, { ...(options ?? {}), match });
			return result;
		});
	}

	async sendAndWait(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options: WaitForPacketOptions | undefined = undefined,
	): Promise<PacketBuffer> {
		const result = await this.sendAndWaitForResult(id, cmd, data, size, options);
		if (!(result instanceof Uint8Array) && result.__m5chain === "timeout") {
			throw new Error(
				`waitForPacket timeout (id=${result.id}, cmd=0x${result.cmd.toString(16).toUpperCase().padStart(2, "0")})`,
			);
		}
		if (!(result instanceof Uint8Array) && result.__m5chain === "abort") {
			throw new Error(`waitForPacket aborted (${result.reason})`);
		}
		return result;
	}

	async #handlePollingFailure() {
		this.#pollFailureCount++;
		this.#log(`polling failed (count=${this.#pollFailureCount})`);

		if (this.#pollFailureCount >= 3) {
			this.#log("polling failed repeatedly; rescanning devices", "WARN");
			await this.#rescan("polling failure");
			return true;
		}
		return false;
	}

	_notifyPollingReadFailed() {
		this.#pollReadFailed = true;
	}

	async start() {
		if (this.#started) return;
		this.#started = true;

		await this.#scan();
		this.#notifyDeviceListChanged();
		this.#updatePollingState();
		this.#updatePresenceMonitorState();
	}

	async #pollLoop() {
		this.running = true;
		while (this.running) {
			await this.#pollDevices();
			Timer.delay(this.pollingInterval);
		}
	}

	async #pollDevices() {
		for (const device of this.#deviceList) {
			if (!device?.hasOnSample?.() || typeof device.readSample !== "function") {
				continue;
			}

			try {
				const value = await device.readSample();
				if (this.#pollReadFailed) {
					this.#pollReadFailed = false;
					if (await this.#handlePollingFailure()) return;
					continue;
				}

				this.#pollFailureCount = 0; // 成功でリセット

				if (value !== undefined) {
					device.dispatchOnSample?.(value);
				}
			} catch (_e) {
				if (await this.#handlePollingFailure()) return;
			}
		}
	}

	// internal (not for app)
	_notifyPollingStateChanged() {
		this.#updatePollingState();
		this.#updatePresenceMonitorState();
	}
	#hasActiveSampleHandlers() {
		return this.#deviceList.some((d) => typeof d?.hasOnSample === "function" && d.hasOnSample());
	}

	#updatePollingState() {
		const active = this.#hasActiveSampleHandlers();

		if (active && !this.running) {
			this.#pollLoop();
		}

		if (!active && this.running) {
			this.running = false;
		}
	}

	#updatePresenceMonitorState() {
		const active = this.#deviceList.length > 0 && !this.#hasActiveSampleHandlers();

		if (active && !this.#presenceRunning) {
			void this.#presenceMonitorLoop();
		}

		if (!active && this.#presenceRunning) {
			this.#presenceRunning = false;
		}
	}

	async #presenceMonitorLoop() {
		this.#presenceRunning = true;

		while (this.#presenceRunning) {
			Timer.delay(this.presenceCheckInterval);
			if (!this.#presenceRunning) break;
			if (this.#deviceList.length === 0 || this.#hasActiveSampleHandlers()) break;

			const connected = await this.isDeviceConnected();
			if (!this.#presenceRunning) break;
			if (this.#deviceList.length === 0 || this.#hasActiveSampleHandlers()) break;

			if (connected) {
				this.#presenceFailureCount = 0;
				continue;
			}

			this.#presenceFailureCount++;
			this.#log(`presence heartbeat failed (count=${this.#presenceFailureCount})`);

			if (this.#presenceFailureCount >= 3) {
				this.#log("presence heartbeat failed repeatedly; rescanning devices", "WARN");
				await this.#rescan("presence heartbeat failure");
				return;
			}
		}

		this.#presenceRunning = false;
	}

	async getDeviceType(id: number): Promise<number> {
		const packet = await this.sendAndWait(id, M5Chain.CMD.GET_DEVICE_TYPE, this.cmdBuffer, 0);
		const deviceType = (packet[7] << 8) | packet[6];
		return deviceType;
	}

	async #readDeviceType(id: number): Promise<number | undefined> {
		const packet = await this.sendAndWaitForResult(id, M5Chain.CMD.GET_DEVICE_TYPE, this.cmdBuffer, 0);
		if (!(packet instanceof Uint8Array)) return undefined;
		return (packet[7] << 8) | packet[6];
	}

	async getDeviceNum(): Promise<number> {
		this.cmdBuffer[0] = 0x00;
		const packet = await this.sendAndWait(0xff, M5Chain.CMD.ENUM, this.cmdBuffer, 1);
		const deviceNum = packet[6];
		return deviceNum;
	}

	async #readDeviceNum(): Promise<number | undefined> {
		this.cmdBuffer[0] = 0x00;
		const packet = await this.sendAndWaitForResult(0xff, M5Chain.CMD.ENUM, this.cmdBuffer, 1);
		if (!(packet instanceof Uint8Array)) return undefined;
		return packet[6];
	}

	async isDeviceConnected(): Promise<boolean> {
		const id = 0xff;
		const cmd = M5Chain.CMD.HEARTBEAT;
		const result = await this.withLock(async () => {
			this.#sendId = id;
			this.sendPacket(id, cmd, this.cmdBuffer, 0);
			return await this.waitForPacket(cmd, {
				timeoutMs: 300,
				match: (buffer) => buffer[4] === id && buffer[5] === cmd,
			});
		});
		return result instanceof Uint8Array;
	}

	async #scan() {
		this.#log("scan start");
		this.#deviceList = [];
		try {
			if (await this.isDeviceConnected()) {
				const deviceNum = await this.#readDeviceNum();
				if (deviceNum === undefined) {
					this.#log("scan found no enumerable devices");
					return this.#deviceList;
				}

				const deviceList = await this.#readDeviceList(deviceNum);
				for (let i = 0; i < deviceList.length; i++) {
					const device = createM5ChainDevice(this, {
						id: i + 1,
						type: deviceList[i],
					});
					await device.init();
					this.#deviceList.push(device);
					this.#log(
						`found device id=${device.id ?? "?"}, type=0x${(device.type ?? 0).toString(16).toUpperCase()} uuid=${device.uuid}`,
					);
				}
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			this.#log(`scan failed: ${message}`);
			this.#deviceList = [];
		}
		return this.#deviceList;
	}

	async #readDeviceList(deviceNum: number): Promise<number[]> {
		const deviceList: number[] = [];
		for (let i = 0; i < deviceNum; i++) {
			const deviceType = await this.#readDeviceType(i + 1);
			if (deviceType === undefined) break;
			deviceList.push(deviceType);
		}
		return deviceList;
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
		this.#log(`handleEnumPlease`);

		await this.#rescan("ENUM_PLEASE");

		this.#enumRunning = false;
	}

	async #rescan(reason: string) {
		this.#log(`rescan requested: ${reason}`);

		const oldDevices = [...this.#deviceList];
		for (const d of oldDevices) {
			d.onDisconnected?.();
		}

		this.running = false;
		this.#pollFailureCount = 0;
		this.#pollReadFailed = false;
		this.#presenceFailureCount = 0;
		this.#presenceRunning = false;

		await this.#scan();

		if (this.#deviceList.length === 0) {
			this.#log("All devices disconnected after rescan", "WARN");
		}

		this.#notifyDeviceListChanged();
		this.#updatePollingState();
		this.#updatePresenceMonitorState();
	}

	#notifyDeviceListChanged() {
		this.onDeviceListChanged?.(this.#deviceList);
	}

	get devices(): M5ChainDeviceLike[] {
		return this.#deviceList;
	}
}
