import HasKey from "hasKey";
import HasRGB from "hasRGB";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainKey extends withDeviceFeatures(HasRGB, HasKey) {
	static DEVICE_TYPE = 0x0003;
	async setRGBValue(r, g, b) {
		return await super.setRGBValue(this.id, 0, 1, [{ r, g, b }]);
	}
	async getRGBValue() {
		const colors = await super.getRGBValue(this.id, 0, 1);
		return colors[0];
	}
}

export default M5ChainKey;
