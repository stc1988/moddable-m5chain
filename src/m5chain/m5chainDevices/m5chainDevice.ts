import type { ChainBus, DeviceFactoryOptions, PacketBuffer, WaitForPacketResult } from "types";

class M5ChainDevice {
	static CMD = {
		GET_UID: 0xf8 /**< Get unique identifier. */,
		GET_BOOTLOADER_VERSION: 0xf9 /**< Get Bootloader version. */,
		GET_VERSION_DEVICE: 0xfa /**< Get device software version. */,
	} as const;

	#bus: ChainBus;
	#id: number;
	#uuid: string | undefined;

	constructor(bus: ChainBus, options: DeviceFactoryOptions) {
		this.#bus = bus;
		this.#id = options.id;
	}

	get bus(): ChainBus {
		return this.#bus;
	}

	get id(): number {
		return this.#id;
	}

	get type(): number {
		return (this.constructor as typeof M5ChainDevice & { DEVICE_TYPE: number }).DEVICE_TYPE;
	}

	get uuid(): string | undefined {
		return this.#uuid;
	}

	async init() {
		this.#uuid = await this.getUID();
	}

	#unwrapWaitResult(result: WaitForPacketResult): PacketBuffer {
		if (result instanceof Uint8Array) {
			return result;
		}

		if (result.__m5chain === "timeout") {
			throw new Error(`waitForPacket timeout (id=${result.id}, cmd=0x${result.cmd.toString(16).toUpperCase()})`);
		}

		throw new Error(`waitForPacket aborted (${result.reason})`);
	}

	//  UID_Type UID type
	//  0: 4-byte UID
	//  1: 12-byte UID
	async getUID(uidType = 1): Promise<string> {
		const unlock = await this.bus.lock();
		try {
			const size = uidType === 0 ? 4 : 12;
			this.bus.cmdBuffer[0] = uidType;
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_UID, this.bus.cmdBuffer, 1);
			const returnPacket = this.#unwrapWaitResult(await this.bus.waitForPacket(M5ChainDevice.CMD.GET_UID));
			if (returnPacket[6] === 0) {
				throw new Error("getUID failed.");
			}

			const uid = new Uint8Array(size);
			for (let i = 0; i < size; i++) {
				uid[i] = returnPacket[7 + i];
			}

			let uidStr = "";
			for (let i = 0; i < size; i++) {
				uidStr += uid[i].toString(16).toUpperCase().padStart(2, "0");
			}
			return uidStr;
		} finally {
			unlock();
		}
	}

	async getBootloaderVersion(): Promise<number> {
		const unlock = await this.bus.lock();
		try {
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_BOOTLOADER_VERSION, this.bus.cmdBuffer, 0);
			const returnPacket = this.#unwrapWaitResult(
				await this.bus.waitForPacket(M5ChainDevice.CMD.GET_BOOTLOADER_VERSION),
			);
			return returnPacket[6];
		} finally {
			unlock();
		}
	}

	async getFirmwareVersion(): Promise<number> {
		const unlock = await this.bus.lock();
		try {
			this.bus.sendPacket(this.id, M5ChainDevice.CMD.GET_VERSION_DEVICE, this.bus.cmdBuffer, 0);
			const returnPacket = this.#unwrapWaitResult(await this.bus.waitForPacket(M5ChainDevice.CMD.GET_VERSION_DEVICE));
			return returnPacket[6];
		} finally {
			unlock();
		}
	}
}

// biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin composition is easier to express with any here.
type AnyDeviceConstructor = any;

function withDeviceFeatures(
	...features: Array<(Base: AnyDeviceConstructor) => AnyDeviceConstructor>
): AnyDeviceConstructor {
	return features.reduce((Base, feature) => {
		const Derived = feature(Base);
		Derived.CMD = {
			...(Base.CMD ?? {}),
			...(Derived.CMD ?? {}),
		} as typeof M5ChainDevice.CMD;
		return Derived;
	}, M5ChainDevice as AnyDeviceConstructor);
}

export { M5ChainDevice, withDeviceFeatures };
