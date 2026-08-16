import type {
	ChainBus,
	DeviceConfiguration,
	DeviceConfigurationSnapshot,
	DeviceConstructor,
	DeviceDisconnectHandler,
	DeviceFactoryOptions,
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
type ComposedDeviceConstructor = DeviceConstructor<M5ChainDevice> & {
	// biome-ignore lint/suspicious/noExplicitAny: Feature command tables are merged dynamically.
	CMD: any;
};
declare function withDeviceFeatures(
	// biome-ignore lint/suspicious/noExplicitAny: Features accept and return progressively extended constructors.
	...features: Array<(Base: any) => any>
): ComposedDeviceConstructor;

export { assertKnownConfigurationOptions, assertObjectOption, M5ChainDevice, withDeviceFeatures };
