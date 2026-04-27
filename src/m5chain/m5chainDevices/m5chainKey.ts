import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

export { KEY_EVENT, type KeyEvent } from "hasKey";

class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static DEVICE_TYPE = 0x0003;
}

export default M5ChainKey;
