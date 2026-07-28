import M5Chain, { KEY_EVENT, type KeyEvent, type M5ChainDevice } from "m5chain";

const LOG_PREFIX = "[examples/basic]";

export async function main() {
	log("start");

	const m5chain = new M5Chain();

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
			device.onSample = function () {
				const sample = this.sample();
				if (sample !== undefined) {
					log(`${deviceLabel(device)} delta=${sample}`);
				}
			};
			break;

		case "angle":
			device.onSample = function () {
				const sample = this.sample();
				if (sample !== undefined) {
					log(`${deviceLabel(device)} angle=${sample}`);
				}
			};
			break;

		case "key":
			device.onPush = (event: KeyEvent) => logKeyEvent(device, event);
			break;

		case "joystick":
			device.onPush = (event: KeyEvent) => logKeyEvent(device, event);
			device.onSample = function () {
				const sample = this.sample();
				if (sample !== undefined) {
					log(`${deviceLabel(device)} x=${sample.x} y=${sample.y}`);
				}
			};
			break;

		case "tof":
			device.onSample = function () {
				const sample = this.sample();
				if (sample !== undefined) {
					log(`${deviceLabel(device)} distance=${sample} mm`);
				}
			};
			break;

		case "unknown":
			log(`${deviceLabel(device)} is not supported by this library`);
			break;
	}
}

async function logDeviceInfo(device: M5ChainDevice) {
	const bootloaderVersion = await device.getBootloaderVersion();
	const firmwareVersion = await device.getFirmwareVersion();
	log(`${deviceLabel(device)} uid=${device.uuid} bootloader=${bootloaderVersion} firmware=${firmwareVersion}`);
}

function logKeyEvent(device: M5ChainDevice, event: KeyEvent) {
	log(`${deviceLabel(device)} key=${keyEventName(event)}`);
}

function deviceLabel(device: M5ChainDevice) {
	return `${device.kind} id=${device.id} type=0x${device.type.toString(16).padStart(4, "0")}`;
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
