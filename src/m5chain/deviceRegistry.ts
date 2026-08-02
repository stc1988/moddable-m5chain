import type { M5ChainDeviceClass } from "types";

function normalizeDeviceClasses(value: unknown): readonly M5ChainDeviceClass[] {
	if (!Array.isArray(value)) {
		throw new TypeError("deviceClasses must be an array.");
	}

	const deviceTypes = new Set<number>();
	for (const DeviceClass of value) {
		if (typeof DeviceClass !== "function") {
			throw new TypeError("deviceClasses must contain device constructors.");
		}
		const type = DeviceClass.DEVICE_TYPE;
		if (!Number.isInteger(type) || type < 0 || type > 0xffff) {
			throw new RangeError("Each device class must have a 16-bit DEVICE_TYPE.");
		}
		if (deviceTypes.has(type)) {
			throw new RangeError(`Duplicate DEVICE_TYPE: 0x${type.toString(16).toUpperCase().padStart(4, "0")}`);
		}
		deviceTypes.add(type);
	}

	return Object.freeze([...value]) as readonly M5ChainDeviceClass[];
}

export { normalizeDeviceClasses };
