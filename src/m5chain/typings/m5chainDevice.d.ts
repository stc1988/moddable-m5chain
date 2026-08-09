import type {
	ChainBus,
	DeviceConfiguration,
	DeviceConfigurationSnapshot,
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
// biome-ignore lint/suspicious/noExplicitAny: Mirrors the runtime mixin composition signature.
declare function withDeviceFeatures(...features: Array<(Base: any) => any>): any;

export { assertKnownConfigurationOptions, assertObjectOption, M5ChainDevice, withDeviceFeatures };
