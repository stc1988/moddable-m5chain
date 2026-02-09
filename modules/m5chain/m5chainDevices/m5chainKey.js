import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static DEVICE_TYPE = 0x0003;
	async setLedColor(r, g, b) {
		return await super.setLedColor(0, 1, [{ r, g, b }]);
	}
	async getLedColor() {
		const colors = await super.getLedColor(0, 1);
		return colors[0];
	}
}

export default M5ChainKey;
