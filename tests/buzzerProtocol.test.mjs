import assert from "node:assert/strict";
import test from "node:test";
import { BUZZER_NOTE, DEFAULT_MELODY_GATE_RATIO, prepareMelody } from "../src/m5chain/buzzerProtocol.ts";

test("converts melody beats into step and gated note durations", () => {
	assert.deepEqual(
		prepareMelody(
			[
				{ note: BUZZER_NOTE.C5, beats: 1.5 },
				{ note: BUZZER_NOTE.REST, beats: 0.5 },
			],
			{ tempoBpm: 120 },
		),
		{
			tempoBpm: 120,
			gateRatio: DEFAULT_MELODY_GATE_RATIO,
			steps: [
				{ note: BUZZER_NOTE.C5, durationMs: 750, toneDurationMs: 675 },
				{ note: BUZZER_NOTE.REST, durationMs: 250, toneDurationMs: 0 },
			],
		},
	);
});

test("accepts fractional beats and an explicit gate ratio", () => {
	const prepared = prepareMelody([{ note: BUZZER_NOTE.G4, beats: 2 / 3 }], {
		tempoBpm: 100,
		gateRatio: 0.75,
	});
	assert.deepEqual(prepared.steps[0], {
		note: BUZZER_NOTE.G4,
		durationMs: 400,
		toneDurationMs: 300,
	});
});

test("validates melody notes, beats, tempo, gate, and derived duration", () => {
	assert.throws(() => prepareMelody(undefined, { tempoBpm: 120 }), /melody must be an array/);
	assert.throws(() => prepareMelody([{ note: 62, beats: 1 }], { tempoBpm: 120 }), /valid BuzzerNote/);
	assert.throws(() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 0 }], { tempoBpm: 120 }), /greater than 0/);
	assert.throws(() => prepareMelody([], { tempoBpm: 0 }), /greater than 0/);
	assert.throws(() => prepareMelody([], { tempoBpm: 120, gateRatio: 1.01 }), /at most 1/);
	assert.throws(
		() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 1000 }], { tempoBpm: 1 }),
		/between 1 and 65535 ms/,
	);
});

test("rejects unsupported melody and step options", () => {
	assert.throws(() => prepareMelody([], { tempoBpm: 120, repeat: true }), /Unsupported melody option: repeat/);
	assert.throws(
		() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 1, volume: 1 }], { tempoBpm: 120 }),
		/Unsupported melody\[0\] option: volume/,
	);
});
