import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static DEVICE_TYPE = 0x0003;
}

export default M5ChainKey;
