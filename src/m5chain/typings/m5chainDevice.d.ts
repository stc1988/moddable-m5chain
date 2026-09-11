import type {
	ChainBus,
	DeviceConfiguration,
	DeviceConfigurationSnapshot,
	DeviceConstructor,
	DeviceDisconnectHandler,
	DeviceFactoryOptions,
	DeviceMixin,
} from "types";

declare class M5ChainDevice {
	static readonly CMD: Readonly<{
		GET_UID: 0xf8;
		GET_BOOTLOADER_VERSION: 0xf9;
		GET_VERSION_DEVICE: 0xfa;
	}>;
	readonly kind: string;
	readonly known: boolean;
	constructor(bus: ChainBus, options: DeviceFactoryOptions);
	get bus(): ChainBus;
	get connected(): boolean;
	get id(): number;
	get type(): number;
	get uuid(): string | undefined;
	init(): Promise<void>;
	_markDisconnected(): void;
	onDisconnected: DeviceDisconnectHandler;
	configure(options?: DeviceConfiguration): Promise<void>;
	readConfiguration(): Promise<DeviceConfigurationSnapshot>;
	getUID(uidType?: number): Promise<string>;
	getBootloaderVersion(): Promise<number>;
	getFirmwareVersion(): Promise<number>;
}

declare function assertObjectOption(name: string, value: unknown): void;
declare function assertKnownConfigurationOptions(options: DeviceConfiguration, known: string[]): void;
declare function readPacketByte(packet: Uint8Array, offset: number, operation: string): number;
declare function readPacketUint16LE(packet: Uint8Array, offset: number, operation: string): number;
declare function readPacketInt8(packet: Uint8Array, offset: number, operation: string): number;
declare function readPacketInt16LE(packet: Uint8Array, offset: number, operation: string): number;
type ComposedDeviceConstructor = DeviceConstructor<M5ChainDevice> & {
	// biome-ignore lint/suspicious/noExplicitAny: Feature command tables are merged dynamically.
	CMD: any;
};
type FeatureMethods<T> = T extends DeviceMixin<infer TAdded, M5ChainDevice> ? TAdded : never;
type IntersectFeatures<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer TResult) => void
	? TResult
	: never;
declare function withDeviceFeatures<const TFeatures extends readonly DeviceMixin<object, M5ChainDevice>[]>(
	...features: TFeatures
): DeviceConstructor<M5ChainDevice & IntersectFeatures<FeatureMethods<TFeatures[number]>>> &
	Pick<ComposedDeviceConstructor, "CMD">;

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
