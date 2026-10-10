/*---
description: validates device brightness conversions and failures on XS
flags: [module, async]
---*/

import HasLed from "hasLed";
import { M5ChainDevice } from "m5chainDevice";
import Mono from "m5chainMono";
import RGB from "m5chainRGB";
import { assertDeepEqual, assertRejects } from "./assertions_FIXTURE.js";

$TESTMC.timeout(15_000, "brightness tests timed out");

async function main() {
	for (const [Device, set, get, setCommand, getCommand, maximum, middle, readMiddle] of [
		[HasLed(M5ChainDevice), "setLedBrightness", "getLedBrightness", 0x22, 0x23, 100, 50, 128],
		[RGB, "setBrightness", "getBrightness", 0xe2, 0xe3, 100, 50, 128],
		[Mono, "setBrightness", "getBrightness", 0xe2, 0xe3, 7, 4, 146],
	]) {
		let level = 0;
		let fail = false;
		const writes = [];
		const bus = {
			cmdBuffer: new Uint8Array(256),
			async sendAndWait(id, command, data, size) {
				assert.sameValue(id, 1);
				if (fail) throw new Error("transport failed");
				if (command === setCommand) {
					writes.push(Array.from(data.subarray(0, size)));
					level = data[0];
					return new Uint8Array([0, 0, 0, 0, 0, 0, 1]);
				}
				assert.sameValue(command, getCommand);
				return new Uint8Array([0, 0, 0, 0, 0, 0, level]);
			},
		};
		const device = new Device(bus, { id: 1 });
		for (const [input, wire, output] of [
			[0, 0, 0],
			[128, middle, readMiddle],
			[255, maximum, 255],
		]) {
			await device[set](input);
			assertDeepEqual(writes[writes.length - 1], [wire, 0]);
			assert.sameValue(await device[get](), output);
		}
		await device[set](255, true);
		assertDeepEqual(writes[writes.length - 1], [maximum, 1]);
		const count = writes.length;
		for (const invalid of [-1, 256, 0.5, Number.NaN, Infinity, "128"]) {
			await assertRejects(device[set](invalid), RangeError);
		}
		assert.sameValue(writes.length, count);
		level = maximum + 1;
		await assertRejects(device[get](), RangeError);
		fail = true;
		await assertRejects(device[set](128), /transport failed/);
		await assertRejects(device[get](), /transport failed/);
	}
}

main().then($DONE, $DONE);
