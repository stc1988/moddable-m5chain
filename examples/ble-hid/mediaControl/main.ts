import { BLEMediaControl, type ConsumerControlUsage } from "mediaControl";
import M5ChainKey, { KEY_EVENT, KEY_MODE, type KeyEvent } from "m5chainKey";
import M5Chain from "m5chain";

import config from "mc/config";

const mediaControl = new BLEMediaControl({
	deviceName: "M5Chain Media",
});

export async function main() {
	trace("[m5chain example] ble-media-control\n");

	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = async (devices) => {
		trace(`[ble-media-control/main] device list changed: ${devices.length}\n`);

		for (const device of devices) {
			if (!(device instanceof M5ChainKey)) continue;

			await device.configure({ key: { mode: KEY_MODE.ACTIVE } });
			device.onPush = (keyEvent: KeyEvent) => {
				const action = mediaActionForKeyEvent(keyEvent);
				if (!action) return;

				if (mediaControl.notifyUsage(action.usage)) {
					trace(`[ble-media-control/main] key event ${keyEvent}; sent ${action.label}\n`);
				} else {
					trace(`[ble-media-control/main] key event ${keyEvent}; skipped ${action.label}: no subscribed BLE host\n`);
				}
			};
			trace(`[ble-media-control/main] M5ChainKey ready: id=${device.id}\n`);
		}
	};

	await m5chain.start();
}

function mediaActionForKeyEvent(keyEvent: KeyEvent): { usage: ConsumerControlUsage; label: string } | undefined {
	switch (keyEvent) {
		case KEY_EVENT.SINGLE_CLICK:
			return { usage: BLEMediaControl.USAGE.PLAY_PAUSE, label: "Play/Pause" };
		case KEY_EVENT.DOUBLE_CLICK:
			return { usage: BLEMediaControl.USAGE.SCAN_NEXT_TRACK, label: "Next Track" };
		case KEY_EVENT.LONG_PRESS:
			return { usage: BLEMediaControl.USAGE.SCAN_PREVIOUS_TRACK, label: "Previous Track" };
		default:
			return undefined;
	}
}

await main();
