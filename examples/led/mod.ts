import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder, { KEY_EVENT } from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainPIR, { PIR_STATUS } from "m5chainPIR";
import M5ChainToF from "m5chainToF";
import M5Chain, { type RegisteredM5ChainDevice } from "m5chain";

type LedColor = {
	r: number;
	g: number;
	b: number;
};

const LOG_PREFIX = "[examples/led]";
const ENCODER_STEPS_PER_TURN = 36;
const KEY_BRIGHTNESS_LEVELS = [0.1, 0.5, 1];
const KEY_COLORS: LedColor[] = [
	{ r: 255, g: 0, b: 0 },
	{ r: 0, g: 255, b: 0 },
	{ r: 0, g: 0, b: 255 },
];
const TOF_MAX_DISTANCE_MM = 2000;
const TOF_MIN_BRIGHTNESS = 0.1;
const LED_DEVICE_CLASSES = Object.freeze([
	M5ChainEncoder,
	M5ChainAngle,
	M5ChainKey,
	M5ChainJoyStick,
	M5ChainToF,
	M5ChainPIR,
]);
type LedDevice = RegisteredM5ChainDevice<typeof LED_DEVICE_CLASSES>;

export async function main() {
	log("start");

	const m5chain = new M5Chain({ deviceClasses: LED_DEVICE_CLASSES });

	m5chain.onError = (error, context) => {
		log(`${context.source} failed: ${errorMessage(error)}`);
	};

	m5chain.onDeviceListChanged = (devices) => {
		log(`found ${devices.length} device(s)`);

		for (const device of devices) {
			attachDeviceHandlers(device);
		}
	};

	await m5chain.start();
}

function attachDeviceHandlers(device: LedDevice) {
	switch (device.kind) {
		case "encoder": {
			let hue = 0;

			device.onSample = async (delta) => {
				hue = wrapUnit(hue + delta / ENCODER_STEPS_PER_TURN);
				const color = hsvToRgb(hue, 1, 0.8);
				log(`${deviceLabel(device)} delta=${delta}`);
				await device.setLedColor(color.r, color.g, color.b);
			};
			break;
		}

		case "angle":
			device.onSample = async (angle) => {
				const color = hsvToRgb(angle, 1, angle);
				log(`${deviceLabel(device)} angle=${angle}`);
				await device.setLedColor(color.r, color.g, color.b);
			};
			break;

		case "key": {
			let step = 0;

			device.onPush = async (event) => {
				log(`${deviceLabel(device)} key event=${event}`);
				if (event !== KEY_EVENT.SINGLE_CLICK) return;

				step = (step + 1) % (KEY_COLORS.length * KEY_BRIGHTNESS_LEVELS.length);
				const color = KEY_COLORS[Math.floor(step / KEY_BRIGHTNESS_LEVELS.length)];
				const brightness = KEY_BRIGHTNESS_LEVELS[step % KEY_BRIGHTNESS_LEVELS.length];

				await device.setLedColor(color.r, color.g, color.b);
				await device.setLedBrightness(brightness);
			};
			break;
		}

		case "joystick":
			device.onSample = async (sample) => {
				const hue = normalizeJoystickAxis(sample.x);
				const brightness = normalizeJoystickAxis(-sample.y);
				const color = hsvToRgb(hue, 1, brightness);

				log(`${deviceLabel(device)} x=${sample.x} y=${sample.y}`);
				await device.setLedColor(color.r, color.g, color.b);
			};
			break;

		case "tof":
			device.onSample = async (distance) => {
				const brightness = clampUnit(1 - distance / TOF_MAX_DISTANCE_MM, TOF_MIN_BRIGHTNESS);
				const color = hsvToRgb(0.58, 1, brightness);

				log(`${deviceLabel(device)} distance=${distance} mm`);
				await device.setLedColor(color.r, color.g, color.b);
			};
			break;

		case "pir":
			device.onPresenceChanged = async (status) => {
				const detected = status === PIR_STATUS.PERSON_DETECTED;
				log(`${deviceLabel(device)} person detected=${detected}`);
				await device.setLedColor(detected ? 0 : 255, detected ? 255 : 0, 0);
			};
			break;

		case "unknown":
			log(`${deviceLabel(device)} is not supported by this example`);
			break;
	}
}

function hsvToRgb(hue: number, saturation: number, brightness: number): LedColor {
	const h = clampUnit(hue);
	const s = clampUnit(saturation);
	const v = clampUnit(brightness);
	const section = Math.floor(h * 6);
	const fraction = h * 6 - section;
	const p = v * (1 - s);
	const q = v * (1 - fraction * s);
	const t = v * (1 - (1 - fraction) * s);
	const [r, g, b] = [
		[v, t, p],
		[q, v, p],
		[p, v, t],
		[p, q, v],
		[t, p, v],
		[v, p, q],
	][section % 6];

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255),
	};
}

function normalizeJoystickAxis(value: number) {
	return clampUnit((value + 128) / 255);
}

function clampUnit(value: number, minimum = 0) {
	return Math.max(minimum, Math.min(1, value));
}

function wrapUnit(value: number) {
	return ((value % 1) + 1) % 1;
}

function deviceLabel(device: LedDevice) {
	return `${device.kind} id=${device.id}`;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function log(message: string) {
	trace(`${LOG_PREFIX} ${message}\n`);
}
