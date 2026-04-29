import type { ChainBus, DeviceConfiguration, DeviceConfigurationSnapshot, DeviceFactoryOptions } from "types";

function assertObjectOption(name: string, value: unknown) {
	if (value === undefined) return;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${name} must be an object.`);
	}
}

function assertKnownConfigurationOptions(options: DeviceConfiguration, known: string[]) {
	const allowed = new Set(known);
	for (const key in options) {
		if (!allowed.has(key)) {
			throw new RangeError(`Unsupported configuration option: ${key}`);
		}
	}
}

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

	async configure(options: DeviceConfiguration = {}): Promise<void> {
		assertObjectOption("options", options);
	}

	async readConfiguration(): Promise<DeviceConfigurationSnapshot> {
		return {};
	}

	//  UID_Type UID type
	//  0: 4-byte UID
	//  1: 12-byte UID
	async getUID(uidType = 1): Promise<string> {
		const size = uidType === 0 ? 4 : 12;
		this.bus.cmdBuffer[0] = uidType;
		const returnPacket = await this.bus.sendAndWait(this.id, M5ChainDevice.CMD.GET_UID, this.bus.cmdBuffer, 1);
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
	}

	async getBootloaderVersion(): Promise<number> {
		const returnPacket = await this.bus.sendAndWait(
			this.id,
			M5ChainDevice.CMD.GET_BOOTLOADER_VERSION,
			this.bus.cmdBuffer,
			0,
		);
		return returnPacket[6];
	}

	async getFirmwareVersion(): Promise<number> {
		const returnPacket = await this.bus.sendAndWait(
			this.id,
			M5ChainDevice.CMD.GET_VERSION_DEVICE,
			this.bus.cmdBuffer,
			0,
		);
		return returnPacket[6];
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

export { M5ChainDevice, assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures };
