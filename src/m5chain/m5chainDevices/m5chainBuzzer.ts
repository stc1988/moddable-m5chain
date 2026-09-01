import {
	BUZZER_MODE,
	BUZZER_NOTE,
	type BuzzerMode,
	type BuzzerNote,
	type ContinuousToneOptions,
	type MelodyOptions,
	type MelodyStep,
	type NoteOptions,
	prepareMelody,
	type ToneOptions,
} from "buzzerProtocol";
import HasLed, { type HasLedMethods } from "hasLed";
import { assertObjectOption, readPacketByte, readPacketUint16LE, withDeviceFeatures } from "m5chainDevice";
import Timer from "timer";
import type { LedColor } from "types";

export {
	BUZZER_MODE,
	BUZZER_NOTE,
	type BuzzerMode,
	type BuzzerNote,
	type ContinuousToneOptions,
	type MelodyOptions,
	type MelodyStep,
	type NoteOptions,
	type ToneOptions,
} from "buzzerProtocol";

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

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Runtime mixins install the merged feature methods.
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
	#melodyRunId = 0;
	#activeMelodyRunId: number | null = null;
	#melodyDelayTimer: ReturnType<typeof Timer.set> | null = null;
	#melodyDelayResolve: (() => void) | null = null;

	async playTone(options: ToneOptions): Promise<void> {
		assertObjectOption("options", options);
		assertKnownOptions(options, ["frequencyHz", "durationMs", "dutyCycle"]);
		const dutyCycle = options.dutyCycle ?? DEFAULT_DUTY_CYCLE;
		assertIntegerInRange("frequencyHz", options.frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
		assertIntegerInRange("durationMs", options.durationMs, 0, MAX_DURATION_MS);
		assertDutyCycle(dutyCycle);
		this.#cancelMelody();

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.AUTO);
			const data = new Uint8Array(5);
			data[0] = options.frequencyHz & 0xff;
			data[1] = (options.frequencyHz >> 8) & 0xff;
			data[2] = Math.round(dutyCycle * 100);
			data[3] = options.durationMs & 0xff;
			data[4] = (options.durationMs >> 8) & 0xff;
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.PLAY_TONE, data, data.length);
			this.#assertOperationSucceeded("playTone", readPacketByte(packet, 6, "play tone"), true);
		});
	}

	async startTone(options: ContinuousToneOptions): Promise<void> {
		assertObjectOption("options", options);
		assertKnownOptions(options, ["frequencyHz", "dutyCycle"]);
		const dutyCycle = options.dutyCycle ?? DEFAULT_DUTY_CYCLE;
		assertIntegerInRange("frequencyHz", options.frequencyHz, MIN_FREQUENCY_HZ, MAX_FREQUENCY_HZ);
		assertDutyCycle(dutyCycle);
		this.#cancelMelody();

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.MANUAL);
			await this.#setToneFrequency(options.frequencyHz);
			await this.#setToneDutyCycle(dutyCycle);
			await this.#setToneState(true);
		});
	}

	async stopTone(): Promise<void> {
		this.#cancelMelody();
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
		this.#cancelMelody();

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.NOTE);
			await this.#playNote(options.note, options.durationMs);
		});
	}

	async playMelody(melody: readonly MelodyStep[], options: MelodyOptions): Promise<void> {
		const prepared = prepareMelody(melody, options);
		this.#cancelMelody();
		const runId = this.#melodyRunId;
		this.#activeMelodyRunId = runId;

		try {
			await this.#withOperationLock(async () => {
				if (runId !== this.#melodyRunId) return;
				await this.#setPlaybackMode(BUZZER_MODE.NOTE);
			});

			for (const step of prepared.steps) {
				if (runId !== this.#melodyRunId) return;
				const deadline = Date.now() + step.durationMs;
				await this.#withOperationLock(async () => {
					if (runId !== this.#melodyRunId) return;
					await this.#playNote(step.note, step.toneDurationMs);
				});
				if (runId !== this.#melodyRunId) return;
				await this.#waitForMelody(runId, Math.max(0, deadline - Date.now()));
			}
		} finally {
			if (this.#activeMelodyRunId === runId) this.#activeMelodyRunId = null;
		}
	}

	async stopMelody(): Promise<void> {
		const wasActive = this.#activeMelodyRunId !== null;
		this.#cancelMelody();
		if (!wasActive) return;

		await this.#withOperationLock(async () => {
			await this.#setPlaybackMode(BUZZER_MODE.NOTE);
			await this.#playNote(BUZZER_NOTE.REST, 0);
		});
	}

	_markDisconnected(): void {
		this.#cancelMelody();
		super._markDisconnected();
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
			return readPacketUint16LE(packet, 6, "get tone frequency");
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
			return readPacketByte(packet, 6, "get tone duty cycle") / 100;
		});
	}

	async getPlaybackMode(): Promise<BuzzerMode> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_BUZZER_MODE, new Uint8Array(0), 0);
			return modeFromValue(readPacketByte(packet, 6, "get buzzer mode"));
		});
	}

	async isToneActive(): Promise<boolean> {
		return await this.#withOperationLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.GET_TONE_STATE, new Uint8Array(0), 0);
			const state = readPacketByte(packet, 6, "get tone state");
			switch (state) {
				case 0:
					return false;
				case 1:
					return true;
				default:
					throw new Error(`Unknown buzzer state: ${state}`);
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
		const color = colors[0];
		if (!color) throw new RangeError("colors must contain one entry.");
		assertIntegerInRange("colors[0].r", color.r, 0, 255);
		assertIntegerInRange("colors[0].g", color.g, 0, 255);
		assertIntegerInRange("colors[0].b", color.b, 0, 255);

		await this.#withOperationLock(async () => {
			const data = new Uint8Array([index, num, color.r, color.g, color.b]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.RGB.SET_RGB_VALUE, data, data.length);
			this.#assertOperationSucceeded("setLedColors", readPacketByte(packet, 6, "set buzzer LED color"));
		});
	}

	async getLedColors(index: number, num: number): Promise<LedColor[]> {
		if (index !== 0 || num !== 1) {
			throw new RangeError("Chain Buzzer has one RGB LED; index must be 0 and num must be 1.");
		}
		return await this.#withOperationLock(async () => {
			const data = new Uint8Array([index, num]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.RGB.GET_RGB_VALUE, data, data.length);
			this.#assertOperationSucceeded("getLedColors", readPacketByte(packet, 6, "get buzzer LED color"));
			return [
				{
					r: readPacketByte(packet, 7, "get buzzer LED color"),
					g: readPacketByte(packet, 8, "get buzzer LED color"),
					b: readPacketByte(packet, 9, "get buzzer LED color"),
				},
			];
		});
	}

	async #setPlaybackMode(mode: BuzzerMode): Promise<void> {
		const data = new Uint8Array([mode]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_BUZZER_MODE, data, data.length);
		this.#assertOperationSucceeded("set buzzer mode", readPacketByte(packet, 6, "set buzzer mode"));
	}

	async #playNote(note: BuzzerNote, durationMs: number): Promise<void> {
		const data = new Uint8Array(3);
		data[0] = note;
		data[1] = durationMs & 0xff;
		data[2] = (durationMs >> 8) & 0xff;
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.PLAY_NOTE, data, data.length);
		this.#assertOperationSucceeded("playNote", readPacketByte(packet, 6, "play note"), true);
	}

	#cancelMelody(): void {
		this.#melodyRunId += 1;
		this.#activeMelodyRunId = null;
		if (this.#melodyDelayTimer !== null) {
			Timer.clear(this.#melodyDelayTimer);
			this.#melodyDelayTimer = null;
		}
		const resolve = this.#melodyDelayResolve;
		this.#melodyDelayResolve = null;
		resolve?.();
	}

	async #waitForMelody(runId: number, durationMs: number): Promise<void> {
		if (durationMs <= 0 || runId !== this.#melodyRunId) return;
		await new Promise<void>((resolve) => {
			const finish = () => {
				if (this.#melodyDelayResolve === finish) {
					this.#melodyDelayResolve = null;
					this.#melodyDelayTimer = null;
				}
				resolve();
			};
			this.#melodyDelayResolve = finish;
			this.#melodyDelayTimer = Timer.set(finish, durationMs);
		});
	}

	async #setToneFrequency(frequencyHz: number): Promise<void> {
		const data = new Uint8Array([frequencyHz & 0xff, (frequencyHz >> 8) & 0xff]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_FREQUENCY, data, data.length);
		this.#assertOperationSucceeded("setToneFrequency", readPacketByte(packet, 6, "set tone frequency"));
	}

	async #setToneDutyCycle(dutyCycle: number): Promise<void> {
		const data = new Uint8Array([Math.round(dutyCycle * 100)]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_DUTY_CYCLE, data, data.length);
		this.#assertOperationSucceeded("setToneDutyCycle", readPacketByte(packet, 6, "set tone duty cycle"));
	}

	async #setToneState(active: boolean): Promise<void> {
		const data = new Uint8Array([active ? 1 : 0]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainBuzzer.CMD.SET_TONE_STATE, data, data.length);
		this.#assertOperationSucceeded(
			active ? "startTone" : "stopTone",
			readPacketByte(packet, 6, active ? "start tone" : "stop tone"),
		);
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

interface M5ChainBuzzer extends HasLedMethods {}

export default M5ChainBuzzer;
