import { BLEKeyboard } from "bleKeyboard";
import M5ChainKey, { KEY_MODE, type KeyEvent } from "m5chainKey";
import M5Chain from "m5chain";

import config from "mc/config";

const keyboard = new BLEKeyboard({
	deviceName: "M5Chain Enter",
});

export async function main() {
	trace("[m5chain example] ble-keyboard\n");

	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = async (devices) => {
		trace(`[ble-keyboard/main] device list changed: ${devices.length}\n`);

		for (const device of devices) {
			if (!(device instanceof M5ChainKey)) continue;

			await device.configure({ key: { mode: KEY_MODE.ACTIVE } });
			device.onPush = (keyEvent: KeyEvent) => {
				if (keyboard.notifyKey({ keyCode: BLEKeyboard.KEY_CODE.ENTER })) {
					trace(`[ble-keyboard/main] key event ${keyEvent}; sent Enter\n`);
				} else {
					trace(`[ble-keyboard/main] key event ${keyEvent}; skipped Enter: no subscribed BLE host\n`);
				}
			};
			trace(`[ble-keyboard/main] M5ChainKey ready: id=${device.id}\n`);
		}
	};

	await m5chain.start();
}

await main();
