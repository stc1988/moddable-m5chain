import type { M5ChainDevice } from "deviceUnion";
import M5ChainAngle from "m5chainAngle";
import M5ChainBuzzer from "m5chainBuzzer";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainMono from "m5chainMono";
import M5ChainRGB from "m5chainRGB";
import M5ChainToF from "m5chainToF";
import M5ChainUnknownDevice from "m5chainUnknownDevice";
import type { ChainBus, DeviceFactoryOptions } from "types";

type DeviceClass = {
	DEVICE_TYPE: number;
	new (m5chain: ChainBus, options: DeviceFactoryOptions): M5ChainDevice;
};

const DEVICE_CLASSES = [
	M5ChainEncoder,
	M5ChainAngle,
	M5ChainKey,
	M5ChainJoyStick,
	M5ChainToF,
	M5ChainBuzzer,
	M5ChainMono,
	M5ChainRGB,
];
export default function createM5ChainDevice(m5chain: ChainBus, options: DeviceFactoryOptions): M5ChainDevice {
	const DeviceCtor = (DEVICE_CLASSES as unknown as DeviceClass[]).find((cls) => cls.DEVICE_TYPE === options.type);

	if (!DeviceCtor) {
		return new M5ChainUnknownDevice(m5chain, options);
	}

	return new DeviceCtor(m5chain, options);
}
