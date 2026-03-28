import createM5ChainDevice from "createM5ChainDevice";
import Serial from "embedded:io/serial";
import Timer from "timer";

export default class M5Chain {
	static CMD = {
		GET_DEVICE_TYPE: 0xfb /**< Get device type. */,
		ENUM_PLEASE: 0xfc /**< Enumeration request. */,
		HEARTBEAT: 0xfd /**< Heartbeat packet. */,
		ENUM: 0xfe /**< Enumeration response. */,
		RESET: 0xff /**< Reset command. */,
	};

	onDeviceListChanged;

	#serial;
	#mutex = Promise.resolve();
	cmdBuffer = new Uint8Array(256);
	#sendBuffer = new Uint8Array(256);
	#receiveResolve;
	#receiveReject;
	#receiveTimeoutId;
	#enumPending;
	#enumTimer;
	#enumRunning;
	#receiveMatch;
	#pollFailureCount = 0;
	#sendCmd;
	#sendId;
	#rxBuffer = new Uint8Array(512);
	#rxLength = 0;
	#deviceList = [];
	#started = false;

	constructor(options) {
		const self = this;
		this.debug = !!options?.debug;
		this.pollingInterval = options.pollingInterval ?? 30;
		this.#serial = new Serial({
			transmit: options?.transmit ?? device.I2C.default.data,
			receive: options?.receive ?? device.I2C.default.clock,
			baud: 115200,
			format: "buffer",
			port: 1,
			onReadable: function (bytesReadable) {
				const chunk = new Uint8Array(this.read(bytesReadable));
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
						self.#receiveResolve(frame);
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
	#log(message, level = "INFO") {
		trace(`[m5chain][${level}] ${message}\n`);
	}
	async lock() {
		let unlock;
		const p = new Promise((resolve) => {
			unlock = resolve;
		});
		const prev = this.#mutex;
		this.#mutex = prev.then(() => p);
		await prev;
		return unlock;
	}

	async withLock(fn) {
		const unlock = await this.lock();
		try {
			return await fn();
		} finally {
			unlock();
		}
	}

	#dumpPacket(buffer, size) {
		let line = `Packet dump(${size} bytes):`;
		for (let i = 0; i < size; i++) {
			line += ` 0x${buffer[i].toString(16).toUpperCase().padStart(2, "0")}`;
		}
		trace(`[m5chain] ${line}\n`);
	}

	#calculateCRC(buffer, size) {
		let crc8 = 0;
		for (let i = 4; i < size - 3; i++) {
			crc8 = (crc8 + buffer[i]) & 0xff;
		}
		return crc8;
	}

	sendPacket(id, cmd, data, size) {
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

	#abortPendingWait(reason) {
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

	async waitForPacket(cmd, options = {}) {
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

	async sendAndWait(id, cmd, data, size, options = undefined) {
		const baseMatch = options?.match;
		const match = (buffer, bytesReadable) => {
			// Always match both id and cmd to avoid resolving the wrong in-flight request.
			if (buffer[4] !== id) return false;
			if (buffer[5] !== cmd) return false;
			return typeof baseMatch === "function" ? baseMatch(buffer, bytesReadable) : true;
		};

		return this.withLock(async () => {
			this.#sendId = id;
			this.sendPacket(id, cmd, data, size);
			const result = await this.waitForPacket(cmd, { ...(options ?? {}), match });
			if (result && result.__m5chain === "timeout") {
				throw new Error(
					`waitForPacket timeout (id=${result.id}, cmd=0x${result.cmd.toString(16).toUpperCase().padStart(2, "0")})`,
				);
			}
			if (result && result.__m5chain === "abort") {
				throw new Error(`waitForPacket aborted (${result.reason})`);
			}
			return result;
		});
	}

	async start() {
		if (this.#started) return;
		this.#started = true;

		await this.#scan();
		this.#notifyDeviceListChanged();
		this.#updatePollingState();
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
			if (!device?.hasOnPoll?.() || typeof device.polling !== "function") {
				continue;
			}

			try {
				const value = await device.polling();
				this.#pollFailureCount = 0; // 成功でリセット

				if (value !== undefined) {
					device.dispatchOnPoll?.(value);
				}
			} catch (_e) {
				this.#pollFailureCount++;
				this.#log(`polling failed (count=${this.#pollFailureCount})`);

				if (this.#pollFailureCount >= 3) {
					this.#log("All devices considered disconnected", "WARN");

					this.running = false;
					this.#deviceList = [];
					this.#notifyDeviceListChanged();
					return;
				}
			}
		}
	}

	// internal (not for app)
	_notifyPollingStateChanged() {
		this.#updatePollingState();
	}
	#updatePollingState() {
		const active = this.#deviceList.some((d) => typeof d?.hasOnPoll === "function" && d.hasOnPoll());

		if (active && !this.running) {
			this.#pollLoop();
		}

		if (!active && this.running) {
			this.running = false;
		}
	}

	async getDeviceType(id) {
		const packet = await this.sendAndWait(id, M5Chain.CMD.GET_DEVICE_TYPE, this.cmdBuffer, 0);
		const deviceType = (packet[7] << 8) | packet[6];
		return deviceType;
	}

	async getDeviceNum() {
		this.cmdBuffer[0] = 0x00;
		const packet = await this.sendAndWait(0xff, M5Chain.CMD.ENUM, this.cmdBuffer, 1);
		const deviceNum = packet[6];
		return deviceNum;
	}

	async isDeviceConnected() {
		try {
			await this.sendAndWait(0xff, M5Chain.CMD.HEARTBEAT, this.cmdBuffer, 0, { timeoutMs: 300 });
			return true;
		} catch {
			return false;
		}
	}

	async #scan() {
		this.#log("scan start");
		this.#deviceList = [];
		try {
			if (await this.isDeviceConnected()) {
				const deviceNum = await this.getDeviceNum();
				const deviceList = await this.getDeviceList(deviceNum);
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
		} catch (e) {
			this.#log(`scan failed: ${e?.message ?? e}`);
			this.#deviceList = [];
		}
		return this.#deviceList;
	}

	async getDeviceList(deviceNum) {
		const deviceList = [];
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

		const oldDevices = [...this.#deviceList];
		for (const d of oldDevices) {
			d.onDisconnected?.();
		}

		this.running = false;

		await this.#scan();

		this.#notifyDeviceListChanged();
		this.#updatePollingState();

		this.#enumRunning = false;
	}

	#notifyDeviceListChanged() {
		this.onDeviceListChanged?.(this.#deviceList);
	}

	get devices() {
		return this.#deviceList;
	}
}
