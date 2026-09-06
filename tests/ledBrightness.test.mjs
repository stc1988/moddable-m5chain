import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

// Resolve the device modules using the same names as the Moddable manifests.
const modules = Object.fromEntries(
	[
		["m5chainDevice", "m5chainDevices/m5chainDevice"],
		["m5chainMatrixDisplay", "m5chainDevices/m5chainMatrixDisplay"],
		["matrixDisplayProtocol", "matrixDisplayProtocol"],
	].map(([name, path]) => [name, new URL(`../src/m5chain/${path}.ts`, import.meta.url).href]),
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
const { M5ChainDevice } = await import("../src/m5chain/m5chainDevices/m5chainDevice.ts");
const { default: HasLed } = await import("../src/m5chain/deviceFeatures/hasLed.ts");
const { default: RGB } = await import("../src/m5chain/m5chainDevices/m5chainRGB.ts");
const { default: Mono } = await import("../src/m5chain/m5chainDevices/m5chainMono.ts");

for (const [name, Device, set, get, setCommand, getCommand, maximum, middle, readMiddle] of [
	["HasLed", HasLed(M5ChainDevice), "setLedBrightness", "getLedBrightness", 0x22, 0x23, 100, 50, 128],
	["RGB", RGB, "setBrightness", "getBrightness", 0xe2, 0xe3, 100, 50, 128],
	["Mono", Mono, "setBrightness", "getBrightness", 0xe2, 0xe3, 7, 4, 146],
]) {
	test(`${name} brightness preserves protocol levels and async failures with byte-scale values`, async () => {
		let level = 0;
		let fail = false;
		const writes = [];
		const bus = {
			cmdBuffer: new Uint8Array(256),
			async sendAndWait(id, command, data, size) {
				assert.equal(id, 1);
				if (fail) throw new Error("transport failed");
				if (command === setCommand) {
					writes.push(Array.from(data.subarray(0, size)));
					level = data[0];
					return new Uint8Array([0, 0, 0, 0, 0, 0, 1]);
				}
				assert.equal(command, getCommand);
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
			assert.deepEqual(writes.at(-1), [wire, 0]);
			assert.equal(await device[get](), output);
		}
		await device[set](255, true);
		assert.deepEqual(writes.at(-1), [maximum, 1]);
		const count = writes.length;
		for (const invalid of [-1, 256, 0.5, Number.NaN, Infinity, "128"]) {
			await assert.rejects(device[set](invalid), RangeError);
		}
		assert.equal(writes.length, count);
		level = maximum + 1;
		await assert.rejects(device[get](), RangeError);
		fail = true;
		await assert.rejects(device[set](128), /transport failed/);
		await assert.rejects(device[get](), /transport failed/);
	});
}
