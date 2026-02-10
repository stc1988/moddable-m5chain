import M5Chain from "m5chain";
import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";

import config from "mod/config";

function hsvToRGB(h, s, v) {
	h = Math.max(0, Math.min(1, h));
	s = Math.max(0, Math.min(1, s));
	v = Math.max(0, Math.min(1, v));

	const i = Math.floor(h * 6);
	const f = h * 6 - i;

	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);

	let r = 0,
		g = 0,
		bl = 0;

	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			bl = p;
			break;
		case 1:
			r = q;
			g = v;
			bl = p;
			break;
		case 2:
			r = p;
			g = v;
			bl = t;
			break;
		case 3:
			r = p;
			g = q;
			bl = v;
			break;
		case 4:
			r = t;
			g = p;
			bl = v;
			break;
		case 5:
			r = v;
			g = p;
			bl = q;
			break;
	}

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(bl * 255),
	};
}
function norm(v) {
	// -128..127 → 0.0..1.0
	return Math.max(0, Math.min(1, (v + 128) / 255));
}

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
		}
	};

	m5chain.start();
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
	let phase = 0;
	const STEP = 1 / 36;
	device.onPoll = async (value) => {
		trace(`Encoder Device ID\t ${device.id}, encode value\t: ${value}\n`);
		phase += value * STEP;
		phase = ((phase % 1) + 1) % 1;
		const { r, g, b } = hsvToRGB(phase, 1.0, 0.8);
		await device.setLedColor(r, g, b);
	};
}

function attachAngle(device) {
	device.onPoll = async (value) => {
		trace(`Angle Device ID\t: ${device.id}, angle value\t: ${value}\n`);
		const { r, g, b } = hsvToRGB(value, 1.0, value);
		await device.setLedColor(r, g, b);
	};
}

function attachKey(device) {
	let step = 0;
	device.onKeyPressed = async (keyStatus) => {
		trace(`Key Device ID\t: ${device.id}, Key Status\t: ${keyStatus}\n`);
		if (keyStatus === 0) {
			step = (step + 1) % 9;
			const levels = [0.1, 0.5, 1];
			const brightness = levels[step % 3];
			const color = Math.floor(step / 3);

			if (color === 0) {
				await device.setLedColor(255, 0, 0);
			} else if (color === 1) {
				await device.setLedColor(0, 255, 0);
			} else {
				await device.setLedColor(0, 0, 255);
			}
			await device.setLedBrightness(brightness);
		}
	};
}

function attachJoyStick(device) {
	device.onPoll = async (position) => {
		trace(`JoyStick Device ID\t: ${device.id}, value\t: x:${position.x}\ty:${position.y}\n`);
		const hue = norm(position.x);
		const brightness = norm(-position.y);
		const saturation = 1.0;
		const { r, g, b } = hsvToRGB(hue, saturation, brightness);
		await device.setLedColor(r, g, b);
	};
}
