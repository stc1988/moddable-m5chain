import M5Chain from "m5chain";
import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";

import config from "mod/config";

export async function main() {
	// if config is not defined in manifest file, use device.I2C.default.data and clock.
	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = async (devices) => {
		trace("device list changed\n");

		for (const device of devices) {
			attachDevice(device);
			fetchDeviceInfo(device);
		}
	};

	m5chain.start();
}

async function fetchDeviceInfo(device) {
	const bootloaderVersion = await device.getBootloaderVersion();
	const firmwareVersion = await device.getFirmwareVersion();
	trace(
		`Device ID: ${device.id}, Type: ${device.type.toString(16)}, UID: ${device.uuid}, Bootloader Version: ${bootloaderVersion}, Firmware Version: ${firmwareVersion}\n`,
	);
}

function attachDevice(device) {
	switch (device.type) {
		case M5ChainEncoder.DEVICE_TYPE:
			attachEncoder(device);
			break;
		case M5ChainAngle.DEVICE_TYPE:
			attachAngle(device);
			break;
		case M5ChainKey.DEVICE_TYPE:
			attachKey(device);
			break;
		case M5ChainJoyStick.DEVICE_TYPE:
			attachJoyStick(device);
			break;
	}
}

function attachEncoder(device) {
	device.onKeyPressed = (keyStatus) => {
		trace(`Encoder Device ID\t: ${device.id}, Key Status\t: ${keyStatus}\n`);
	};

	device.onPoll = (value) => {
		trace(`Encoder Device ID\t: ${device.id}, encode value\t: ${value}\n`);
	};
}

function attachAngle(device) {
	device.onPoll = (value) => {
		trace(`Angle Device ID\t: ${device.id}, angle value\t: ${value}\n`);
	};
}

function attachKey(device) {
	device.onKeyPressed = (keyStatus) => {
		trace(`Key Device ID\t: ${device.id}, Key Status\t: ${keyStatus}\n`);
	};
}

function attachJoyStick(device) {
	device.onKeyPressed = (keyStatus) => {
		trace(`JoyStick Device ID\t: ${device.id}, Key Status\t: ${keyStatus}\n`);
	};

	device.onPoll = (position) => {
		trace(`JoyStick Device ID\t: ${device.id}, value\t: x:${position.x}\ty:${position.y}\n`);
	};
}
