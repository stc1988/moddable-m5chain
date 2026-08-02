import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDeviceClasses } from "../src/m5chain/deviceRegistry.ts";

class Encoder {
	static DEVICE_TYPE = 0x0001;
	kind = "encoder";
}

class ToF {
	static DEVICE_TYPE = 0x0005;
	kind = "tof";
}

test("copies and freezes a valid device class registry", () => {
	const input = [Encoder, ToF];
	const registry = normalizeDeviceClasses(input);

	assert.deepEqual(registry, input);
	assert.notEqual(registry, input);
	assert.equal(Object.isFrozen(registry), true);
});

test("accepts an explicitly empty registry", () => {
	assert.deepEqual(normalizeDeviceClasses([]), []);
});

test("rejects duplicate device types", () => {
	class DuplicateEncoder {
		static DEVICE_TYPE = Encoder.DEVICE_TYPE;
		kind = "duplicateEncoder";
	}

	assert.throws(() => normalizeDeviceClasses([Encoder, DuplicateEncoder]), /Duplicate DEVICE_TYPE: 0x0001/);
});

test("rejects invalid registries and device types", () => {
	assert.throws(() => normalizeDeviceClasses(undefined), /must be an array/);
	assert.throws(() => normalizeDeviceClasses([{}]), /device constructors/);
	assert.throws(() => normalizeDeviceClasses([class {}]), /16-bit DEVICE_TYPE/);
	assert.throws(
		() =>
			normalizeDeviceClasses([
				class OutOfRangeDevice {
					static DEVICE_TYPE = 0x10000;
					kind = "outOfRange";
				},
			]),
		/16-bit DEVICE_TYPE/,
	);
});
