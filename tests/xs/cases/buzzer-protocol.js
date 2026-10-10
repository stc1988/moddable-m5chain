/*---
description: validates buzzer melody preparation on XS
flags: [module]
---*/

import { BUZZER_NOTE, DEFAULT_MELODY_GATE_RATIO, prepareMelody } from "buzzerProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

assertDeepEqual(
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

assertDeepEqual(prepareMelody([{ note: BUZZER_NOTE.G4, beats: 2 / 3 }], { tempoBpm: 100, gateRatio: 0.75 }).steps[0], {
	note: BUZZER_NOTE.G4,
	durationMs: 400,
	toneDurationMs: 300,
});

assertThrows(() => prepareMelody(undefined, { tempoBpm: 120 }), /melody must be an array/);
assertThrows(() => prepareMelody([{ note: 62, beats: 1 }], { tempoBpm: 120 }), /valid BuzzerNote/);
assertThrows(() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 0 }], { tempoBpm: 120 }), /greater than 0/);
assertThrows(() => prepareMelody([], { tempoBpm: 0 }), /greater than 0/);
assertThrows(() => prepareMelody([], { tempoBpm: 120, gateRatio: 1.01 }), /at most 1/);
assertThrows(() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 1000 }], { tempoBpm: 1 }), /between 1 and 65535 ms/);
assertThrows(() => prepareMelody([], { tempoBpm: 120, repeat: true }), /Unsupported melody option: repeat/);
assertThrows(
	() => prepareMelody([{ note: BUZZER_NOTE.C4, beats: 1, volume: 1 }], { tempoBpm: 120 }),
	/Unsupported melody\[0\] option: volume/,
);
