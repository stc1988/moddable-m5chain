import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";
import type { LedColor, PollHandler } from "types";

export type MeasurementMode = 0 | 1 | 2;
export type MeasurementStatus = 0 | 1;
export type MeasurementCompletionFlag = 0 | 1;

class M5ChainToF extends withDeviceFeatures(HasLed, CanPoll<number>) {
	static DEVICE_TYPE = 0x0005;
	static CMD = {
		...super.CMD,
		GET_DISTANCE: 0x50 /**< Get the measured distance in millimeters. */,
		SET_MEASUREMENT_TIME: 0x51 /**< Set the measurement time in milliseconds. */,
		GET_MEASUREMENT_TIME: 0x52 /**< Get the measurement time in milliseconds. */,
		SET_MEASUREMENT_MODE: 0x53 /**< Set the measurement mode. */,
		GET_MEASUREMENT_MODE: 0x54 /**< Get the measurement mode. */,
		SET_MEASUREMENT_STATUS: 0x55 /**< Set the current measurement status. */,
		GET_MEASUREMENT_STATUS: 0x56 /**< Get the current measurement status. */,
		GET_MEASUREMENT_COMPLETION_FLAG: 0x57 /**< Get the measurement completion flag. */,
	} as const;
	static MEASUREMENT_MODE = {
		STOP: 0,
		SINGLE: 1,
		CONTINUOUS: 2,
	} as const;
	static MEASUREMENT_STATUS = {
		IDLE: 0,
		MEASURING: 1,
	} as const;
	#lastDistance: number | undefined;
	declare onPoll: PollHandler<number>;
	declare dispatchOnPoll: (value: number) => void;

	async setLedColor(r: number, g: number, b: number): Promise<void> {
		return await super.setLedColor(0, 1, [{ r, g, b }]);
	}
	async getLedColor(): Promise<LedColor> {
		const colors = await super.getLedColor(0, 1);
		return colors[0];
	}

	async polling(): Promise<number | undefined> {
		const current = await this.getDistance();
		if (this.#lastDistance === undefined) {
			this.#lastDistance = current;
			return current;
		}
		if (current === this.#lastDistance) {
			return undefined;
		}
		this.#lastDistance = current;
		return current;
	}

	async getDistance(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_DISTANCE, bus.cmdBuffer, 0);
		return (packet[7] << 8) | packet[6];
	}
	async getMeasurementDistance(): Promise<number> {
		return await this.getDistance();
	}

	async setMeasurementTime(time: number): Promise<void> {
		if (time < 20 || time > 200) {
			throw new RangeError("Measurement time must be between 20 and 200 milliseconds.");
		}
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = time;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_TIME, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setMeasurementTime failed.\n");
		}
	}
	async getMeasurementTime(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_TIME, bus.cmdBuffer, 0);
		return packet[6];
	}

	async setMeasurementMode(mode: MeasurementMode): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = mode;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_MODE, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setMeasurementMode failed.\n");
		}
	}
	async getMeasurementMode(): Promise<MeasurementMode> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_MODE, bus.cmdBuffer, 0);
		const mode = packet[6];
		if (mode !== 0 && mode !== 1 && mode !== 2) {
			throw new Error(`Unknown measurement mode: ${mode}`);
		}
		return mode;
	}

	async setMeasurementStatus(status: MeasurementStatus): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = status;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_STATUS, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setMeasurementStatus failed.\n");
		}
	}
	async getMeasurementStatus(): Promise<MeasurementStatus> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_STATUS, bus.cmdBuffer, 0);
		const status = packet[6];
		if (status !== 0 && status !== 1) {
			throw new Error(`Unknown measurement status: ${status}`);
		}
		return status;
	}

	async getMeasurementCompletionFlag(): Promise<MeasurementCompletionFlag> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_COMPLETION_FLAG, bus.cmdBuffer, 0);
		const flag = packet[6];
		if (flag !== 0 && flag !== 1) {
			throw new Error(`Unknown measurement completion flag: ${flag}`);
		}
		return flag;
	}
	async isMeasurementComplete(): Promise<boolean> {
		return (await this.getMeasurementCompletionFlag()) === 1;
	}
	async triggerMeasurement(): Promise<void> {
		await this.setMeasurementStatus(M5ChainToF.MEASUREMENT_STATUS.MEASURING);
	}
}

export default M5ChainToF;
