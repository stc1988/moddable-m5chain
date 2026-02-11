import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainToF from "m5chainToF";

const DEVICE_CLASSES = [M5ChainEncoder, M5ChainAngle, M5ChainKey, M5ChainJoyStick, M5ChainToF];
export default function createM5ChainDevice(m5chain, options) {
	const DeviceClass = DEVICE_CLASSES.find((cls) => cls.DEVICE_TYPE === options.type);

	if (!DeviceClass) {
		throw new Error(`Unknown device type: ${options.type}`);
	}

	return new DeviceClass(m5chain, options);
}
