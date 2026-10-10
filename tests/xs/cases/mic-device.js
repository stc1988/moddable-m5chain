/*---
description: validates Chain MIC device behavior on XS
flags: [module, async]
---*/

import M5ChainMIC, { MIC_REPORT_MODE, MIC_TRIGGER } from "m5chainMIC";
import { assertDeepEqual, assertRejects } from "./assertions_FIXTURE.js";

$TESTMC.timeout(15_000, "MIC device tests timed out");

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

async function main() {
	{
		const { bus, requests } = createBus();
		const device = new M5ChainMIC(bus, { id: 3, type: 10 });
		await device.configure({
			threshold: 2048,
			reportMode: MIC_REPORT_MODE.ENABLED,
			triggerIntervalMs: 500,
			saveToFlash: true,
		});
		assertDeepEqual(requests.splice(0), [
			{ id: 3, cmd: 0x32, data: [0x00, 0x08, 1] },
			{ id: 3, cmd: 0xe1, data: [1] },
			{ id: 3, cmd: 0xe3, data: [0xf4, 0x01] },
		]);
		assertDeepEqual(await device.readConfiguration(), {
			threshold: 2048,
			reportMode: MIC_REPORT_MODE.ENABLED,
			triggerIntervalMs: 500,
		});
		assertDeepEqual(
			requests.splice(0).map(({ cmd, data }) => ({ cmd, data })),
			[
				{ cmd: 0x33, data: [] },
				{ cmd: 0xe2, data: [] },
				{ cmd: 0xe4, data: [] },
			],
		);
	}
	{
		const { bus } = createBus();
		const device = new M5ChainMIC(bus, { id: 1, type: 10 });
		assert.sameValue(await device.readSample(), 0x0abc);
		assert.sameValue(await device.getMic12Adc(), 0x0abc);
		assert.sameValue(await device.getMic8Adc(), 0xab);
		let reported;
		device.onThresholdCrossed = (trigger) => {
			reported = trigger;
		};
		const event = new Uint8Array(11);
		event[6] = 0x00;
		event[7] = 0x03;
		device.onDispatchEvent(event);
		assert.sameValue(reported, MIC_TRIGGER.LOW_THRESHOLD);
	}
	{
		const { bus, requests } = createBus();
		const device = new M5ChainMIC(bus, { id: 1, type: 10 });
		await assertRejects(device.configure({ threshold: 4096 }), /integer between 0 and 4095/);
		await assertRejects(device.configure({ triggerIntervalMs: 299 }), /integer between 300 and 1000/);
		await assertRejects(device.configure({ reportMode: MIC_REPORT_MODE.ENABLED, saveToFlash: true }), /requires/);
		assertDeepEqual(requests, []);
	}
}

main().then($DONE, $DONE);
