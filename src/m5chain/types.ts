export type PacketBuffer = Uint8Array;

export type PacketMatch = (buffer: PacketBuffer, size: number) => boolean;

export type TimeoutWaitResult = {
	__m5chain: "timeout";
	id: number | string;
	cmd: number;
};

export type AbortWaitResult = {
	__m5chain: "abort";
	reason: string;
};

export type WaitForPacketResult = PacketBuffer | TimeoutWaitResult | AbortWaitResult;

export type WaitForPacketOptions = {
	timeoutMs?: number;
	match?: PacketMatch;
};

export type Unlock = () => void;

export type DeviceFactoryOptions = {
	id: number;
	type: number;
};

export type LedColor = {
	r: number;
	g: number;
	b: number;
};

export type DeviceListChangeHandler = (devices: M5ChainDeviceLike[]) => void;

export type KeyHandler = ((keyStatus: number) => void) | null;

export type PollHandler<T = unknown> = ((value: T) => void) | null;

export interface ChainBus {
	cmdBuffer: Uint8Array;
	lock(): Promise<Unlock>;
	sendPacket(id: number, cmd: number, data: Uint8Array, size: number): void;
	waitForPacket(cmd: number, options?: WaitForPacketOptions): Promise<WaitForPacketResult>;
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
	uuid?: string;
	init(): Promise<void>;
	onDisconnected?(): void;
	onDispatchEvent?(buffer: PacketBuffer): void;
	hasOnPoll?(): boolean;
	polling?(): Promise<unknown>;
	dispatchOnPoll?(value: unknown): void;
}

// biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin constructors require any[].
export type DeviceConstructor<TInstance = object> = new (...args: any[]) => TInstance;

export type DeviceMixin<TBase extends DeviceConstructor, TAdded extends object> = (
	Base: TBase,
	// biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin constructors require any[].
) => (new (...args: any[]) => InstanceType<TBase> & TAdded) & TBase;
