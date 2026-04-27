import M5Chain, { KEY_EVENT, type KeyEvent } from "m5chain";
import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainToF from "m5chainToF";
import type { JoystickValue } from "m5chainJoyStick";

//import config from "mod/config";

type M5ChainExampleDevice = M5ChainEncoder | M5ChainAngle | M5ChainKey | M5ChainJoyStick | M5ChainToF;

type DeviceWithInfo = M5ChainExampleDevice & {
	getBootloaderVersion(): Promise<number>;
	getFirmwareVersion(): Promise<number>;
};

function isExampleDevice(device: unknown): device is DeviceWithInfo {
	if (typeof device !== "object" || device === null) {
		return false;
	}
	return (
		device instanceof M5ChainEncoder ||
		device instanceof M5ChainAngle ||
		device instanceof M5ChainKey ||
		device instanceof M5ChainJoyStick ||
		device instanceof M5ChainToF
	);
}

export async function main() {
	// if config is not defined in manifest file, use device.I2C.default.data and clock.
	const m5chain = new M5Chain({
		//		transmit: config.m5chain.transmit,
		//		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = async (devices) => {
		trace("device list changed\n");

		for (const device of devices) {
			if (!isExampleDevice(device)) {
				continue;
			}
			attachDevice(device);
			fetchDeviceInfo(device);
		}
	};

	m5chain.start();
}

async function fetchDeviceInfo(device: DeviceWithInfo) {
	const bootloaderVersion = await device.getBootloaderVersion();
	const firmwareVersion = await device.getFirmwareVersion();
	trace(
		`Device ID: ${device.id}, Type: ${device.type.toString(16)}, UID: ${device.uuid}, Bootloader Version: ${bootloaderVersion}, Firmware Version: ${firmwareVersion}\n`,
	);
}

function attachDevice(device: M5ChainExampleDevice) {
	if (device instanceof M5ChainEncoder) {
		attachEncoder(device);
		return;
	}
	if (device instanceof M5ChainAngle) {
		attachAngle(device);
		return;
	}
	if (device instanceof M5ChainKey) {
		attachKey(device);
		return;
	}
	if (device instanceof M5ChainJoyStick) {
		attachJoyStick(device);
		return;
	}
	if (device instanceof M5ChainToF) {
		attachToF(device);
	}
}

function keyEventName(keyEvent: KeyEvent): string {
	switch (keyEvent) {
		case KEY_EVENT.SINGLE_CLICK:
			return "single click";
		case KEY_EVENT.DOUBLE_CLICK:
			return "double click";
		case KEY_EVENT.LONG_PRESS:
			return "long press";
		default:
			return `unknown(${keyEvent})`;
	}
}

function attachEncoder(device: M5ChainEncoder) {
	device.onPush = (keyEvent: KeyEvent) => {
		trace(`Encoder Device ID\t: ${device.id}, Key Event\t: ${keyEventName(keyEvent)}\n`);
	};

	device.onPoll = (value: number) => {
		trace(`Encoder Device ID\t: ${device.id}, encode value\t: ${value}\n`);
	};
}

function attachAngle(device: M5ChainAngle) {
	device.onPoll = (value: number) => {
		trace(`Angle Device ID\t: ${device.id}, angle value\t: ${value}\n`);
	};
}

function attachKey(device: M5ChainKey) {
	device.onPush = (keyEvent: KeyEvent) => {
		trace(`Key Device ID\t: ${device.id}, Key Event\t: ${keyEventName(keyEvent)}\n`);
	};
}

function attachJoyStick(device: M5ChainJoyStick) {
	device.onPush = (keyEvent: KeyEvent) => {
		trace(`JoyStick Device ID\t: ${device.id}, Key Event\t: ${keyEventName(keyEvent)}\n`);
	};

	device.onPoll = (position: JoystickValue) => {
		trace(`JoyStick Device ID\t: ${device.id}, value\t: x:${position.x}\ty:${position.y}\n`);
	};
}

function attachToF(device: M5ChainToF) {
	device.onPoll = (distance: number) => {
		trace(`ToF Device ID	: ${device.id}, distance	: ${distance} mm\n`);
	};
}
