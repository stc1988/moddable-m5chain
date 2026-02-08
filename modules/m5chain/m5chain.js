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

	#serial;
	#mutex = Promise.resolve();
	cmdBuffer = new Uint8Array(256);
	#sendBuffer = new Uint8Array(256);
	#receiveResolve;
	#sendCmd;
	deviceList = [];

	constructor(options) {
		const self = this;
		this.debug = !!options?.debug;
		this.#serial = new Serial({
			transmit: options?.transmit ?? device.I2C.default.data,
			receive: options?.receive ?? device.I2C.default.clock,
			baud: 115200,
			format: "buffer",
			port: 1,
			onReadable: function (bytesReadable) {
				if (bytesReadable >= 9 && bytesReadable < 256) {
					const buffer = new Uint8Array(this.read());
					if (this.debug) {
						trace("RX Packet => ");
						self.#dumpPacket(buffer, bytesReadable);
					}

					if (
						buffer[0] !== 0xaa ||
						buffer[1] !== 0x55 ||
						buffer[bytesReadable - 2] !== 0x55 ||
						buffer[bytesReadable - 1] !== 0xaa
					) {
						trace("Invalid packet header/footer.\n");
						return;
					}
					const length = (buffer[2] & 0xff) | ((buffer[3] & 0xff) << 8);
					const packetSize = 4 + length + 2;
					const crc8 = self.#calculateCRC(buffer, packetSize);
					if (crc8 !== buffer[packetSize - 3]) {
						Error("crc8 error\n");
						return;
					}
					const packetId = buffer[4];
					const packetCmd = buffer[5];

					if (packetCmd === self.#sendCmd) {
						// M5ChainCmd
						if (self.#receiveResolve) {
							self.#receiveResolve(buffer);
							self.#receiveResolve = null;
							self.#sendCmd = null;
						}
					} else if (packetCmd === 0xe0) {
						// M5ChainDeviceCmd
						const device = self.deviceList[packetId - 1];
						if (device) {
							device.onDispatchEvent?.(buffer);
						} else {
							trace(`Unknown device ID: ${packetId}\n`);
						}
					} else if (packetCmd === M5Chain.CMD.CHAIN_ENUM_PLEASE) {
						trace("change device\n");
					} else {
						trace(`Unknown command: 0x${packetCmd.toString(16).toUpperCase().padStart(2, "0")}\n`);
					}
				}
			},
		});
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
		trace(`Packet dump(${size} bytes):\n\t-- `);
		for (let i = 0; i < size; i++) {
			trace(`0x${buffer[i].toString(16).toUpperCase().padStart(2, "0")} `);
			if ((i + 1) % 16 === 0) trace("\n\t-- ");
		}
		trace("\n");
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
			trace("TX Packet => ");
			this.#dumpPacket(sendBuffer, sendBufferSize);
		}

		this.#serial.write(sendBuffer.subarray(0, sendBufferSize));
	}

	async waitForPacket(cmd) {
		return new Promise((resolve) => {
			this.#sendCmd = cmd;
			this.#receiveResolve = resolve;
		});
	}

	async sendAndWait(id, cmd, data, size) {
		return this.withLock(async () => {
			this.sendPacket(id, cmd, data, size);
			return await this.waitForPacket(cmd);
		});
	}

	// Polling connected device that has onPoll
	async start() {
		this.running = true;
		while (this.running) {
			await this.pollDevices();
			Timer.delay(1000);
		}
	}

	async pollDevices() {
		for (const device of this.deviceList) {
			// device must support polling feature and have active listener
			if (!device?.hasOnPoll || typeof device.hasOnPoll !== "function") {
				continue;
			}
			if (!device.hasOnPoll()) {
				continue;
			}

			if (typeof device.polling !== "function") {
				continue;
			}

			const value = await device.polling();
			if (value !== undefined) {
				device.dispatchOnPoll?.(value);
			}
		}
	}

	updatePollingState() {
		const active = this.deviceList.some((d) => typeof d?.hasOnPoll === "function" && d.hasOnPoll());
		if (active && !this.running) {
			this.start();
		}
		if (!active && this.running) this.running = false;
	}

	// getEnumPleaseNum

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
		await this.sendAndWait(0xff, M5Chain.CMD.HEARTBEAT, this.cmdBuffer, 0);
		return true;
	}

	async getDeviceList(deviceNum) {
		const deviceList = [];
		for (let i = 0; i < deviceNum; i++) {
			const deviceType = await this.getDeviceType(i + 1);
			deviceList.push(deviceType);
		}
		return deviceList;
	}

	async scan() {
		this.deviceList = [];
		if (await this.isDeviceConnected()) {
			const deviceNum = await this.getDeviceNum();
			const deviceList = await this.getDeviceList(deviceNum);
			for (let i = 0; i < deviceList.length; i++) {
				const device = createM5ChainDevice(this, {
					id: i + 1,
					type: deviceList[i],
				});
				this.deviceList.push(device);
			}
		}
		return this.deviceList;
	}
}
