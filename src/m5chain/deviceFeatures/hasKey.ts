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

function keyModeToValue(mode: KeyMode): number {
	if (mode !== KEY_MODE.PASSIVE && mode !== KEY_MODE.ACTIVE) {
		throw new RangeError(`Unknown key mode: ${mode}`);
	}
	return mode;
}

function doubleClickMsToProtocolValue(doubleClickMs: number): number {
	if (
		typeof doubleClickMs !== "number" ||
		Number.isNaN(doubleClickMs) ||
		doubleClickMs < 100 ||
		doubleClickMs > 1000 ||
		doubleClickMs % 100 !== 0
	) {
		throw new RangeError("doubleClickMs must be 100 to 1000 milliseconds in 100ms steps.");
	}
	return doubleClickMs / 100 - 1;
}

function longPressMsToProtocolValue(longPressMs: number): number {
	if (
		typeof longPressMs !== "number" ||
		Number.isNaN(longPressMs) ||
		longPressMs < 3000 ||
		longPressMs > 10000 ||
		longPressMs % 1000 !== 0
	) {
		throw new RangeError("longPressMs must be 3000 to 10000 milliseconds in 1000ms steps.");
	}
	return longPressMs / 1000 - 3;
}

function keyEventFromValue(value: number): KeyEvent {
	switch (value) {
		case 0:
			return KEY_EVENT.SINGLE_CLICK;
		case 1:
			return KEY_EVENT.DOUBLE_CLICK;
		case 2:
			return KEY_EVENT.LONG_PRESS;
		default:
			throw new Error(`Unknown key event: ${value}`);
	}
}

function keyModeFromValue(value: number): KeyMode {
	switch (value) {
		case 0:
			return KEY_MODE.PASSIVE;
		case 1:
			return KEY_MODE.ACTIVE;
		default:
			throw new Error(`Unknown key mode: ${value}`);
	}
}

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
			const keyEvent = keyEventFromValue(buffer[6]);
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
			cmdBuffer[0] = doubleClickMsToProtocolValue(doubleClickMs);
			cmdBuffer[1] = longPressMsToProtocolValue(longPressMs);
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
				doubleClickMs: (packet[6] + 1) * 100,
				longPressMs: (packet[7] + 3) * 1000,
			};
		}

		async setKeyMode(mode: KeyMode) {
			const bus = this.bus;
			bus.cmdBuffer[0] = keyModeToValue(mode);
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.SET_MODE, bus.cmdBuffer, 1);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setKeyMode failed.\n");
			}
		}

		async getKeyMode(): Promise<KeyMode> {
			const bus = this.bus;
			const packet = await bus.sendAndWait(this.id, this.#commands.KEY.GET_MODE, bus.cmdBuffer, 0);
			return keyModeFromValue(packet[6]);
		}
	};

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyHandler, type KeyMode, type KeyStatus };
export default HasKey as DeviceMixin<DeviceConstructor<M5ChainDevice>, HasKeyMethods>;
