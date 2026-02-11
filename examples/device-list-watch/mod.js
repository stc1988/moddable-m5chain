import M5Chain from "m5chain";

import config from "mod/config";

function formatDevice(device) {
	return `id:${device.id} type:0x${device.type.toString(16)} uuid:${device.uuid}`;
}

export async function main() {
	const knownDevices = new Map();

	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = (devices) => {
		const nextDevices = new Map();
		for (const device of devices) {
			nextDevices.set(device.uuid, device);
		}

		let hasChange = false;

		for (const [uuid, device] of nextDevices) {
			if (!knownDevices.has(uuid)) {
				hasChange = true;
				trace(`added   ${formatDevice(device)}\n`);
			}
		}

		for (const [uuid, device] of knownDevices) {
			if (!nextDevices.has(uuid)) {
				hasChange = true;
				trace(`removed ${formatDevice(device)}\n`);
			}
		}

		if (!hasChange) {
			trace(`device list refreshed (${devices.length} devices, no add/remove)\n`);
		}

		knownDevices.clear();
		for (const [uuid, device] of nextDevices) {
			knownDevices.set(uuid, device);
		}
	};

	trace("start watching m5chain device list changes\n");
	m5chain.start();
}
