type MelodyStep = {
	beats: number;
};

const MAX_STEP_DURATION_MS = 0xffff;

export function melodyStepDurationMs(beats: number, tempoBpm: number): number {
	const durationMs = Math.round((60_000 * beats) / tempoBpm);
	if (
		!Number.isFinite(beats) ||
		beats <= 0 ||
		!Number.isFinite(durationMs) ||
		durationMs < 1 ||
		durationMs > MAX_STEP_DURATION_MS
	) {
		throw new RangeError(`Each melody step must last from 1 to ${MAX_STEP_DURATION_MS} ms at the selected tempo.`);
	}
	return durationMs;
}

export function validateMelodyTiming(steps: readonly MelodyStep[], tempoBpm: number): void {
	for (let index = 0; index < steps.length; index += 1) {
		try {
			melodyStepDurationMs(steps[index]?.beats ?? Number.NaN, tempoBpm);
		} catch {
			throw new RangeError(`Step ${index + 1} must last from 1 to ${MAX_STEP_DURATION_MS} ms at the selected tempo.`);
		}
	}
}
