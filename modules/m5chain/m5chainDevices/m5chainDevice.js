class M5ChainDevice {
	static CMD = {
		GET_UID: 0xf8 /**< Get unique identifier. */,
		GET_BOOTLOADER_VERSION: 0xf9 /**< Get Bootloader version. */,
		GET_VERSION_DEVICE: 0xfa /**< Get device software version. */,
	};
	#bus;
	#id;
	constructor(bus, options) {
		this.#bus = bus;
		this.#id = options.id;
	}
	get bus() {
		return this.#bus;
	}
	get id() {
		return this.#id;
	}
	get type() {
		return this.constructor.DEVICE_TYPE;
	}
	//  UID_Type UID type
	//  0: 4-byte UID
	//  1: 12-byte UID
	async getUID(uidType = 1) {
		const unlock = await this.bus.lock();
		try {
			const size = uidType === 0 ? 4 : 12;
			this.bus.cmdBuffer[0] = uidType;
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_UID, this.bus.cmdBuffer, 1);
			const returnPacket = await this.bus.waitForPacket(M5ChainDevice.CMD.GET_UID);
			if (returnPacket[6] === 0) {
				throw new Error("getUID failed.");
			} else {
				const uid = new Uint8Array(size);
				for (let i = 0; i < size; i++) {
					uid[i] = returnPacket[7 + i];
				}
				// convert to hex string
				let uidStr = "";
				for (let i = 0; i < size; i++) {
					uidStr += uid[i].toString(16).toUpperCase().padStart(2, "0");
				}
				return uidStr;
			}
		} finally {
			unlock();
		}
	}
	async getBootloaderVersion() {
		const unlock = await this.bus.lock();
		try {
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_BOOTLOADER_VERSION, this.bus.cmdBuffer, 0);
			const returnPacket = await this.bus.waitForPacket(M5ChainDevice.CMD.GET_BOOTLOADER_VERSION);
			const bootloaderVersion = returnPacket[6];
			return bootloaderVersion;
		} finally {
			unlock();
		}
	}

	async getFirmwareVersion() {
		const unlock = await this.bus.lock();
		try {
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_VERSION_DEVICE, this.bus.cmdBuffer, 0);
			const returnPacket = await this.bus.waitForPacket(M5ChainDevice.CMD.GET_VERSION_DEVICE);
			const deviceVersion = returnPacket[6];
			return deviceVersion;
		} finally {
			unlock();
		}
	}
}

const withDeviceFeatures = (...features) =>
	features.reduce((Base, feature) => {
		const Derived = feature(Base);
		Derived.CMD = {
			...(Base.CMD ?? {}),
			...(Derived.CMD ?? {}),
		};
		return Derived;
	}, M5ChainDevice);
export { M5ChainDevice, withDeviceFeatures };
