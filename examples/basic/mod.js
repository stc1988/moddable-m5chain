import M5Chain from "m5chain";
import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
// import M5ChainToF from "m5chainToF";

import config from "mod/config";

export async function main() {
	// if config is not defined in manifest file, use device.I2C.default.data and clock.
	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});
	const deviceList = await m5chain.scan();
	trace(`Connected ${deviceList.length} devices:\n`);
	for (const device of deviceList) {
		const uid = await device.getUID();
		const bootloaderVersion = await device.getBootloaderVersion();
		const firmwareVersion = await device.getFirmwareVersion();
		trace(
			`Device ID: ${device.id}, Type: ${device.type.toString(16)}, UID: ${uid}, Bootloader Version: ${bootloaderVersion}, Firmware Version: ${firmwareVersion}\n`,
		);
	}

	const encoderDevice = deviceList.find((device) => device.type === M5ChainEncoder.DEVICE_TYPE);
	if (encoderDevice) {
		encoderDevice.onKeyPressed = (keyStatus) => {
			trace(`Encoder Device ID\t: ${encoderDevice.id}, Key Status\t: ${keyStatus}\n`);
		};
		encoderDevice.onPoll = (value) => {
			trace(`Encoder Device ID\t ${encoderDevice.id}, encode value\t: ${value}\n`);
		};
	}

	const angleDevice = deviceList.find((device) => device.type === M5ChainAngle.DEVICE_TYPE);
	if (angleDevice) {
		angleDevice.onPoll = (value) => {
			trace(`Angle Device ID\t: ${angleDevice.id}, angle value\t: ${value}\n`);
		};
	}

	const keyDevice = deviceList.find((device) => device.type === M5ChainKey.DEVICE_TYPE);
	if (keyDevice) {
		keyDevice.onKeyPressed = (keyStatus) => {
			trace(`Key Device ID\t: ${keyDevice.id}, Key Status\t: ${keyStatus}\n`);
		};
	}
	const joystickDevice = deviceList.find((device) => device.type === M5ChainJoyStick.DEVICE_TYPE);
	if (joystickDevice) {
		joystickDevice.onKeyPressed = (keyStatus) => {
			trace(`JoyStick Device ID\t: ${joystickDevice.id}, Key Status\t: ${keyStatus}\n`);
		};
		joystickDevice.onPoll = (position) => {
			trace(`JoyStick Device ID\t: ${joystickDevice.id}, value\t: x:${position.x}\ty:${position.y}\n`);
		};
	}
}
