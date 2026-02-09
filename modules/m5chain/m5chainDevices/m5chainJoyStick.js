import deepEqual from "deepEqual";
import CanPoll from "canPoll";
import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainJoyStick extends withDeviceFeatures(HasLed, HasKey, CanPoll) {
	static DEVICE_TYPE = 0x0004;
	static CMD = {
		...super.CMD,
		GET_16ADC: 0x30 /**< Command to get 16-bit ADC values */,
		GET_8ADC: 0x31 /**< Command to get 8-bit ADC values */,
		GET_ADC_XY_MAPPED_RANGE: 0x32 /**< Command to get mapped range for X and Y axes */,
		SET_ADC_XY_MAPPED_RANGE: 0x33 /**< Command to set mapped range for X and Y axes */,
		GET_ADC_XY_MAPPED_INT16_VALUE: 0x34 /**< Command to get 16-bit mapped values for X and Y */,
		GET_ADC_XY_MAPPED_INT8_VALUE: 0x35 /**< Command to get 8-bit mapped values for X and Y */,
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
		const current = await this.getJoystickMappedInt8Value();
		if (this.#lastValue === undefined) {
			this.#lastValue = current;
			return current;
		}
		if (deepEqual(current, this.#lastValue)) {
			return undefined;
		}

		this.#lastValue = current;
		return current;
	}

	// 0 ~ 65535
	async getJoystick16Adc() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_16ADC, bus.cmdBuffer, 0);
		return {
			x: (packet[7] << 8) | packet[6],
			y: (packet[9] << 8) | packet[8],
		};
	}
	//0 ~ 255
	async getJoystick8Adc() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return {
			x: packet[6],
			y: packet[7],
		};
	}
	async getJoystickMappedRange() {
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_RANGE, bus.cmdBuffer, 0);
		return {
			xMin: packet[6],
			xMax: packet[7],
			yMin: packet[8],
			yMax: packet[9],
		};
	}
	async setJoystickMappedRange(xMin, xMax, yMin, yMax) {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = xMin;
		cmdBuffer[1] = xMax;
		cmdBuffer[2] = yMin;
		cmdBuffer[3] = yMax;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.SET_ADC_XY_MAPPED_RANGE, cmdBuffer, 4);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setJoystickMappedRange failed.\n");
		}
	}
	//-4095-4095
	async getJoystickMappedInt16Value() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT16_VALUE, bus.cmdBuffer, 0);
		const x = (packet[7] << 8) | packet[6];
		const y = (packet[9] << 8) | packet[8];
		return {
			x: (x << 16) >> 16,
			y: (y << 16) >> 16,
		};
	}
	//  -128~127
	async getJoystickMappedInt8Value() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT8_VALUE, bus.cmdBuffer, 0);
		return {
			x: (packet[6] << 24) >> 24,
			y: (packet[7] << 24) >> 24,
		};
	}
}

export default M5ChainJoyStick;
