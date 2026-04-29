import CanSample from "canSample";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, SampleHandler } from "types";

export const MeasurementMode = {
	STOP: 0,
	SINGLE: 1,
	CONTINUOUS: 2,
} as const;
export type MeasurementMode = (typeof MeasurementMode)[keyof typeof MeasurementMode];

export const MeasurementStatus = {
	IDLE: 0,
	MEASURING: 1,
} as const;
export type MeasurementStatus = (typeof MeasurementStatus)[keyof typeof MeasurementStatus];

export const MeasurementCompletionFlag = {
	INCOMPLETE: 0,
	COMPLETE: 1,
} as const;
export type MeasurementCompletionFlag = (typeof MeasurementCompletionFlag)[keyof typeof MeasurementCompletionFlag];

export type ToFConfiguration = DeviceConfiguration & {
	tof?: {
		measurementTime?: number;
		measurementMode?: MeasurementMode;
	};
};

export type ToFConfigurationSnapshot = DeviceConfigurationSnapshot & {
	tof: {
		measurementTime: number;
		measurementMode: MeasurementMode;
	};
};

function measurementModeToValue(mode: MeasurementMode): number {
	if (mode !== MeasurementMode.STOP && mode !== MeasurementMode.SINGLE && mode !== MeasurementMode.CONTINUOUS) {
		throw new RangeError(`Unknown measurement mode: ${mode}`);
	}
	return mode;
}

function measurementStatusToValue(status: MeasurementStatus): number {
	if (status !== MeasurementStatus.IDLE && status !== MeasurementStatus.MEASURING) {
		throw new RangeError(`Unknown measurement status: ${status}`);
	}
	return status;
}

class M5ChainToF extends withDeviceFeatures(HasLed, CanSample<number>) {
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
	declare onSample: SampleHandler<number>;
	declare sample: () => number | undefined;
	declare dispatchOnSample: (value: number) => void;

	async configure(options: ToFConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["led", "tof"]);
		await super.configure(options);
		if (options.tof === undefined) return;
		assertObjectOption("options.tof", options.tof);
		if (options.tof.measurementTime !== undefined) {
			await this.#setMeasurementTime(options.tof.measurementTime);
		}
		if (options.tof.measurementMode !== undefined) {
			await this.#setMeasurementMode(options.tof.measurementMode);
		}
	}

	async readConfiguration(): Promise<ToFConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			tof: {
				measurementTime: await this.#getMeasurementTime(),
				measurementMode: await this.#getMeasurementMode(),
			},
		};
	}

	async readSample(): Promise<number> {
		return await this.getDistance();
	}

	async getDistance(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_DISTANCE, bus.cmdBuffer, 0);
		return (packet[7] << 8) | packet[6];
	}
	async getMeasurementDistance(): Promise<number> {
		return await this.getDistance();
	}

	async #setMeasurementTime(time: number): Promise<void> {
		if (time < 20 || time > 200) {
			throw new RangeError("Measurement time must be between 20 and 200 milliseconds.");
		}
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = time;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_TIME, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("configure measurement time failed.\n");
		}
	}
	async #getMeasurementTime(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_TIME, bus.cmdBuffer, 0);
		return packet[6];
	}

	async #setMeasurementMode(mode: MeasurementMode): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = measurementModeToValue(mode);
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_MODE, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("configure measurement mode failed.\n");
		}
	}
	async #getMeasurementMode(): Promise<MeasurementMode> {
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

	async #setMeasurementStatus(status: MeasurementStatus): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = measurementStatusToValue(status);
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_STATUS, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("set measurement status failed.\n");
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
		await this.#setMeasurementStatus(MeasurementStatus.MEASURING);
	}
}

export default M5ChainToF;
