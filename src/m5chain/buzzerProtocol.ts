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

export type MelodyStep = {
	note: BuzzerNote;
	beats: number;
};

export type MelodyOptions = {
	tempoBpm: number;
	gateRatio?: number;
};

export type PreparedMelodyStep = {
	note: BuzzerNote;
	durationMs: number;
	toneDurationMs: number;
};

export type PreparedMelody = {
	tempoBpm: number;
	gateRatio: number;
	steps: PreparedMelodyStep[];
};

export const DEFAULT_MELODY_GATE_RATIO = 0.9;
export const MAX_BUZZER_DURATION_MS = 0xffff;

function assertObject(name: string, value: unknown): asserts value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError(`${name} must be an object.`);
	}
}

function assertKnownKeys(name: string, value: Record<string, unknown>, known: readonly string[]) {
	const allowed = new Set(known);
	for (const key in value) {
		if (!allowed.has(key)) throw new RangeError(`Unsupported ${name} option: ${key}`);
	}
}

function assertPositiveNumber(name: string, value: unknown): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new RangeError(`${name} must be a finite number greater than 0.`);
	}
}

function assertBuzzerNote(name: string, value: unknown): asserts value is BuzzerNote {
	if (typeof value !== "number" || !Number.isInteger(value) || value < BUZZER_NOTE.REST || value > BUZZER_NOTE.C8) {
		throw new RangeError(`${name} must be a valid BuzzerNote.`);
	}
}

export function prepareMelody(melody: readonly MelodyStep[], options: MelodyOptions): PreparedMelody {
	if (!Array.isArray(melody)) throw new TypeError("melody must be an array.");
	assertObject("options", options);
	assertKnownKeys("melody", options, ["tempoBpm", "gateRatio"]);
	assertPositiveNumber("tempoBpm", options.tempoBpm);
	const gateRatio = options.gateRatio ?? DEFAULT_MELODY_GATE_RATIO;
	assertPositiveNumber("gateRatio", gateRatio);
	if (gateRatio > 1) throw new RangeError("gateRatio must be at most 1.");

	const steps: PreparedMelodyStep[] = [];
	for (let index = 0; index < melody.length; index += 1) {
		const step = melody[index];
		assertObject(`melody[${index}]`, step);
		assertKnownKeys(`melody[${index}]`, step, ["note", "beats"]);
		const note = step.note;
		const beats = step.beats;
		assertBuzzerNote(`melody[${index}].note`, note);
		assertPositiveNumber(`melody[${index}].beats`, beats);

		const durationMs = Math.round((60_000 * beats) / options.tempoBpm);
		if (durationMs < 1 || durationMs > MAX_BUZZER_DURATION_MS) {
			throw new RangeError(`melody[${index}] duration must be between 1 and ${MAX_BUZZER_DURATION_MS} ms.`);
		}
		steps.push({
			note,
			durationMs,
			toneDurationMs: note === BUZZER_NOTE.REST ? 0 : Math.max(1, Math.round(durationMs * gateRatio)),
		});
	}

	return { tempoBpm: options.tempoBpm, gateRatio, steps };
}
