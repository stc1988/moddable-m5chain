import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";
import type { SampleHandler } from "types";

export const AngleRotationDirection = {
	CLOCKWISE: 0,
	COUNTERCLOCKWISE: 1,
} as const;
export type AngleRotationDirection = (typeof AngleRotationDirection)[keyof typeof AngleRotationDirection];

const ADC_12BIT_MAX = 0x0fff;
const ANGLE_DEGREE_RANGE = 280;

function angleRotationDirectionToValue(direction: AngleRotationDirection): number {
	if (direction !== AngleRotationDirection.CLOCKWISE && direction !== AngleRotationDirection.COUNTERCLOCKWISE) {
		throw new RangeError(`Unknown angle rotation direction: ${direction}`);
	}
	return direction;
}

class M5ChainAngle extends withDeviceFeatures(HasLed, CanPoll<number>) {
	static DEVICE_TYPE = 0x0002;
	static CMD = {
		...super.CMD,
		GET_12ADC: 0x30 /**< Command to get the latest 12-bit ADC value */,
		GET_8ADC: 0x31 /**< Command to get the latest 8-bit mapped ADC value */,
		SET_CLOCKWISE_STATUS: 0x32 /**< Command to set the clockwise direction status */,
		GET_CLOCKWISE_STATUS: 0x33 /**< Command to get the current clockwise direction status */,
	} as const;
	static ANGLE_ROTATION_DIRECTION = AngleRotationDirection;
	declare onSample: SampleHandler<number>;
	declare sample: () => number | undefined;
	declare dispatchOnSample: (value: number) => void;

	async polling(): Promise<number> {
		return await this.getAngle12Value();
	}

	async getAngle12Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_12ADC, bus.cmdBuffer, 0);
		return (packet[7] << 8) | packet[6];
	}
	async getAngle12Deg(): Promise<number> {
		const adc = await this.getAngle12Adc();
		return (adc / ADC_12BIT_MAX) * ANGLE_DEGREE_RANGE;
	}
	async getAngle12Value(): Promise<number> {
		const adc = await this.getAngle12Adc();
		const value = (adc & ADC_12BIT_MAX) / ADC_12BIT_MAX;
		return Math.round(value * 100) / 100;
	}

	async getAngle8Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return packet[6];
	}

	// 0: Clockwise
	// 1: Counterclockwise
	async setAngleRotationDirection(direction: AngleRotationDirection): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = angleRotationDirectionToValue(direction);
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.SET_CLOCKWISE_STATUS, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setAngleRotationDirection failed.\n");
		}
	}

	// 0: Clockwise
	// 1: Counterclockwise
	async getAngleRotationDirection(): Promise<AngleRotationDirection> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_CLOCKWISE_STATUS, bus.cmdBuffer, 0);
		const direction = packet[6];
		switch (direction) {
			case 0:
				return AngleRotationDirection.CLOCKWISE;
			case 1:
				return AngleRotationDirection.COUNTERCLOCKWISE;
			default:
				throw new Error(`Unknown angle rotation direction: ${direction}`);
		}
	}
}

export default M5ChainAngle;
