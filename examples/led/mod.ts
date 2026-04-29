import M5ChainAngle from "m5chainAngle";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainToF from "m5chainToF";
import M5Chain, { KEY_EVENT, type KeyEvent } from "m5chain";
import type { LedColor } from "types";

import config from "mod/config";

type SupportedLedDevice = M5ChainEncoder | M5ChainAngle | M5ChainKey | M5ChainJoyStick | M5ChainToF;

function isSupportedLedDevice(device: unknown): device is SupportedLedDevice {
	return (
		device instanceof M5ChainEncoder ||
		device instanceof M5ChainAngle ||
		device instanceof M5ChainKey ||
		device instanceof M5ChainJoyStick ||
		device instanceof M5ChainToF
	);
}

function hsvToRGB(h: number, s: number, v: number): LedColor {
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
function norm(v: number): number {
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
			if (!isSupportedLedDevice(device)) {
				continue;
			}
			attachDevice(device);
		}
	};

	m5chain.start();
}

function attachDevice(device: SupportedLedDevice) {
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

function attachEncoder(device: M5ChainEncoder) {
	let phase = 0;
	const STEP = 1 / 36;
	device.onSample = async function () {
		const sample = this.sample();
		if (sample === undefined) return;
		trace(`Encoder Device ID\t ${device.id}, encode value\t: ${sample}\n`);
		phase += sample * STEP;
		phase = ((phase % 1) + 1) % 1;
		const { r, g, b } = hsvToRGB(phase, 1.0, 0.8);
		await device.setLedColor(r, g, b);
	};
}

function attachAngle(device: M5ChainAngle) {
	device.onSample = async function () {
		const sample = this.sample();
		if (sample === undefined) return;
		trace(`Angle Device ID\t: ${device.id}, angle value\t: ${sample}\n`);
		const { r, g, b } = hsvToRGB(sample, 1.0, sample);
		await device.setLedColor(r, g, b);
	};
}

function attachKey(device: M5ChainKey) {
	let step = 0;
	device.onPush = async (keyEvent: KeyEvent) => {
		trace(`Key Device ID\t: ${device.id}, Key Event\t: ${keyEvent}\n`);
		if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
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

function attachJoyStick(device: M5ChainJoyStick) {
	device.onSample = async function () {
		const sample = this.sample();
		if (sample === undefined) return;
		trace(`JoyStick Device ID\t: ${device.id}, value\t: x:${sample.x}\ty:${sample.y}\n`);
		const hue = norm(sample.x);
		const brightness = norm(-sample.y);
		const saturation = 1.0;
		const { r, g, b } = hsvToRGB(hue, saturation, brightness);
		await device.setLedColor(r, g, b);
	};
}

function attachToF(device: M5ChainToF) {
	device.onSample = async function () {
		const sample = this.sample();
		if (sample === undefined) return;
		trace(`ToF Device ID	: ${device.id}, distance	: ${sample} mm\n`);
		const brightness = Math.max(0.1, Math.min(1, 1 - sample / 2000));
		const { r, g, b } = hsvToRGB(0.58, 1.0, brightness);
		await device.setLedColor(r, g, b);
	};
}
