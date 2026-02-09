import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainAngle extends withDeviceFeatures(HasLed, CanPoll) {
	static DEVICE_TYPE = 0x0002;
	static CMD = {
		...super.CMD,
		GET_12ADC: 0x30 /**< Command to get the latest 12-bit ADC value */,
		GET_8ADC: 0x31 /**< Command to get the latest 8-bit mapped ADC value */,
		SET_CLOCKWISE_STATUS: 0x32 /**< Command to set the clockwise direction status */,
		GET_CLOCKWISE_STATUS: 0x33 /**< Command to get the current clockwise direction status */,
	};
	#lastValue;
	async setLedColor(r, g, b) {
		return await super.setLedColor(0, 1, [{ r, g, b }]);
	}
	async getLedColor() {
		const colors = await super.getLedColor(0, 1);
		return colors[0];
	}

	async polling() {
		const current = await this.getAngle12value();
		if (this.#lastValue === undefined) {
			this.#lastValue = current;
			return current;
		}

		if (current === this.#lastValue) {
			return undefined;
		}

		this.#lastValue = current;
		return current;
	}

	async getAngle12Adc() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_12ADC, bus.cmdBuffer, 0);
		return (packet[7] << 8) | packet[6];
	}
	async getAngle12Deg() {
		const adc = await this.getAngle12Adc();
		return (adc / 4095) * 280;
	}
	async getAngle12value() {
		const adc = await this.getAngle12Adc();
		const value = (adc & 0x0fff) / 4095;
		return Math.round(value * 100) / 100;
	}

	async getAngle8Adc() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return packet[6];
	}

	// 0: Clockwise
	// 1: Counterclockwise
	async setAngleRotationDirection(direction) {
		const bus = this.bus;
		const cmdBuffer = bus.buffer;
		cmdBuffer[0] = direction;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.SET_CLOCKWISE_STATUS, cmdBuffer, 1);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setAngleRotationDirection failed.\n");
		}
	}

	// 0: Clockwise
	// 1: Counterclockwise
	async getAngleRotationDirection() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainAngle.CMD.GET_CLOCKWISE_STATUS, bus.cmdBuffer, 0);
		return packet[6];
	}
}

export default M5ChainAngle;
