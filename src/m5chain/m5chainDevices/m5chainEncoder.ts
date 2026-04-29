import CanSample from "canSample";
import HasKey from "hasKey";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, SampleHandler } from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

export const EncoderABDirection = {
	CLOCKWISE_INCREASE: 0,
	CLOCKWISE_DECREASE: 1,
} as const;
export type EncoderABDirection = (typeof EncoderABDirection)[keyof typeof EncoderABDirection];

export const SaveToFlash = {
	DISABLE: 0,
	ENABLE: 1,
} as const;
export type SaveToFlash = (typeof SaveToFlash)[keyof typeof SaveToFlash];

export type EncoderConfiguration = DeviceConfiguration & {
	encoder?: {
		abDirection?: EncoderABDirection;
		saveToFlash?: SaveToFlash;
	};
};

export type EncoderConfigurationSnapshot = DeviceConfigurationSnapshot & {
	encoder: {
		abDirection: EncoderABDirection;
	};
};

function encoderABDirectionToValue(direction: EncoderABDirection): number {
	if (direction !== EncoderABDirection.CLOCKWISE_INCREASE && direction !== EncoderABDirection.CLOCKWISE_DECREASE) {
		throw new RangeError(`Unknown encoder AB direction: ${direction}`);
	}
	return direction;
}

function saveToFlashToValue(saveToFlash: SaveToFlash): number {
	if (saveToFlash !== SaveToFlash.DISABLE && saveToFlash !== SaveToFlash.ENABLE) {
		throw new RangeError(`Unknown save-to-flash value: ${saveToFlash}`);
	}
	return saveToFlash;
}

class M5ChainEncoder extends withDeviceFeatures(HasLed, HasKey, CanSample<number>) {
	static DEVICE_TYPE = 0x0001;
	static CMD = {
		...super.CMD,
		GET_VALUE: 0x10 /**< Get encoder value. */,
		GET_INC_VALUE: 0x11 /**< Get encoder increment value. */,
		RESET_VALUE: 0x13 /**< Reset encoder value. */,
		RESET_INC_VALUE: 0x14 /**< Reset encoder increment value. */,
		SET_AB_STATUS: 0x15 /**< Set AB status, 0->AB, 1->BA. */,
		GET_AB_STATUS: 0x16 /**< Get AB status, 0->AB, 1->BA. */,
	} as const;
	static ENCODER_AB_DIRECTION = EncoderABDirection;
	static SAVE_TO_FLASH = SaveToFlash;
	#lastValue: number | undefined;
	declare onSample: SampleHandler<number>;
	declare sample: () => number | undefined;
	declare dispatchOnSample: (value: number) => void;

	async configure(options: EncoderConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["led", "key", "encoder"]);
		await super.configure(options);
		if (options.encoder === undefined) return;
		assertObjectOption("options.encoder", options.encoder);
		if (options.encoder.abDirection !== undefined) {
			await this.#setEncoderABDirect(options.encoder.abDirection, options.encoder.saveToFlash ?? SaveToFlash.DISABLE);
		} else if (options.encoder.saveToFlash !== undefined) {
			throw new RangeError("options.encoder.saveToFlash requires options.encoder.abDirection.");
		}
	}

	async readConfiguration(): Promise<EncoderConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			encoder: {
				abDirection: await this.#getEncoderABDirect(),
			},
		};
	}

	async readSample(): Promise<number | undefined> {
		const current = await this.getEncoderValue();

		if (this.#lastValue === undefined) {
			this.#lastValue = current;
			return undefined;
		}

		const delta = current - this.#lastValue;
		if (delta === 0) return undefined;
		this.#lastValue = current;
		return delta;
	}

	// -32768 ~32767
	async getEncoderValue(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_VALUE, bus.cmdBuffer, 0);
		const value = (packet[7] << 8) | packet[6];
		return (value << 16) >> 16;
	}

	// -32768 ~32767
	async getEncoderIncValue(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_INC_VALUE, bus.cmdBuffer, 0);
		const value = (packet[7] << 8) | packet[6];
		return (value << 16) >> 16;
	}

	async resetEncoderValue(): Promise<void> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.RESET_VALUE, bus.cmdBuffer, 0);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("resetEncoderValue failed.\n");
		}
	}

	async resetEncoderIncValue(): Promise<void> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.RESET_INC_VALUE, bus.cmdBuffer, 0);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("resetEncoderIncValue failed.\n");
		}
	}
	// direct;
	// 0: Clockwise increase
	// 1: Clockwise decrease
	// saveToFlash
	// 0: Do not save
	// 1: Save
	async #setEncoderABDirect(direct: EncoderABDirection, saveToFlash: SaveToFlash = 0): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = encoderABDirectionToValue(direct);
		cmdBuffer[1] = saveToFlashToValue(saveToFlash);
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.SET_AB_STATUS, cmdBuffer, 2);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("configure encoder AB direction failed.\n");
		}
	}

	// 0: Clockwise increase
	// 1: Clockwise decrease
	async #getEncoderABDirect(): Promise<EncoderABDirection> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_AB_STATUS, bus.cmdBuffer, 0);
		const direction = packet[6];
		switch (direction) {
			case 0:
				return EncoderABDirection.CLOCKWISE_INCREASE;
			case 1:
				return EncoderABDirection.CLOCKWISE_DECREASE;
			default:
				throw new Error(`Unknown encoder AB direction: ${direction}`);
		}
	}
}

export default M5ChainEncoder;
