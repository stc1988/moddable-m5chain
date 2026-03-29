import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";
import type { PollHandler } from "types";

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

	async setLedColor(r: number, g: number, b: number) {
		return await super.setLedColor(0, 1, [{ r, g, b }]);
	}
	async getLedColor() {
		const colors = await super.getLedColor(0, 1);
		return colors[0];
	}

	async polling() {
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

	async getDistance() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_DISTANCE, bus.cmdBuffer, 0);
		return (packet[7] << 8) | packet[6];
	}
	async getMeasurementDistance() {
		return await this.getDistance();
	}

	async setMeasurementTime(time: number) {
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
	async getMeasurementTime() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_TIME, bus.cmdBuffer, 0);
		return packet[6];
	}

	async setMeasurementMode(mode: number) {
		if (![0, 1, 2].includes(mode)) {
			throw new RangeError("Measurement mode must be 0 (stop), 1 (single), or 2 (continuous).");
		}
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = mode;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_MODE, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setMeasurementMode failed.\n");
		}
	}
	async getMeasurementMode() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_MODE, bus.cmdBuffer, 0);
		return packet[6];
	}

	async setMeasurementStatus(status: number) {
		if (![0, 1].includes(status)) {
			throw new RangeError("Measurement status must be 0 (idle) or 1 (measuring).");
		}
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = status;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.SET_MEASUREMENT_STATUS, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setMeasurementStatus failed.\n");
		}
	}
	async getMeasurementStatus() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_STATUS, bus.cmdBuffer, 0);
		return packet[6];
	}

	async getMeasurementCompletionFlag() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainToF.CMD.GET_MEASUREMENT_COMPLETION_FLAG, bus.cmdBuffer, 0);
		return packet[6];
	}
	async isMeasurementComplete() {
		return (await this.getMeasurementCompletionFlag()) === 1;
	}
	async triggerMeasurement() {
		await this.setMeasurementStatus(M5ChainToF.MEASUREMENT_STATUS.MEASURING);
	}
}

export default M5ChainToF;
