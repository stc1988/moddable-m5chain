import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainToF from "m5chainToF";
import type { ChainBus, DeviceFactoryOptions, M5ChainDeviceLike } from "types";

type DeviceClass = {
	DEVICE_TYPE: number;
	new (m5chain: ChainBus, options: DeviceFactoryOptions): M5ChainDeviceLike;
};

const DEVICE_CLASSES = [M5ChainEncoder, M5ChainAngle, M5ChainKey, M5ChainJoyStick, M5ChainToF];
export default function createM5ChainDevice(m5chain: ChainBus, options: DeviceFactoryOptions): M5ChainDeviceLike {
	const DeviceCtor = (DEVICE_CLASSES as unknown as DeviceClass[]).find((cls) => cls.DEVICE_TYPE === options.type);

	if (!DeviceCtor) {
		throw new Error(`Unknown device type: ${options.type}`);
	}

	return new DeviceCtor(m5chain, options);
}
