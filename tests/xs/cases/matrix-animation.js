/*---
description: validates Mono animation sequencing on XS timers
flags: [module, async]
---*/

import Mono from "m5chainMono";
import { assertDeepEqual, assertRejects } from "./assertions_FIXTURE.js";

$TESTMC.timeout(15_000, "matrix animation tests timed out");

function fixture() {
	const writes = [];
	let device;
	const bus = {
		cmdBuffer: new Uint8Array(256),
		async sendAndWait(_id, command, data, size) {
			if (command === 0x31) {
				writes.push(Array.from(data.subarray(0, size)));
				if (writes.length === 3) device?.stopAnimation();
			}
			return new Uint8Array([0, 0, 0, 0, 0, 0, 1]);
		},
	};
	device = new Mono(bus, { id: 1 });
	return { device, writes };
}

async function main() {
	{
		const { device, writes } = fixture();
		const first = new Uint8Array(8).fill(1);
		const second = new Uint8Array(8).fill(2);
		const playing = device.playAnimation([first, second], { frameDurationMs: 20 });
		first.fill(9);
		await playing;
		assertDeepEqual(writes, [Array(8).fill(1), Array(8).fill(2)]);
	}
	{
		const { device, writes } = fixture();
		await device.playAnimation([new Uint8Array(8).fill(3)], { frameDurationMs: 20, loop: true });
		assert.sameValue(writes.length, 3);
	}
	{
		const { device, writes } = fixture();
		await assertRejects(device.playAnimation([], {}), /at least one/);
		await assertRejects(device.playAnimation([new Uint8Array(7)], {}), /exactly 8/);
		await assertRejects(device.playAnimation([new Uint8Array(8)], { frameDurationMs: 19 }), /20/);
		assert.sameValue(writes.length, 0);
	}
}

main().then($DONE, $DONE);
