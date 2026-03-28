import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, KeyHandler, PacketBuffer } from "types";

type HasKeyMethods = {
	onPush: KeyHandler;
	onDispatchEvent(buffer: PacketBuffer): void;
	getKeyStatus(): Promise<number>;
	setKeyTriggerInterval(doubleClick: number, longPress: number): Promise<void>;
	getKeyTriggerInterval(): Promise<{ doubleClick: number; longPress: number }>;
	setKeyMode(mode: number): Promise<void>;
	getKeyMode(): Promise<number>;
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

		onDispatchEvent(buffer: PacketBuffer) {
			const keyStatus = buffer[6];
			this.onPush?.(keyStatus);
		}

		async getKeyStatus(): Promise<number> {
			const bus = this.bus;
			const commands = (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
			const returnPacket = await bus.sendAndWait(this.id, commands.KEY.GET_STATUS, bus.cmdBuffer, 0);
			return returnPacket[6];
		}

		async setKeyTriggerInterval(doubleClick: number, longPress: number) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			const commands = (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
			cmdBuffer[0] = doubleClick;
			cmdBuffer[1] = longPress;
			const packet = await bus.sendAndWait(this.id, commands.KEY.SET_TRIGGER_TIMEOUT, cmdBuffer, 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setKeyTriggerInterval failed.\n");
			}
		}

		async getKeyTriggerInterval(): Promise<{ doubleClick: number; longPress: number }> {
			const bus = this.bus;
			const commands = (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
			const packet = await bus.sendAndWait(this.id, commands.KEY.GET_TRIGGER_TIMEOUT, bus.cmdBuffer, 0);
			return {
				doubleClick: packet[6],
				longPress: packet[7],
			};
		}

		async setKeyMode(mode: number) {
			const bus = this.bus;
			const commands = (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
			bus.cmdBuffer[0] = mode;
			const packet = await bus.sendAndWait(this.id, commands.KEY.SET_MODE, bus.cmdBuffer, 1);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setKeyMode failed.\n");
			}
		}

		async getKeyMode(): Promise<number> {
			const bus = this.bus;
			const commands = (this.constructor as typeof Base & { CMD: KeyCommandSet }).CMD;
			const packet = await bus.sendAndWait(this.id, commands.KEY.GET_MODE, bus.cmdBuffer, 0);
			return packet[6];
		}
	};

export default HasKey as DeviceMixin<DeviceConstructor<M5ChainDevice>, HasKeyMethods>;
