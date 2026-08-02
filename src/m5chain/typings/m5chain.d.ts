import type {
	M5ChainDeviceClass,
	M5ChainErrorHandler,
	PacketBuffer,
	RegisteredM5ChainDevice,
	WaitForPacketOptions,
	WaitForPacketResult,
} from "types";

export type {
	LedColor,
	M5ChainDeviceClass,
	M5ChainDeviceLike,
	M5ChainErrorContext,
	M5ChainErrorHandler,
	M5ChainErrorSource,
	M5ChainUnknownDeviceLike,
	RegisteredM5ChainDevice,
} from "types";

export type M5ChainOptions<TClasses extends readonly M5ChainDeviceClass[]> = {
	deviceClasses: TClasses;
	transmit?: number;
	receive?: number;
	debug?: boolean;
	pollingInterval?: number;
	connectionCheckInterval?: number;
};

export default class M5Chain<TClasses extends readonly M5ChainDeviceClass[]> {
	static readonly CMD: Readonly<{
		GET_DEVICE_TYPE: 0xfb;
		ENUM_PLEASE: 0xfc;
		HEARTBEAT: 0xfd;
		ENUM: 0xfe;
		RESET: 0xff;
	}>;
	onDeviceListChanged?: (devices: readonly RegisteredM5ChainDevice<TClasses>[]) => void | Promise<void>;
	onError?: M5ChainErrorHandler;
	debug: boolean;
	pollingInterval: number;
	connectionCheckInterval: number;
	running: boolean;
	readonly maxPayloadSize: number;
	cmdBuffer: Uint8Array;
	constructor(options: M5ChainOptions<TClasses>);
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
	start(): Promise<void>;
	stop(): Promise<void>;
	close(): Promise<void>;
	get closed(): boolean;
	getDeviceType(id: number): Promise<number>;
	getDeviceNum(options?: WaitForPacketOptions): Promise<number>;
	isDeviceConnected(): Promise<boolean>;
	getDeviceList(deviceNum: number): Promise<number[]>;
	get devices(): readonly RegisteredM5ChainDevice<TClasses>[];
}
