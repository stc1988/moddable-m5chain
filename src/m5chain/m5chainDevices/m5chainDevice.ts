import type {
	ChainBus,
	DeviceConfiguration,
	DeviceConfigurationSnapshot,
	DeviceConstructor,
	DeviceDisconnectHandler,
	DeviceFactoryOptions,
} from "types";

function readPacketByte(packet: Uint8Array, offset: number, operation: string): number {
	const value = packet[offset];
	if (value === undefined) {
		throw new Error(`${operation} response is too short (missing byte at offset ${offset}).`);
	}
	return value;
}

function readPacketUint16LE(packet: Uint8Array, offset: number, operation: string): number {
	return readPacketByte(packet, offset, operation) | (readPacketByte(packet, offset + 1, operation) << 8);
}

function readPacketInt8(packet: Uint8Array, offset: number, operation: string): number {
	const value = readPacketByte(packet, offset, operation);
	return value > 0x7f ? value - 0x100 : value;
}

function readPacketInt16LE(packet: Uint8Array, offset: number, operation: string): number {
	const value = readPacketUint16LE(packet, offset, operation);
	return value > 0x7fff ? value - 0x10000 : value;
}

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
	static CMD = Object.freeze({
		GET_UID: 0xf8 /**< Get unique identifier. */,
		GET_BOOTLOADER_VERSION: 0xf9 /**< Get Bootloader version. */,
		GET_VERSION_DEVICE: 0xfa /**< Get device software version. */,
	} as const);

	#bus: ChainBus;
	#connected = true;
	#id: number;
	#onDisconnected: DeviceDisconnectHandler = null;
	#uuid: string | undefined;
	readonly kind: string = "device";
	readonly known: boolean = true;

	constructor(bus: ChainBus, options: DeviceFactoryOptions) {
		this.#bus = bus;
		this.#id = options.id;
	}

	get bus(): ChainBus {
		if (!this.#connected) {
			throw new Error(`M5Chain device id=${this.id} is disconnected.`);
		}
		return this.#bus;
	}

	get connected(): boolean {
		return this.#connected;
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

	_markDisconnected() {
		this.#connected = false;
	}

	set onDisconnected(fn: DeviceDisconnectHandler) {
		if (fn !== null && typeof fn !== "function") {
			throw new Error("onDisconnected must be a function or null");
		}
		this.#onDisconnected = fn;
	}

	get onDisconnected(): DeviceDisconnectHandler {
		return this.#onDisconnected;
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
		if (readPacketByte(returnPacket, 6, "getUID") === 0) {
			throw new Error("getUID failed.");
		}

		const uid = new Uint8Array(size);
		for (let i = 0; i < size; i++) {
			uid[i] = readPacketByte(returnPacket, 7 + i, "getUID");
		}

		let uidStr = "";
		for (const byte of uid) {
			uidStr += byte.toString(16).toUpperCase().padStart(2, "0");
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
		return readPacketByte(returnPacket, 6, "getBootloaderVersion");
	}

	async getFirmwareVersion(): Promise<number> {
		const returnPacket = await this.bus.sendAndWait(
			this.id,
			M5ChainDevice.CMD.GET_VERSION_DEVICE,
			this.bus.cmdBuffer,
			0,
		);
		return readPacketByte(returnPacket, 6, "getFirmwareVersion");
	}
}

type ComposedDeviceConstructor = DeviceConstructor<M5ChainDevice> & {
	// biome-ignore lint/suspicious/noExplicitAny: Feature command tables are merged dynamically.
	CMD: any;
};

function withDeviceFeatures(
	// biome-ignore lint/suspicious/noExplicitAny: Features accept and return progressively extended constructors.
	...features: Array<(Base: any) => any>
): ComposedDeviceConstructor {
	return features.reduce<ComposedDeviceConstructor>((Base, feature) => {
		const Derived = feature(Base);
		Derived.CMD = Object.freeze({
			...(Base.CMD ?? {}),
			...(Derived.CMD ?? {}),
		}) as typeof M5ChainDevice.CMD;
		return Derived;
	}, M5ChainDevice as ComposedDeviceConstructor);
}

export {
	assertKnownConfigurationOptions,
	assertObjectOption,
	M5ChainDevice,
	readPacketByte,
	readPacketInt8,
	readPacketInt16LE,
	readPacketUint16LE,
	withDeviceFeatures,
};
