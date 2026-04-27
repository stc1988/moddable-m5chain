import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, PacketBuffer } from "types";

const KEY_EVENT = {
	SINGLE_CLICK: 0,
	DOUBLE_CLICK: 1,
	LONG_PRESS: 2,
} as const;

type KeyEvent = (typeof KEY_EVENT)[keyof typeof KEY_EVENT];

type KeyHandler = ((keyEvent: KeyEvent) => void) | null;

const KEY_MODE = {
	PASSIVE: 0,
	ACTIVE: 1,
} as const;

const KEY_STATUS = {
	RELEASED: 0,
	PRESSED: 1,
} as const;

type KeyMode = (typeof KEY_MODE)[keyof typeof KEY_MODE];
type KeyStatus = (typeof KEY_STATUS)[keyof typeof KEY_STATUS];

type HasKeyMethods = {
	onPush: KeyHandler;
	onDispatchEvent(buffer: PacketBuffer): void;
	isKeyPressed(): Promise<boolean>;
	setKeyTriggerInterval(doubleClickMs: number, longPressMs: number): Promise<void>;
	getKeyTriggerInterval(): Promise<{ doubleClickMs: number; longPressMs: number }>;
	setKeyMode(mode: KeyMode): Promise<void>;
	getKeyMode(): Promise<KeyMode>;
};

type KeyCommandSet = {
	KEY: {
		GET_STATUS: number;
		SET_TRIGGER_TIMEOUT: number;
		GET_TRIGGER_TIMEOUT: number;
		SET_MODE: number;
		GET_MODE: number;
	};
};

const HasKey = <TBase extends DeviceConstructor<M5ChainDevice>>(Base: TBase) =>
	class extends Base {
		static CMD = {
			KEY: {
				GET_STATUS: 0xe1 /**< Get key status. */,
				SET_TRIGGER_TIMEOUT: 0xe2 /**< Set trigger timeout. */,
				GET_TRIGGER_TIMEOUT: 0xe3 /**< Get trigger timeout. */,
				SET_MODE: 0xe4 /**< Set key mode. */,
				GET_MODE: 0xe5 /**< Get key mode. */,
			},
		} as const;

		#onPush: KeyHandler = null;

		set onPush(fn: KeyHandler) {
			if (fn !== null && typeof fn !== "function") {
				throw new Error("onPush must be a function or null");
			}
			this.#onPush = fn;
		}

		get onPush(): KeyHandler {
			return this.#onPush;
		}

		get #commands() {
			return (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
		}

		onDispatchEvent(buffer: PacketBuffer) {
			const keyEvent = buffer[6] as KeyEvent;
			this.onPush?.(keyEvent);
		}

		async isKeyPressed(): Promise<boolean> {
			const bus = this.bus;
			const returnPacket = await bus.sendAndWait(this.id, this.#commands.KEY.GET_STATUS, bus.cmdBuffer, 0);
			return (returnPacket[6] as KeyStatus) === KEY_STATUS.PRESSED;
		}

		async setKeyTriggerInterval(doubleClickMs: number, longPressMs: number) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = doubleClickMs;
			cmdBuffer[1] = longPressMs;
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.SET_TRIGGER_TIMEOUT, cmdBuffer, 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setKeyTriggerInterval failed.\n");
			}
		}

		async getKeyTriggerInterval(): Promise<{ doubleClickMs: number; longPressMs: number }> {
			const bus = this.bus;
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.GET_TRIGGER_TIMEOUT, bus.cmdBuffer, 0);
			return {
				doubleClickMs: packet[6],
				longPressMs: packet[7],
			};
		}

		async setKeyMode(mode: KeyMode) {
			const bus = this.bus;
			bus.cmdBuffer[0] = mode;
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.SET_MODE, bus.cmdBuffer, 1);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setKeyMode failed.\n");
			}
		}

		async getKeyMode(): Promise<KeyMode> {
			const bus = this.bus;
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.GET_MODE, bus.cmdBuffer, 0);
			return packet[6] as KeyMode;
		}
	};

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyHandler };
export default HasKey as DeviceMixin<DeviceConstructor<M5ChainDevice>, HasKeyMethods>;
