import HasLed from "hasLed";
import { assertObjectOption, withDeviceFeatures } from "m5chainDevice";
import type { LedColor } from "types";

export const BUZZER_MODE = Object.freeze({
	AUTO: 0,
	MANUAL: 1,
	NOTE: 2,
} as const);
export type BuzzerMode = (typeof BUZZER_MODE)[keyof typeof BUZZER_MODE];

export const BUZZER_NOTE = Object.freeze({
	REST: 0,
	C3: 1,
	C_SHARP_3: 2,
	D3: 3,
	D_SHARP_3: 4,
	E3: 5,
	F3: 6,
	F_SHARP_3: 7,
	G3: 8,
	G_SHARP_3: 9,
	A3: 10,
	A_SHARP_3: 11,
	B3: 12,
	C4: 13,
	C_SHARP_4: 14,
	D4: 15,
	D_SHARP_4: 16,
	E4: 17,
	F4: 18,
	F_SHARP_4: 19,
	G4: 20,
	G_SHARP_4: 21,
	A4: 22,
	A_SHARP_4: 23,
	B4: 24,
	C5: 25,
	C_SHARP_5: 26,
	D5: 27,
	D_SHARP_5: 28,
	E5: 29,
	F5: 30,
	F_SHARP_5: 31,
	G5: 32,
	G_SHARP_5: 33,
	A5: 34,
	A_SHARP_5: 35,
	B5: 36,
	C6: 37,
	C_SHARP_6: 38,
	D6: 39,
	D_SHARP_6: 40,
	E6: 41,
	F6: 42,
	F_SHARP_6: 43,
	G6: 44,
	G_SHARP_6: 45,
	A6: 46,
	A_SHARP_6: 47,
	B6: 48,
	C7: 49,
	C_SHARP_7: 50,
	D7: 51,
	D_SHARP_7: 52,
	E7: 53,
	F7: 54,
	F_SHARP_7: 55,
	G7: 56,
	G_SHARP_7: 57,
	A7: 58,
	A_SHARP_7: 59,
	B7: 60,
	C8: 61,
} as const);
export type BuzzerNote = (typeof BUZZER_NOTE)[keyof typeof BUZZER_NOTE];

export type ToneOptions = {
	frequencyHz: number;
	durationMs: number;
	dutyCycle?: number;
};

export type ContinuousToneOptions = {
	frequencyHz: number;
	dutyCycle?: number;
};

export type NoteOptions = {
	note: BuzzerNote;
	durationMs: number;
};

const MIN_FREQUENCY_HZ = 100;
const MAX_FREQUENCY_HZ = 10_000;
const MAX_DURATION_MS = 0xffff;
const DEFAULT_DUTY_CYCLE = 0.5;

function assertKnownOptions(options: object, known: string[]) {
	const allowed = new Set(known);
	for (const key in options) {
		if (!allowed.has(key)) {
			throw new RangeError(`Unsupported buzzer option: ${key}`);
		}
	}
}

function assertIntegerInRange(name: string, value: number, min: number, max: number) {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
	}
}

function assertDutyCycle(dutyCycle: number) {
	if (typeof dutyCycle !== "number" || Number.isNaN(dutyCycle) || dutyCycle < 0 || dutyCycle > 1) {
		throw new RangeError("dutyCycle must be between 0 and 1.");
	}
}

function modeFromValue(value: number): BuzzerMode {
	switch (value) {
		case BUZZER_MODE.AUTO:
			return BUZZER_MODE.AUTO;
		case BUZZER_MODE.MANUAL:
			return BUZZER_MODE.MANUAL;
		case BUZZER_MODE.NOTE:
			return BUZZER_MODE.NOTE;
		default:
			throw new Error(`Unknown buzzer mode: ${value}`);
	}
}

class M5ChainBuzzer extends withDeviceFeatures(HasLed) {
	static DEVICE_TYPE = 0x000b;
	readonly kind = "buzzer" as const;
	static BUZZER_MODE = BUZZER_MODE;
	static BUZZER_NOTE = BUZZER_NOTE;
	static CMD = Object.freeze({
		...super.CMD,
		SET_BUZZER_MODE: 0x30,
		GET_BUZZER_MODE: 0x31,
		PLAY_TONE: 0x32,
		SET_TONE_FREQUENCY: 0x33,
		GET_TONE_FREQUENCY: 0x34,
		SET_TONE_DUTY_CYCLE: 0x35,
		GET_TONE_DUTY_CYCLE: 0x36,
		SET_TONE_STATE: 0x37,
		GET_TONE_STATE: 0x38,
		PLAY_NOTE: 0x39,
	} as const);

	#operationMutex: Promise<void> = Promise.resolve();

