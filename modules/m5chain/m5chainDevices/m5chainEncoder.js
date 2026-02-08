import CanPoll from "canPoll";
import HasKey from "hasKey";
import HasRGB from "hasRGB";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainEncoder extends withDeviceFeatures(HasRGB, HasKey, CanPoll) {
	static DEVICE_TYPE = 0x0001;
	static CMD = {
		GET_VALUE: 0x10 /**< Get encoder value. */,
		GET_INC_VALUE: 0x11 /**< Get encoder increment value. */,
		RESET_VALUE: 0x13 /**< Reset encoder value. */,
		RESET_INC_VALUE: 0x14 /**< Reset encoder increment value. */,
		SET_AB_STATUS: 0x15 /**< Set AB status, 0->AB, 1->BA. */,
		GET_AB_STATUS: 0x16 /**< Get AB status, 0->AB, 1->BA. */,
	};
	#lastValue;
	async setRGBValue(r, g, b) {
		return await super.setRGBValue(this.id, 0, 1, [{ r, g, b }]);
	}
	async getRGBValue() {
		const colors = await super.getRGBValue(this.id, 0, 1);
		return colors[0];
	}

	async polling() {
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
	async getEncoderValue() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_VALUE, bus.cmdBuffer, 0);
		const value = (packet[7] << 8) | packet[6];
		return (value << 16) >> 16;
	}

	// -32768 ~32767
	async getEncoderIncValue() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_INC_VALUE, bus.cmdBuffer, 0);
		const value = (packet[7] << 8) | packet[6];
		return (value << 16) >> 16;
	}

	async resetEncoderValue() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.RESET_VALUE, bus.cmdBuffer, 0);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("resetEncoderValue failed.\n");
		}
	}

	async resetEncoderIncValue() {
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
	async setEncoderABDirect(direct, saveToFlash = 0) {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = direct;
		cmdBuffer[1] = saveToFlash;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.SET_AB_STATUS, cmdBuffer, 2);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("setEncoderABDirect failed.\n");
		}
	}

	// 0: Clockwise increase
	// 1: Clockwise decrease
	async getEncoderABDirect() {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainEncoder.CMD.GET_AB_STATUS, bus.cmdBuffer, 0);
		return packet[6];
	}
}

export default M5ChainEncoder;
