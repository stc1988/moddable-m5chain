export type PacketBuffer = Uint8Array;
export type PacketMatch = (buffer: PacketBuffer, size: number) => boolean;
export type TimeoutWaitResult = { __m5chain: "timeout"; id: number | string; cmd: number };
export type AbortWaitResult = { __m5chain: "abort"; reason: string };
export type WaitForPacketResult = PacketBuffer | TimeoutWaitResult | AbortWaitResult;
export type WaitForPacketOptions = { timeoutMs?: number; match?: PacketMatch };
export type DeviceFactoryOptions = { id: number; type: number };
export type LedColor = { r: number; g: number; b: number };
export type KeyTriggerInterval = { doubleClickMs?: number; longPressMs?: number };
export type KeyConfiguration<TMode = number> = { mode?: TMode; triggerInterval?: KeyTriggerInterval };
export type DeviceConfiguration = { key?: KeyConfiguration };
export type DeviceConfigurationSnapshot = {
	key?: { mode: number; triggerInterval: { doubleClickMs: number; longPressMs: number } };
};
export type DeviceListChangeHandler<TDevice extends M5ChainDeviceLike = M5ChainDeviceLike> = (
	devices: readonly TDevice[],
) => void | Promise<void>;
export type DeviceDisconnectHandler = (() => void | Promise<void>) | null;
export type M5ChainErrorSource = "deviceDisconnected" | "deviceEvent" | "deviceListChanged" | "sample";
export type M5ChainErrorContext = { source: M5ChainErrorSource; device?: M5ChainDeviceLike };
export type M5ChainErrorHandler = (error: unknown, context: M5ChainErrorContext) => void | Promise<void>;
export type SampleHandler<T = unknown> = ((sample: T) => void) | null;

export interface ChainBus {
	cmdBuffer: Uint8Array;
	readonly maxPayloadSize: number;
	sendPacket(id: number, cmd: number, data: Uint8Array, size: number): void;
	sendAndWaitForResult(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options?: WaitForPacketOptions,
	): Promise<WaitForPacketResult>;
	sendAndWait(
		id: number,
		cmd: number,
		data: Uint8Array,
		size: number,
		options?: WaitForPacketOptions,
	): Promise<PacketBuffer>;
	_notifyPollingStateChanged(): void;
}

export interface M5ChainDeviceLike {
	id: number;
	type: number;
	kind: string;
	known: boolean;
	connected: boolean;
	uuid?: string;
	init(): Promise<void>;
	getUID(uidType?: number): Promise<string>;
	getBootloaderVersion(): Promise<number>;
	getFirmwareVersion(): Promise<number>;
	configure?(options?: DeviceConfiguration): Promise<void>;
	readConfiguration?(): Promise<DeviceConfigurationSnapshot>;
	_markDisconnected?(): void;
	onDisconnected?: DeviceDisconnectHandler;
	onDispatchEvent?(buffer: PacketBuffer): unknown;
	hasOnSample?(): boolean;
	readSample?<T = unknown>(): Promise<T | undefined>;
	dispatchOnSample?<T = unknown>(value: T): unknown;
}

export type M5ChainDeviceClass<TDevice extends object = object> = {
	readonly DEVICE_TYPE: number;
	new (bus: ChainBus, options: DeviceFactoryOptions): TDevice;
};
export interface M5ChainUnknownDeviceLike extends M5ChainDeviceLike {
	readonly kind: "unknown";
	readonly known: false;
}
export type RegisteredM5ChainDevice<TClasses extends readonly M5ChainDeviceClass[]> =
	| (InstanceType<TClasses[number]> & M5ChainDeviceLike)
	| M5ChainUnknownDeviceLike;
// biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin constructors require any[].
export type DeviceConstructor<TInstance = object> = new (...args: any[]) => TInstance;
export type DeviceMixin<TAdded extends object, TConstraint extends object = object> = <
	TBase extends DeviceConstructor<TConstraint>,
>(
	Base: TBase,
) => (new (...args: ConstructorParameters<TBase>) => InstanceType<TBase> & TAdded) & TBase;
