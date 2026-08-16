import { M5CHAIN_DEVICE_CLASSES, type M5ChainDevice } from "m5chainDevices";
import { KEY_EVENT, type KeyEvent } from "m5chainEncoder";
import type { JoystickValue } from "m5chainJoyStick";
import { PIR_STATUS } from "m5chainPIR";
import M5Chain from "m5chain";

const LOG_PREFIX = "[examples/basic]";

export async function main() {
	log("start");

	const m5chain = new M5Chain({ deviceClasses: M5CHAIN_DEVICE_CLASSES });

	m5chain.onError = (error, context) => {
		log(`${context.source} failed: ${errorMessage(error)}`);
	};

	m5chain.onDeviceListChanged = async (devices) => {
		log(`found ${devices.length} device(s)`);

		for (const device of devices) {
			attachDeviceHandlers(device);
		}

		for (const device of devices) {
			await logDeviceInfo(device);
		}
	};

	await m5chain.start();
}

function attachDeviceHandlers(device: M5ChainDevice) {
	device.onDisconnected = () => {
		log(`${deviceLabel(device)} disconnected`);
	};

	switch (device.kind) {
		case "encoder":
			device.onPush = (event: KeyEvent) => logKeyEvent(device, event);
			device.onSample = (sample: number) => {
				log(`${deviceLabel(device)} delta=${sample}`);
			};
			break;

		case "angle":
			device.onSample = (sample: number) => {
				log(`${deviceLabel(device)} angle=${sample}`);
			};
			break;

		case "key":
			device.onPush = (event: KeyEvent) => logKeyEvent(device, event);
			break;

		case "joystick":
			device.onPush = (event: KeyEvent) => logKeyEvent(device, event);
			device.onSample = (sample: JoystickValue) => {
				log(`${deviceLabel(device)} x=${sample.x} y=${sample.y}`);
			};
			break;

		case "tof":
			device.onSample = (sample: number) => {
				log(`${deviceLabel(device)} distance=${sample} mm`);
			};
			break;

		case "pir":
			device.onPresenceChanged = (status) => {
				const detected = status === PIR_STATUS.PERSON_DETECTED;
				log(`${deviceLabel(device)} person detected=${detected}`);
			};
			break;

		case "buzzer":
			log(`${deviceLabel(device)} ready`);
			break;

		case "mono":
		case "rgb":
			log(`${deviceLabel(device)} ${device.width}x${device.height} display ready`);
			break;

		case "unknown":
			log(`${deviceLabel(device)} is not supported by this library`);
			break;
	}
}

async function logDeviceInfo(device: M5ChainDevice) {
	const [bootloaderVersion, firmwareVersion] = await Promise.all([
		device.getBootloaderVersion(),
		device.getFirmwareVersion(),
	]);
	log(`${deviceLabel(device)} uid=${device.uuid} bootloader=${bootloaderVersion} firmware=${firmwareVersion}`);
}

function logKeyEvent(device: M5ChainDevice, event: KeyEvent) {
	log(`${deviceLabel(device)} key=${keyEventName(event)}`);
}

function deviceLabel(device: M5ChainDevice) {
	return `${device.kind} id=${device.id}`;
}

function keyEventName(event: KeyEvent) {
	switch (event) {
		case KEY_EVENT.SINGLE_CLICK:
			return "single click";
		case KEY_EVENT.DOUBLE_CLICK:
			return "double click";
		case KEY_EVENT.LONG_PRESS:
			return "long press";
		default:
			return `unknown(${event})`;
	}
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function log(message: string) {
	trace(`${LOG_PREFIX} ${message}\n`);
}
