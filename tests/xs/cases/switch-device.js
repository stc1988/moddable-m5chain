/*---
description: validates Chain Switch device behavior on XS
flags: [module, async]
---*/

import M5ChainSwitch, { SWITCH_DIRECTION, SWITCH_REPORT_MODE, SWITCH_STATUS } from "m5chainSwitch";
import { assertDeepEqual, assertRejects } from "./assertions_FIXTURE.js";

$TESTMC.timeout(15_000, "Switch device tests timed out");

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
					return response(SWITCH_DIRECTION.DOWN_TO_UP_INCREASES);
				case 0x35:
					return response(0x7f, 0x0f, 0x50, 0x00);
				case 0x36:
					return response(SWITCH_STATUS.OPEN);
				case 0xe2:
					return response(SWITCH_REPORT_MODE.ENABLED);
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
		const device = new M5ChainSwitch(bus, { id: 3, type: 7 });
		await device.configure({
			direction: SWITCH_DIRECTION.DOWN_TO_UP_DECREASES,
			thresholds: { open: 3967, close: 80 },
			reportMode: SWITCH_REPORT_MODE.ENABLED,
			saveToFlash: true,
		});
		assertDeepEqual(requests.splice(0), [
			{ id: 3, cmd: 0x32, data: [0, 1] },
			{ id: 3, cmd: 0x34, data: [0x7f, 0x0f, 0x50, 0x00, 1] },
			{ id: 3, cmd: 0xe1, data: [1] },
		]);
		assertDeepEqual(await device.readConfiguration(), {
			direction: SWITCH_DIRECTION.DOWN_TO_UP_INCREASES,
			thresholds: { open: 3967, close: 80 },
			reportMode: SWITCH_REPORT_MODE.ENABLED,
		});
		assertDeepEqual(
			requests.splice(0).map(({ cmd, data }) => ({ cmd, data })),
			[
				{ cmd: 0x33, data: [] },
				{ cmd: 0x35, data: [] },
				{ cmd: 0xe2, data: [] },
			],
		);
	}
	{
		const { bus } = createBus();
		const device = new M5ChainSwitch(bus, { id: 1, type: 7 });
		assert.sameValue(await device.readSample(), 0x0abc);
		assert.sameValue(await device.getSwitch12Adc(), 0x0abc);
		assert.sameValue(await device.getSwitch8Adc(), 0xab);
		assert.sameValue(await device.getSwitchStatus(), SWITCH_STATUS.OPEN);
		assert.sameValue(await device.isOpen(), true);
		let reported;
		device.onSwitchChanged = (status) => {
			reported = status;
		};
		const event = new Uint8Array(11);
		event[6] = SWITCH_STATUS.CLOSED;
		event[7] = 0x04;
		device.onDispatchEvent(event);
		assert.sameValue(reported, SWITCH_STATUS.CLOSED);
	}
	{
		const { bus, requests } = createBus();
		const device = new M5ChainSwitch(bus, { id: 1, type: 7 });
		await assertRejects(device.configure({ thresholds: { open: 80, close: 3967 } }), /greater than/);
		await assertRejects(device.configure({ reportMode: SWITCH_REPORT_MODE.ENABLED, saveToFlash: true }), /requires/);
		assertDeepEqual(requests, []);
	}
}

main().then($DONE, $DONE);
