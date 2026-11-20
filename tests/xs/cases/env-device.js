/*---
description: validates Chain ENV sampling, configuration, calibration, and warnings on XS
flags: [module, async]
---*/

import { M5CHAIN_DEVICE_CLASSES } from "m5chainDevices";
import M5ChainENV, { ENV_RATE, ENV_REPORT_MODE, ENV_TEMPERATURE_SOURCE } from "m5chainENV";
import { assertDeepEqual, assertRejects, assertThrows } from "./assertions_FIXTURE.js";

$TESTMC.timeout(15_000, "ENV device tests timed out");

function response(...data) {
	const packet = new Uint8Array(9 + data.length);
	packet.set(data, 6);
	return packet;
}
const replies = {
	48: [0x2e, 0xfb, 65], // -12.34 °C
	49: [0x29, 0x09, 0x95, 0x27, 0xc7, 0xcf, 0xff, 0xff], // 23.45 °C, 1013.3 hPa, -123.45 m
	51: [2],
	53: [3],
	55: [0x95, 0x27],
	226: [15],
	228: [0, 10, 40],
	230: [20, 80],
	232: [0x1c, 0x25, 0x04, 0x29],
	234: [0, 0, 0, 0, 0xa0, 0x86, 1, 0],
};
function createBus() {
	const requests = [];
	const bus = {
		cmdBuffer: new Uint8Array(64),
		maxPayloadSize: 64,
		_notifyPollingStateChanged() {},
		async sendAndWait(id, cmd, data, size, options) {
			requests.push({ id, cmd, data: Array.from(data.subarray(0, size)), timeoutMs: options?.timeoutMs ?? 800 });
			return response(...(replies[cmd] ?? [1]));
		},
	};
	return { bus, requests };
}
async function main() {
	const { bus, requests } = createBus();
	const device = new M5ChainENV(bus, { id: 3, type: 15 });
	assert.sameValue(device.kind, "env");
	assert.sameValue(device.type, 15);
	assert(M5CHAIN_DEVICE_CLASSES.includes(M5ChainENV));
	assert.sameValue(typeof device.setLedColor, "function");
	assertDeepEqual(await device.getAHT20Data(), { temperature: -12.34, humidity: 65 });
	assertDeepEqual(await device.getSPA06Data(), { temperature: 23.45, pressure: 1013.3, altitude: -123.45 });
	const sample = await device.readSample();
	assertDeepEqual(sample, {
		temperature: -12.34,
		humidity: 65,
		pressureTemperature: 23.45,
		pressure: 1013.3,
		altitude: -123.45,
	});
	assert.sameValue(device.sample(), undefined);
	let count = 0;
	device.onSample = (value) => {
		value.temperature = 100;
		count++;
	};
	device.dispatchOnSample(sample);
	device.dispatchOnSample(sample);
	assert.sameValue(count, 2);
	const cached = device.sample();
	cached.humidity = 0;
	assertDeepEqual(device.sample(), sample);
	requests.length = 0;
	await device.configure({
		temperatureRate: ENV_RATE.HZ_4,
		pressureRate: ENV_RATE.HZ_8,
		seaLevelPressure: 1013.3,
		saveToFlash: true,
		reportMode: ENV_REPORT_MODE.ALL,
		temperatureThreshold: { source: ENV_TEMPERATURE_SOURCE.SPA06, low: 10, high: 40 },
		humidityThreshold: { low: 20, high: 80 },
		pressureThreshold: { low: 950, high: 1050 },
		altitudeThreshold: { low: -123.45, high: 1000 },
	});
	assertDeepEqual(
		requests.map(({ cmd, data }) => ({ cmd, data })),
		[
			{ cmd: 0x32, data: [2] },
			{ cmd: 0x34, data: [3] },
			{ cmd: 0x36, data: [0x95, 0x27, 1] },
			{ cmd: 0xe1, data: [15] },
			{ cmd: 0xe3, data: [1, 10, 40] },
			{ cmd: 0xe5, data: [20, 80] },
			{ cmd: 0xe7, data: [0x1c, 0x25, 0x04, 0x29] },
			{ cmd: 0xe9, data: [0xc7, 0xcf, 0xff, 0xff, 0xa0, 0x86, 1, 0] },
		],
	);
	assertDeepEqual(await device.readConfiguration(), {
		temperatureRate: 2,
		pressureRate: 3,
		seaLevelPressure: 1013.3,
		reportMode: 15,
		temperatureThreshold: { source: 0, low: 10, high: 40 },
		humidityThreshold: { low: 20, high: 80 },
		pressureThreshold: { low: 950, high: 1050 },
		altitudeThreshold: { low: 0, high: 1000 },
	});
	await device.calibrateSeaLevelPressure(-123.45, true);
	assertDeepEqual(requests.at(-1), { id: 3, cmd: 0x38, data: [0xc7, 0xcf, 0xff, 0xff, 1], timeoutMs: 10000 });
	let warning;
	device.onWarning = (value) => {
		warning = value;
	};
	device.onDispatchEvent(response(0xe4, 0x0f));
	assertDeepEqual(warning, { temperature: 0, humidity: 1, pressure: 2, altitude: 3 });
	assertThrows(() => device.onDispatchEvent(response(0, 0)), /Unknown ENV/);
	assertThrows(() => {
		device.onWarning = 1;
	}, /function or null/);
	requests.length = 0;
	for (const options of [
		{ temperatureRate: 16 },
		{ pressureRate: -1 },
		{ reportMode: 16 },
		{ seaLevelPressure: 299.9 },
		{ seaLevelPressure: 1100.1 },
		{ seaLevelPressure: NaN },
		{ seaLevelPressure: 1013.25 },
		{ saveToFlash: true },
		{ seaLevelPressure: 1000, saveToFlash: 1 },
		{ temperatureThreshold: { source: 2, low: 10, high: 40 } },
		{ temperatureThreshold: { source: 0, low: -1, high: 40 } },
		{ humidityThreshold: { low: 20, high: 101 } },
		{ humidityThreshold: { low: 80, high: 20 } },
		{ pressureThreshold: { low: 699, high: 1000 } },
		{ altitudeThreshold: { low: -21474836.49, high: 1000 } },
		{ temperatureRate: 1, humidityThreshold: { low: 80, high: 20 } },
		{ unknown: true },
	])
		await assertRejects(device.configure(options), /must|requires|Unsupported/);
	await assertRejects(device.calibrateSeaLevelPressure(Infinity), /must/);
	await assertRejects(device.calibrateSeaLevelPressure(1, 1), /boolean/);
	assertDeepEqual(requests, []);
	bus.sendAndWait = async () => response();
	await assertRejects(device.getAHT20Data(), /payload length/);
	await assertRejects(device.getSPA06Data(), /payload length/);
	await assertRejects(device.configure({ reportMode: 0 }), /payload length/);
	bus.sendAndWait = async () => response(0);
	await assertRejects(device.configure({ reportMode: 0 }), /operation failed/);
	bus.sendAndWait = async () => {
		throw new Error("timeout");
	};
	await assertRejects(device.readSample(), /timeout/);
	device._markDisconnected();
	await assertRejects(device.getAHT20Data(), /disconnected/);
}
main().then($DONE, $DONE);
