/*---
description: validates custom M5Chain device registries on XS
flags: [module]
---*/

import { normalizeDeviceClasses } from "deviceRegistry";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

class Encoder {
	static DEVICE_TYPE = 0x0001;
	kind = "encoder";
}

class ToF {
	static DEVICE_TYPE = 0x0005;
	kind = "tof";
}

const input = [Encoder, ToF];
const registry = normalizeDeviceClasses(input);
assertDeepEqual(registry, input);
assert.notSameValue(registry, input);
assert(Object.isFrozen(registry));
assertDeepEqual(normalizeDeviceClasses([]), []);

class DuplicateEncoder {
	static DEVICE_TYPE = Encoder.DEVICE_TYPE;
	kind = "duplicateEncoder";
}

assertThrows(() => normalizeDeviceClasses([Encoder, DuplicateEncoder]), /Duplicate DEVICE_TYPE: 0x0001/);
assertThrows(() => normalizeDeviceClasses(undefined), /must be an array/);
assertThrows(() => normalizeDeviceClasses([{}]), /device constructors/);
assertThrows(() => normalizeDeviceClasses([class {}]), /16-bit DEVICE_TYPE/);
assertThrows(
	() =>
		normalizeDeviceClasses([
			class OutOfRangeDevice {
				static DEVICE_TYPE = 0x10000;
				kind = "outOfRange";
			},
		]),
	/16-bit DEVICE_TYPE/,
);