	async playTone(options: ToneOptions): Promise<void> {
		assertObjectOption("options", options);
		assertKnownOptions(options, ["frequencyHz", "durationMs", "dutyCycle"]);
		const dutyCycle = options.dutyCycle ?? DEFAULT_DUTY_CYCLE;
		assertIntegerInRange("frequencyHz", options.frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
		assertIntegerInRange("durationMs", options.durationMs, 0, MAX_DURATION_MS);
		assertDutyCycle(dutyCycle);

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.AUTO);
			const data = new Uint8Array(5);
			data[0] = options.frequencyHz & 0xff;
			data[1] = (options.frequencyHz >> 8) & 0xff;
			data[2] = Math.round(dutyCycle * 100);
			data[3] = options.durationMs & 0xff;
			data[4] = (options.durationMs >> 8) & 0xff;
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.PLAY_TONE, data, data.length);
			this.#assertOperationSucceeded("playTone", packet[6], true);
		});
	}

	async startTone(options: ContinuousToneOptions): Promise<void> {
		assertObjectOption("options", options);
		assertKnownOptions(options, ["frequencyHz", "dutyCycle"]);
		const dutyCycle = options.dutyCycle ?? DEFAULT_DUTY_CYCLE;
		assertIntegerInRange("frequencyHz", options.frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
		assertDutyCycle(dutyCycle);

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.MANUAL);
			await this.#setToneFrequency(options.frequencyHz);
			await this.#setToneDutyCycle(dutyCycle);
			await this.#setToneState(true);
		});
	}

	async stopTone(): Promise<void> {
		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.MANUAL);
			await this.#setToneState(false);
		});
	}

	async playNote(options: NoteOptions): Promise<void> {
		assertObjectOption("options", options);
		assertKnownOptions(options, ["note", "durationMs"]);
		assertIntegerInRange("note", options.note, BUZZER_NOTE.REST, BUZZER_NOTE.C8);
		assertIntegerInRange("durationMs", options.durationMs, 0, MAX_DURATION_MS);

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.NOTE);
			const data = new Uint8Array(3);
			data[0] = options.note;
			data[1] = options.durationMs & 0xff;
			data[2] = (options.durationMs >> 8) & 0xff;
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.PLAY_NOTE, data, data.length);
			this.#assertOperationSucceeded("playNote", packet[6], true);
		});
	}

	async setToneFrequency(frequencyHz: number): Promise<void> {
		assertIntegerInRange("frequencyHz", frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
		await this.#withOperationLock(async () => {
			await this.#setToneFrequency(frequencyHz);
		});
	}

	async getToneFrequency(): Promise<number> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_TONE_FREQUENCY, new Uint8Array(0), 0);
			return (packet[7] << 8) | packet[6];
		});
	}

	async setToneDutyCycle(dutyCycle: number): Promise<void> {
		assertDutyCycle(dutyCycle);
		await this.#withOperationLock(async () => {
			await this.#setToneDutyCycle(dutyCycle);
		});
	}

	async getToneDutyCycle(): Promise<number> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_TONE_DUTY_CYCLE, new Uint8Array(0), 0);
			return packet[6] / 100;
		});
	}

	async getPlaybackMode(): Promise<BuzzerMode> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_BUZZER_MODE, new Uint8Array(0), 0);
			return modeFromValue(packet[6]);
		});
	}

	async isToneActive(): Promise<boolean> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_TONE_STATE, new Uint8Array(0), 0);
			switch (packet[6]) {
				case 0:
					return false;
				case 1:
					return true;
				default:
					throw new Error(`Unknown buzzer state: ${packet[6]}`);
			}
		});
	}

	async setLedColors(index: number, num: number, colors: LedColor[]): Promise<void> {
		if (index !== 0 || num !== 1) {
			throw new RangeError("Chain Buzzer has one RGB LED; index must be 0 and num must be 1.");
		}
		if (!Array.isArray(colors) || colors.length < 1) {
			throw new RangeError("colors must contain one entry.");
		}
		assertIntegerInRange("colors[0].r", colors[0].r, 0, 255);
		assertIntegerInRange("colors[0].g", colors[0].g, 0, 255);
		assertIntegerInRange("colors[0].b", colors[0].b, 0, 255);

		await this.#withOperationLock(async () => {
			const data = new Uint8Array([index, num, colors[0].r, colors[0].g, colors[0].b]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.RGB.SET_RGB_VALUE, data, data.length);
			this.#assertOperationSucceeded("setLedColors", packet[6]);
		});
	}

	async getLedColors(index: number, num: number): Promise<LedColor[]> {
		if (index !== 0 || num !== 1) {
			throw new RangeError("Chain Buzzer has one RGB LED; index must be 0 and num must be 1.");
		}
		return await this.#withOperationLock(async () => {
			const data = new Uint8Array([index, num]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.RGB.GET_RGB_VALUE, data, data.length);
			this.#assertOperationSucceeded("getLedColors", packet[6]);
			return [{ r: packet[7], g: packet[8], b: packet[9] }];
		});
	}

	async #setPlaybackMode(mode: BuzzerMode): Promise<void> {
		const data = new Uint8Array([mode]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_BUZZER_MODE, data, data.length);
		this.#assertOperationSucceeded("set buzzer mode", packet[6]);
	}

	async #setToneFrequency(frequencyHz: number): Promise<void> {
		const data = new Uint8Array([frequencyHz & 0xff, (frequencyHz >> 8) & 0xff]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_FREQUENCY, data, data.length);
		this.#assertOperationSucceeded("setToneFrequency", packet[6]);
	}

	async #setToneDutyCycle(dutyCycle: number): Promise<void> {
		const data = new Uint8Array([Math.round(dutyCycle * 100)]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_DUTY_CYCLE, data, data.length);
		this.#assertOperationSucceeded("setToneDutyCycle", packet[6]);
	}

	async #setToneState(active: boolean): Promise<void> {
		const data = new Uint8Array([active ? 1 : 0]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_STATE, data, data.length);
		this.#assertOperationSucceeded(active ? "startTone" : "stopTone", packet[6]);
	}

	#assertOperationSucceeded(operation: string, status: number, modeMismatchPossible = false) {
		if (status === 1) return;
		if (modeMismatchPossible && status === 2) {
			throw new Error(`${operation} failed: buzzer playback mode mismatch.`);
		}
		throw new Error(`${operation} failed.`);
	}

	async #withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
		let release: (() => void) | undefined;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		const previous = this.#operationMutex;
		this.#operationMutex = previous.then(() => current);
		await previous;
		try {
			return await operation();
		} finally {
			release?.();
		}
	}
}

export default M5ChainBuzzer;
