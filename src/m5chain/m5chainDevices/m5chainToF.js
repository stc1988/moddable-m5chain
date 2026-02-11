import { withDeviceFeatures } from "m5chainDevice";

class M5ChainToF extends withDeviceFeatures() {
	static DEVICE_TYPE = 0x0005;
}

export default M5ChainToF;
