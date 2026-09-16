import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

const modules = Object.fromEntries(
	[
		["m5chainDevice", "../src/m5chain/m5chainDevices/m5chainDevice.ts"],
		["m5chainMatrixDisplay", "../src/m5chain/m5chainDevices/m5chainMatrixDisplay.ts"],
		["matrixDisplayProtocol", "../src/m5chain/matrixDisplayProtocol.ts"],
		["timer", "./timerMock.mjs"],
	].map(([name, path]) => [name, new URL(path, import.meta.url).href]),
);
register(
	`data:text/javascript,${encodeURIComponent(`
		const modules = ${JSON.stringify(modules)};
		export function resolve(name, context, next) {
			return modules[name] ? { url: modules[name], shortCircuit: true } : next(name, context);
		}
	`)}`,
	import.meta.url,
);

const { default: Mono } = await import("../src/m5chain/m5chainDevices/m5chainMono.ts");

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

test("plays copied Mono frames once in order", async () => {
	const { device, writes } = fixture();
	const first = new Uint8Array(8).fill(1);
	const second = new Uint8Array(8).fill(2);
	const playing = device.playAnimation([first, second], { frameDurationMs: 20 });
	first.fill(9);
	await playing;
	assert.deepEqual(writes, [Array(8).fill(1), Array(8).fill(2)]);
});

test("stops a looping animation without overlapping writes", async () => {
	const { device, writes } = fixture();
	await device.playAnimation([new Uint8Array(8).fill(3)], { frameDurationMs: 20, loop: true });
	assert.equal(writes.length, 3);
});

test("validates all animation input before sending", async () => {
	const { device, writes } = fixture();
	await assert.rejects(device.playAnimation([], {}), /at least one/);
	await assert.rejects(device.playAnimation([new Uint8Array(7)], {}), /exactly 8/);
	await assert.rejects(device.playAnimation([new Uint8Array(8)], { frameDurationMs: 19 }), /20/);
	assert.equal(writes.length, 0);
});
