import M5ChainUnknownDevice from "m5chainUnknownDevice";
import type { ChainBus, DeviceFactoryOptions, M5ChainDeviceClass, RegisteredM5ChainRuntimeDevice } from "types";

export default function createM5ChainDevice<TClasses extends readonly M5ChainDeviceClass[]>(
	deviceClasses: TClasses,
	m5chain: ChainBus,
	options: DeviceFactoryOptions,
): RegisteredM5ChainRuntimeDevice<TClasses> {
	const DeviceCtor = deviceClasses.find((cls) => cls.DEVICE_TYPE === options.type);

	if (!DeviceCtor) {
		return new M5ChainUnknownDevice(m5chain, options) as RegisteredM5ChainRuntimeDevice<TClasses>;
	}

	return new DeviceCtor(m5chain, options) as RegisteredM5ChainRuntimeDevice<TClasses>;
}
