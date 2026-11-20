/*---
description: validates Chain ENV packet boundaries, scaled values, and warning transitions on XS
flags: [module]
---*/

import {
	assertENVRate,
	assertENVTemperatureSource,
	ENV_COMMAND,
	ENV_RATE,
	ENV_REPORT_MODE,
	ENV_TEMPERATURE_SOURCE,
	envPacketView,
	envScaledInteger,
	envWarningFromPacket,
} from "envProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

for (const table of [ENV_COMMAND, ENV_RATE, ENV_REPORT_MODE, ENV_TEMPERATURE_SOURCE]) assert(Object.isFrozen(table));
assert.sameValue(ENV_COMMAND.GET_AHT20_DATA, 0x30);
assert.sameValue(ENV_COMMAND.CALIBRATE_SEA_LEVEL_PRESSURE, 0x38);
assert.sameValue(ENV_COMMAND.GET_ALTITUDE_THRESHOLD, 0xea);
for (let rate = 0; rate <= 15; rate++) assertENVRate(rate);
for (const rate of [-1, 16, 0.5, NaN, Infinity]) assertThrows(() => assertENVRate(rate), /must/);
assertENVTemperatureSource(0);
assertENVTemperatureSource(1);
assertThrows(() => assertENVTemperatureSource(2), /must/);
assert.sameValue(envScaledInteger("altitude", -21474836.48, 100, -2147483648, 2147483647), -2147483648);
assert.sameValue(envScaledInteger("altitude", 21474836.47, 100, -2147483648, 2147483647), 2147483647);
assert.sameValue(envScaledInteger("pressure", 300, 10, 3000, 11000), 3000);
assert.sameValue(envScaledInteger("pressure", 1100, 10, 3000, 11000), 11000);
for (const value of [299.9, 1100.1, 1013.25, NaN, Infinity, -Infinity])
	assertThrows(() => envScaledInteger("pressure", value, 10, 3000, 11000), /must/);
// A subarray must be decoded relative to its byteOffset.
const backing = new Uint8Array(32);
const packet = backing.subarray(5, 17);
packet.set([0x2e, 0xfb, 65], 6);
const view = envPacketView(packet, 3);
assert.sameValue(view.getInt16(0, true), -1234);
assert.sameValue(view.getUint8(2), 65);
assertThrows(() => envPacketView(packet.subarray(0, 11), 3), /payload length/);
assertThrows(() => envPacketView(backing, 3), /payload length/);
const event = new Uint8Array(11);
event[7] = 0x0f;
for (let status = 0; status < 256; status++) {
	event[6] = status;
	assertDeepEqual(envWarningFromPacket(event), {
		temperature: status & 3,
		humidity: (status >> 2) & 3,
		pressure: (status >> 4) & 3,
		altitude: (status >> 6) & 3,
	});
}
assertThrows(() => envWarningFromPacket(event.subarray(0, 10)), /payload length/);
