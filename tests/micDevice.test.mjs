import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

const modules = Object.fromEntries(
	[
		["canSample", "deviceFeatures/canSample"],
		["hasLed", "deviceFeatures/hasLed"],
		["m5chainDevice", "m5chainDevices/m5chainDevice"],
		["micProtocol", "micProtocol"],
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

const {
	default: M5ChainMIC,
	MIC_REPORT_MODE,
	MIC_TRIGGER,
} = await import("../src/m5chain/m5chainDevices/m5chainMIC.ts");

function response(...data) {
	const packet = new Uint8Array(9 + data.length);
	packet.set(data, 6);
	return packet;
}

function createBus() {
	const requests = [];
	const bus = {
		cmdBuffer: new Uint8Array(64),
		maxPayloadSize: 64,
		_notifyPollingStateChanged() {},
		sendPacket() {},
		async sendAndWait(id, cmd, data, size) {
			requests.push({ id, cmd, data: Array.from(data.subarray(0, size)) });
			switch (cmd) {
				case 0x30:
					return response(0xbc, 0x0a);
				case 0x31:
					return response(0xab);
				case 0x33:
					return response(0x00, 0x08);
				case 0xe2:
					return response(MIC_REPORT_MODE.ENABLED);
				case 0xe4:
					return response(0xf4, 0x01);
				default:
					return response(1);
			}
		},
		async sendAndWaitForResult(id, cmd, data, size) {
			return this.sendAndWait(id, cmd, data, size);
		},
	};
	return { bus, requests };
}

test("configures and reads every Chain MIC setting", async () => {
	const { bus, requests } = createBus();
	const device = new M5ChainMIC(bus, { id: 3, type: 10 });

	await device.configure({
		threshold: 2048,
		reportMode: MIC_REPORT_MODE.ENABLED,
		triggerIntervalMs: 500,
		saveToFlash: true,
	});
	assert.deepEqual(requests.splice(0), [
		{ id: 3, cmd: 0x32, data: [0x00, 0x08, 1] },
		{ id: 3, cmd: 0xe1, data: [1] },
		{ id: 3, cmd: 0xe3, data: [0xf4, 0x01] },
	]);

	assert.deepEqual(await device.readConfiguration(), {
		threshold: 2048,
		reportMode: MIC_REPORT_MODE.ENABLED,
		triggerIntervalMs: 500,
	});
	assert.deepEqual(
		requests.splice(0).map(({ cmd, data }) => ({ cmd, data })),
		[
			{ cmd: 0x33, data: [] },
			{ cmd: 0xe2, data: [] },
			{ cmd: 0xe4, data: [] },
		],
	);
});

test("reads MIC values and dispatches threshold events", async () => {
	const { bus } = createBus();
	const device = new M5ChainMIC(bus, { id: 1, type: 10 });

	assert.equal(await device.readSample(), 0x0abc);
	assert.equal(await device.getMic12Adc(), 0x0abc);
	assert.equal(await device.getMic8Adc(), 0xab);

	let reported;
	device.onThresholdCrossed = (trigger) => {
		reported = trigger;
	};
	const event = new Uint8Array(11);
	event[6] = 0x00;
	event[7] = 0x03;
	device.onDispatchEvent(event);
	assert.equal(reported, MIC_TRIGGER.LOW_THRESHOLD);
});

test("rejects invalid Chain MIC configuration before sending it", async () => {
	const { bus, requests } = createBus();
	const device = new M5ChainMIC(bus, { id: 1, type: 10 });

	await assert.rejects(device.configure({ threshold: 4096 }), /integer between 0 and 4095/);
	await assert.rejects(device.configure({ triggerIntervalMs: 299 }), /integer between 300 and 1000/);
	await assert.rejects(device.configure({ reportMode: MIC_REPORT_MODE.ENABLED, saveToFlash: true }), /requires/);
	assert.deepEqual(requests, []);
});
