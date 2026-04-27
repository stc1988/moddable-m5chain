import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";
import type { PollHandler } from "types";

export const MeasurementMode = {
	STOP: "stop",
	SINGLE: "single",
	CONTINUOUS: "continuous",
} as const;
export type MeasurementMode = (typeof MeasurementMode)[keyof typeof MeasurementMode];

export const MeasurementStatus = {
	IDLE: "idle",
	MEASURING: "measuring",
} as const;
export type MeasurementStatus = (typeof MeasurementStatus)[keyof typeof MeasurementStatus];

export const MeasurementCompletionFlag = {
	INCOMPLETE: "incomplete",
	COMPLETE: "complete",
} as const;
export type MeasurementCompletionFlag = (typeof MeasurementCompletionFlag)[keyof typeof MeasurementCompletionFlag];

const MEASUREMENT_MODE_VALUE = {
	[MeasurementMode.STOP]: 0,
	[MeasurementMode.SINGLE]: 1,
	[MeasurementMode.CONTINUOUS]: 2,
} as const;

const MEASUREMENT_STATUS_VALUE = {
	[MeasurementStatus.IDLE]: 0,
	[MeasurementStatus.MEASURING]: 1,
} as const;

function measurementModeToValue(mode: MeasurementMode): number {
	const value = MEASUREMENT_MODE_VALUE[mode];
	if (value === undefined) {
		throw new RangeError(`Unknown measurement mode: ${mode}`);
	}
	return value;
}

function measurementStatusToValue(status: MeasurementStatus): number {
	const value = MEASUREMENT_STATUS_VALUE[status];
	if (value === undefined) {
		throw new RangeError(`Unknown measurement status: ${status}`);
	}
	return value;
}

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
	static MEASUREMENT_MODE = MeasurementMode;
	static MEASUREMENT_STATUS = MeasurementStatus;
	static MEASUREMENT_COMPLETION_FLAG = MeasurementCompletionFlag;
	#lastDistance: number | undefined;
	declare onPoll: PollHandler<number>;
	declare dispatchOnPoll: (value: number) => void;

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
		cmdBuffer[0] = measurementModeToValue(mode);
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
		switch (mode) {
			case 0:
				return MeasurementMode.STOP;
			case 1:
				return MeasurementMode.SINGLE;
			case 2:
				return MeasurementMode.CONTINUOUS;
			default:
				throw new Error(`Unknown measurement mode: ${mode}`);
		}
	}

	async setMeasurementStatus(status: MeasurementStatus): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = measurementStatusToValue(status);
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
		switch (status) {
			case 0:
				return MeasurementStatus.IDLE;
			case 1:
				return MeasurementStatus.MEASURING;
			default:
				throw new Error(`Unknown measurement status: ${status}`);
		}
	}

	async getMeasurementCompletionFlag(): Promise<MeasurementCompletionFlag> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_COMPLETION_FLAG, bus.cmdBuffer, 0);
		const flag = packet[6];
		switch (flag) {
			case 0:
				return MeasurementCompletionFlag.INCOMPLETE;
			case 1:
				return MeasurementCompletionFlag.COMPLETE;
			default:
				throw new Error(`Unknown measurement completion flag: ${flag}`);
		}
	}
	async isMeasurementComplete(): Promise<boolean> {
		return (await this.getMeasurementCompletionFlag()) === MeasurementCompletionFlag.COMPLETE;
	}
	async triggerMeasurement(): Promise<void> {
		await this.setMeasurementStatus(MeasurementStatus.MEASURING);
	}
}

export default M5ChainToF;
