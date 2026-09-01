import "./styles.css";
import { parseMelodyCsv } from "./melodyCsv";

type PreviewMode = "tone" | "note" | "melody" | "continuous";

type BuzzerNote = {
	constant: string;
	label: string;
	frequencyHz: number;
	octave: number | null;
};

type MelodyStep = {
	noteConstant: string;
	beats: number;
};

type PreviewState = {
	mode: PreviewMode;
	frequencyHz: number;
	dutyPercent: number;
	durationMs: number;
	noteConstant: string;
	previewVolume: number;
	tempoBpm: number;
	gatePercent: number;
	melody: MelodyStep[];
};

const NOTES: readonly BuzzerNote[] = [
	{ constant: "REST", label: "Rest", frequencyHz: 0, octave: null },
	{ constant: "C3", label: "C3", frequencyHz: 131, octave: 3 },
	{ constant: "C_SHARP_3", label: "C♯3", frequencyHz: 139, octave: 3 },
	{ constant: "D3", label: "D3", frequencyHz: 147, octave: 3 },
	{ constant: "D_SHARP_3", label: "D♯3", frequencyHz: 156, octave: 3 },
	{ constant: "E3", label: "E3", frequencyHz: 165, octave: 3 },
	{ constant: "F3", label: "F3", frequencyHz: 175, octave: 3 },
	{ constant: "F_SHARP_3", label: "F♯3", frequencyHz: 185, octave: 3 },
	{ constant: "G3", label: "G3", frequencyHz: 196, octave: 3 },
	{ constant: "G_SHARP_3", label: "G♯3", frequencyHz: 208, octave: 3 },
	{ constant: "A3", label: "A3", frequencyHz: 220, octave: 3 },
	{ constant: "A_SHARP_3", label: "A♯3", frequencyHz: 233, octave: 3 },
	{ constant: "B3", label: "B3", frequencyHz: 247, octave: 3 },
	{ constant: "C4", label: "C4", frequencyHz: 262, octave: 4 },
	{ constant: "C_SHARP_4", label: "C♯4", frequencyHz: 277, octave: 4 },
	{ constant: "D4", label: "D4", frequencyHz: 294, octave: 4 },
	{ constant: "D_SHARP_4", label: "D♯4", frequencyHz: 311, octave: 4 },
	{ constant: "E4", label: "E4", frequencyHz: 330, octave: 4 },
	{ constant: "F4", label: "F4", frequencyHz: 349, octave: 4 },
	{ constant: "F_SHARP_4", label: "F♯4", frequencyHz: 370, octave: 4 },
	{ constant: "G4", label: "G4", frequencyHz: 392, octave: 4 },
	{ constant: "G_SHARP_4", label: "G♯4", frequencyHz: 415, octave: 4 },
	{ constant: "A4", label: "A4", frequencyHz: 440, octave: 4 },
	{ constant: "A_SHARP_4", label: "A♯4", frequencyHz: 466, octave: 4 },
	{ constant: "B4", label: "B4", frequencyHz: 494, octave: 4 },
	{ constant: "C5", label: "C5", frequencyHz: 523, octave: 5 },
	{ constant: "C_SHARP_5", label: "C♯5", frequencyHz: 554, octave: 5 },
	{ constant: "D5", label: "D5", frequencyHz: 587, octave: 5 },
	{ constant: "D_SHARP_5", label: "D♯5", frequencyHz: 622, octave: 5 },
	{ constant: "E5", label: "E5", frequencyHz: 659, octave: 5 },
	{ constant: "F5", label: "F5", frequencyHz: 698, octave: 5 },
	{ constant: "F_SHARP_5", label: "F♯5", frequencyHz: 740, octave: 5 },
	{ constant: "G5", label: "G5", frequencyHz: 784, octave: 5 },
	{ constant: "G_SHARP_5", label: "G♯5", frequencyHz: 831, octave: 5 },
	{ constant: "A5", label: "A5", frequencyHz: 880, octave: 5 },
	{ constant: "A_SHARP_5", label: "A♯5", frequencyHz: 932, octave: 5 },
	{ constant: "B5", label: "B5", frequencyHz: 988, octave: 5 },
	{ constant: "C6", label: "C6", frequencyHz: 1047, octave: 6 },
	{ constant: "C_SHARP_6", label: "C♯6", frequencyHz: 1109, octave: 6 },
	{ constant: "D6", label: "D6", frequencyHz: 1175, octave: 6 },
	{ constant: "D_SHARP_6", label: "D♯6", frequencyHz: 1245, octave: 6 },
	{ constant: "E6", label: "E6", frequencyHz: 1319, octave: 6 },
	{ constant: "F6", label: "F6", frequencyHz: 1397, octave: 6 },
	{ constant: "F_SHARP_6", label: "F♯6", frequencyHz: 1480, octave: 6 },
	{ constant: "G6", label: "G6", frequencyHz: 1568, octave: 6 },
	{ constant: "G_SHARP_6", label: "G♯6", frequencyHz: 1661, octave: 6 },
	{ constant: "A6", label: "A6", frequencyHz: 1760, octave: 6 },
	{ constant: "A_SHARP_6", label: "A♯6", frequencyHz: 1865, octave: 6 },
	{ constant: "B6", label: "B6", frequencyHz: 1976, octave: 6 },
	{ constant: "C7", label: "C7", frequencyHz: 2093, octave: 7 },
	{ constant: "C_SHARP_7", label: "C♯7", frequencyHz: 2217, octave: 7 },
	{ constant: "D7", label: "D7", frequencyHz: 2349, octave: 7 },
	{ constant: "D_SHARP_7", label: "D♯7", frequencyHz: 2489, octave: 7 },
	{ constant: "E7", label: "E7", frequencyHz: 2637, octave: 7 },
	{ constant: "F7", label: "F7", frequencyHz: 2794, octave: 7 },
	{ constant: "F_SHARP_7", label: "F♯7", frequencyHz: 2960, octave: 7 },
	{ constant: "G7", label: "G7", frequencyHz: 3136, octave: 7 },
	{ constant: "G_SHARP_7", label: "G♯7", frequencyHz: 3322, octave: 7 },
	{ constant: "A7", label: "A7", frequencyHz: 3520, octave: 7 },
	{ constant: "A_SHARP_7", label: "A♯7", frequencyHz: 3729, octave: 7 },
	{ constant: "B7", label: "B7", frequencyHz: 3951, octave: 7 },
	{ constant: "C8", label: "C8", frequencyHz: 4186, octave: 8 },
];
const VALID_NOTE_CONSTANTS = new Set(NOTES.map((note) => note.constant));

const DEFAULT_MELODY: readonly MelodyStep[] = [
	{ noteConstant: "C5", beats: 1.5 },
	{ noteConstant: "G4", beats: 0.5 },
	{ noteConstant: "REST", beats: 1 },
	{ noteConstant: "E4", beats: 1 },
	{ noteConstant: "REST", beats: 0.5 },
	{ noteConstant: "A4", beats: 1 },
	{ noteConstant: "B4", beats: 1 },
	{ noteConstant: "A_SHARP_4", beats: 0.5 },
	{ noteConstant: "A4", beats: 1 },
	{ noteConstant: "G4", beats: 0.66 },
	{ noteConstant: "E5", beats: 0.66 },
	{ noteConstant: "G5", beats: 0.66 },
	{ noteConstant: "A5", beats: 1 },
	{ noteConstant: "F5", beats: 0.5 },
	{ noteConstant: "G5", beats: 0.5 },
	{ noteConstant: "REST", beats: 0.5 },
	{ noteConstant: "E5", beats: 1 },
	{ noteConstant: "C5", beats: 0.5 },
	{ noteConstant: "D5", beats: 0.5 },
	{ noteConstant: "B4", beats: 0.5 },
	{ noteConstant: "REST", beats: 1 },
];

const DEFAULTS = {
	mode: "tone" as PreviewMode,
	frequencyHz: 1000,
	dutyPercent: 50,
	durationMs: 500,
	noteConstant: "C4",
	previewVolume: 35,
	tempoBpm: 120,
	gatePercent: 90,
};

const state: PreviewState = {
	...DEFAULTS,
	melody: DEFAULT_MELODY.map((step) => ({ ...step })),
};

function byId<T extends HTMLElement>(id: string): T {
	const found = document.getElementById(id);
	if (!found) throw new Error(`Missing #${id}`);
	return found as T;
}

const frequencyControl = byId<HTMLDivElement>("frequency-control");
const noteControl = byId<HTMLDivElement>("note-control");
const melodyControls = byId<HTMLDivElement>("melody-controls");
const dutyControl = byId<HTMLDivElement>("duty-control");
const durationControl = byId<HTMLDivElement>("duration-control");
const frequencyInput = byId<HTMLInputElement>("frequency");
const frequencyRange = byId<HTMLInputElement>("frequency-range");
const dutyInput = byId<HTMLInputElement>("duty");
const dutyRange = byId<HTMLInputElement>("duty-range");
const durationInput = byId<HTMLInputElement>("duration");
const volumeInput = byId<HTMLInputElement>("volume");
const volumeValue = byId<HTMLOutputElement>("volume-value");
const noteSelect = byId<HTMLSelectElement>("note");
const noteFrequency = byId<HTMLOutputElement>("note-frequency");
const tempoInput = byId<HTMLInputElement>("tempo");
const gateInput = byId<HTMLInputElement>("gate");
const melodyDuration = byId<HTMLOutputElement>("melody-duration");
const melodyList = byId<HTMLDivElement>("melody-list");
const addStepButton = byId<HTMLButtonElement>("add-step");
const csvInput = byId<HTMLTextAreaElement>("csv-input");
const importCsvButton = byId<HTMLButtonElement>("import-csv");
const csvStatus = byId<HTMLOutputElement>("csv-status");
const playButton = byId<HTMLButtonElement>("play");
const stopButton = byId<HTMLButtonElement>("stop");
const resetButton = byId<HTMLButtonElement>("reset");
const copyButton = byId<HTMLButtonElement>("copy");
const audioStatus = byId<HTMLOutputElement>("audio-status");
const generatedCode = byId<HTMLElement>("generated-code");
const modeStat = byId<HTMLElement>("mode-stat");
const frequencyStat = byId<HTMLElement>("frequency-stat");
const dutyStat = byId<HTMLElement>("duty-stat");
const durationStat = byId<HTMLElement>("duration-stat");
const frequencyStatLabel = byId<HTMLElement>("frequency-stat-label");
const dutyStatLabel = byId<HTMLElement>("duty-stat-label");
const modeButtons = document.querySelectorAll<HTMLButtonElement>("[data-mode]");

let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let copyTimer: number | undefined;
let previewRunId = 0;
let previewDelayTimer: number | undefined;
let previewDelayResolve: (() => void) | null = null;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function noteFromConstant(constant: string): BuzzerNote {
	return NOTES.find((note) => note.constant === constant) ?? NOTES[13];
}

function selectedNote(): BuzzerNote {
	return noteFromConstant(state.noteConstant);
}

function effectiveFrequency(): number {
	return state.mode === "note" ? selectedNote().frequencyHz : state.frequencyHz;
}

function effectiveDuty(): number {
	return state.mode === "note" ? 50 : state.dutyPercent;
}

function melodyDurationMs(): number {
	return state.melody.reduce((total, step) => total + Math.round((60_000 * step.beats) / state.tempoBpm), 0);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function formatPlaybackDuration(durationMs: number, approximate = false): string {
	const prefix = approximate ? "≈ " : "";
	if (durationMs < 1000) return `${prefix}${Math.round(durationMs)} ms`;
	if (durationMs < 60_000) return `${prefix}${(durationMs / 1000).toFixed(1)} s`;
	const minutes = Math.floor(durationMs / 60_000);
	const seconds = ((durationMs % 60_000) / 1000).toFixed(1).padStart(4, "0");
	return `${prefix}${minutes}:${seconds}`;
}

function buildCode(): string {
	if (state.mode === "melody") {
		const steps = state.melody
			.map((step) => `\t{ note: BUZZER_NOTE.${step.noteConstant}, beats: ${formatNumber(step.beats)} },`)
			.join("\n");
		return `import { BUZZER_NOTE } from "m5chainBuzzer";

const melody = [
${steps}
] as const;

await buzzer.playMelody(melody, {
	tempoBpm: ${formatNumber(state.tempoBpm)},
	gateRatio: ${formatNumber(state.gatePercent / 100)},
});`;
	}

	if (state.mode === "note") {
		return `import { BUZZER_NOTE } from "m5chainBuzzer";

await buzzer.playNote({
	note: BUZZER_NOTE.${selectedNote().constant},
	durationMs: ${state.durationMs},
});`;
	}

	const options = `{
	frequencyHz: ${state.frequencyHz},
	dutyCycle: ${state.dutyPercent / 100},`;

	if (state.mode === "continuous") {
		return `await buzzer.startTone(${options}
});

// Stop it later:
await buzzer.stopTone();`;
	}

	return `await buzzer.playTone(${options}
	durationMs: ${state.durationMs},
});`;
}

function setStatus(message: string, active = false): void {
	audioStatus.lastChild?.remove();
	audioStatus.append(message);
	audioStatus.classList.toggle("is-active", active);
}

function setCsvStatus(message: string, error = false): void {
	csvStatus.value = message;
	csvStatus.classList.toggle("is-error", error);
}

function setPlaying(playing: boolean): void {
	playButton.disabled = playing && state.mode === "continuous";
	playButton.textContent = playing && state.mode !== "continuous" ? "Play again" : "Preview";
	stopButton.disabled = !playing;
}

function renderMelodyRows(): void {
	const rows = state.melody.map((step, index) => {
		const row = document.createElement("div");
		row.className = "melody-row";

		const stepIndex = document.createElement("span");
		stepIndex.className = "step-index";
		stepIndex.textContent = String(index + 1);

		const select = document.createElement("select");
		select.setAttribute("aria-label", `Step ${index + 1} note`);
		appendNoteOptions(select);
		select.value = step.noteConstant;
		select.addEventListener("change", () => {
			stopPreview(false);
			step.noteConstant = select.value;
			render();
		});

		const beatsField = document.createElement("label");
		beatsField.className = "beats-field";
		const beatsInput = document.createElement("input");
		beatsInput.type = "number";
		beatsInput.min = "0.01";
		beatsInput.max = "1000";
		beatsInput.step = "0.01";
		beatsInput.value = formatNumber(step.beats);
		beatsInput.setAttribute("aria-label", `Step ${index + 1} beats`);
		beatsInput.addEventListener("change", () => {
			stopPreview(false);
			const value = beatsInput.valueAsNumber;
			step.beats = Number.isFinite(value) ? Math.min(1000, Math.max(0.01, value)) : 1;
			render();
		});
		beatsField.append(beatsInput, " beat");

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "remove-step";
		remove.textContent = "×";
		remove.disabled = state.melody.length === 1;
		remove.setAttribute("aria-label", `Remove step ${index + 1}`);
		remove.addEventListener("click", () => {
			stopPreview(false);
			state.melody.splice(index, 1);
			render();
		});

		row.append(stepIndex, select, beatsField, remove);
		return row;
	});
	melodyList.replaceChildren(...rows);
}

function render(): void {
	const noteMode = state.mode === "note";
	const melodyMode = state.mode === "melody";
	frequencyControl.hidden = noteMode || melodyMode;
	noteControl.hidden = !noteMode;
	melodyControls.hidden = !melodyMode;
	dutyControl.hidden = noteMode || melodyMode;
	durationControl.hidden = state.mode === "continuous" || melodyMode;

	for (const button of modeButtons) {
		button.setAttribute("aria-selected", String(button.dataset.mode === state.mode));
	}

	frequencyInput.value = String(state.frequencyHz);
	frequencyRange.value = String(state.frequencyHz);
	dutyInput.value = String(state.dutyPercent);
	dutyRange.value = String(state.dutyPercent);
	durationInput.value = String(state.durationMs);
	volumeInput.value = String(state.previewVolume);
	volumeValue.value = `${state.previewVolume}%`;
	noteSelect.value = state.noteConstant;
	noteFrequency.value = `${selectedNote().frequencyHz} Hz`;
	tempoInput.value = formatNumber(state.tempoBpm);
	gateInput.value = formatNumber(state.gatePercent);
	melodyDuration.value = formatPlaybackDuration(melodyDurationMs(), true);
	if (melodyMode) renderMelodyRows();

	generatedCode.textContent = buildCode();
	modeStat.textContent =
		state.mode === "melody" ? "MELODY" : state.mode === "note" ? "NOTE" : state.mode === "tone" ? "AUTO" : "MANUAL";
	frequencyStatLabel.textContent = melodyMode ? "STEPS" : "FREQUENCY";
	dutyStatLabel.textContent = melodyMode ? "TEMPO" : "DUTY";
	frequencyStat.textContent = melodyMode ? `${state.melody.length}` : `${effectiveFrequency().toLocaleString()} Hz`;
	dutyStat.textContent = melodyMode ? `${formatNumber(state.tempoBpm)} BPM` : `${effectiveDuty()}%`;
	durationStat.textContent =
		state.mode === "continuous"
			? "UNTIL STOP"
			: melodyMode
				? formatPlaybackDuration(melodyDurationMs(), true)
				: formatPlaybackDuration(state.durationMs);
}

function createPulseWave(context: AudioContext, frequencyHz: number, dutyPercent: number): PeriodicWave {
	const duty = dutyPercent / 100;
	const maxHarmonic = Math.max(1, Math.min(256, Math.floor(context.sampleRate / 2 / frequencyHz)));
	const real = new Float32Array(maxHarmonic + 1);
	const imaginary = new Float32Array(maxHarmonic + 1);

	for (let harmonic = 1; harmonic <= maxHarmonic; harmonic += 1) {
		const angle = 2 * Math.PI * harmonic * duty;
		real[harmonic] = (2 * Math.sin(angle)) / (Math.PI * harmonic);
		imaginary[harmonic] = (2 * (1 - Math.cos(angle))) / (Math.PI * harmonic);
	}

	return context.createPeriodicWave(real, imaginary, { disableNormalization: true });
}

function cancelPreviewDelay(): void {
	if (previewDelayTimer !== undefined) {
		window.clearTimeout(previewDelayTimer);
		previewDelayTimer = undefined;
	}
	const resolve = previewDelayResolve;
	previewDelayResolve = null;
	resolve?.();
}

function releaseTone(): void {
	const currentOscillator = oscillator;
	const currentGain = gainNode;
	oscillator = null;
	gainNode = null;

	if (audioContext && currentOscillator && currentGain) {
		const now = audioContext.currentTime;
		currentGain.gain.cancelScheduledValues(now);
		currentGain.gain.setValueAtTime(currentGain.gain.value, now);
		currentGain.gain.linearRampToValueAtTime(0, now + 0.012);
		try {
			currentOscillator.stop(now + 0.014);
		} catch {
			// The scheduled source may already have stopped.
		}
	}
}

function stopPreview(announce = true): void {
	previewRunId += 1;
	cancelPreviewDelay();
	releaseTone();

	setPlaying(false);
	if (announce) setStatus("Preview stopped");
}

async function resumeAudioContext(): Promise<AudioContext> {
	const AudioContextClass =
		window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser");
	audioContext ??= new AudioContextClass();
	await audioContext.resume();
	return audioContext;
}

function startBrowserTone(context: AudioContext, frequencyHz: number, dutyPercent: number, durationMs: number | null) {
	releaseTone();
	const nextOscillator = new OscillatorNode(context, { frequency: frequencyHz });
	nextOscillator.setPeriodicWave(createPulseWave(context, frequencyHz, dutyPercent));
	const nextGain = new GainNode(context, { gain: 0 });
	const now = context.currentTime;
	const outputGain = (state.previewVolume / 100) * 0.18;
	nextGain.gain.linearRampToValueAtTime(outputGain, now + 0.006);
	nextOscillator.connect(nextGain).connect(context.destination);
	nextOscillator.start(now);

	if (durationMs !== null) {
		const durationSeconds = durationMs / 1000;
		const releaseSeconds = Math.min(0.012, durationSeconds / 4);
		const releaseAt = Math.max(now + 0.006, now + durationSeconds - releaseSeconds);
		nextGain.gain.setValueAtTime(outputGain, releaseAt);
		nextGain.gain.linearRampToValueAtTime(0, now + durationSeconds);
		nextOscillator.stop(now + durationSeconds + 0.002);
	}

	oscillator = nextOscillator;
	gainNode = nextGain;
	return nextOscillator;
}

async function waitForPreview(runId: number, durationMs: number): Promise<void> {
	if (runId !== previewRunId || durationMs <= 0) return;
	await new Promise<void>((resolve) => {
		const finish = () => {
			if (previewDelayResolve === finish) {
				previewDelayResolve = null;
				previewDelayTimer = undefined;
			}
			resolve();
		};
		previewDelayResolve = finish;
		previewDelayTimer = window.setTimeout(finish, durationMs);
	});
}

async function playMelodyPreview(context: AudioContext, runId: number): Promise<void> {
	setPlaying(true);
	for (let index = 0; index < state.melody.length; index += 1) {
		if (runId !== previewRunId) return;
		const step = state.melody[index];
		if (!step) continue;
		const note = noteFromConstant(step.noteConstant);
		const durationMs = Math.max(1, Math.round((60_000 * step.beats) / state.tempoBpm));
		const toneDurationMs = Math.max(1, Math.round(durationMs * (state.gatePercent / 100)));
		let stepOscillator: OscillatorNode | null = null;

		if (note.frequencyHz === 0) {
			releaseTone();
			setStatus(`Step ${index + 1}/${state.melody.length} · Rest · ${formatNumber(step.beats)} beat`, true);
		} else {
			stepOscillator = startBrowserTone(context, note.frequencyHz, 50, toneDurationMs);
			setStatus(`Step ${index + 1}/${state.melody.length} · ${note.label} · ${formatNumber(step.beats)} beat`, true);
		}

		await waitForPreview(runId, durationMs);
		if (oscillator === stepOscillator) {
			oscillator = null;
			gainNode = null;
		}
	}

	if (runId !== previewRunId) return;
	releaseTone();
	setPlaying(false);
	setStatus("Melody preview complete");
}

async function playPreview(): Promise<void> {
	stopPreview(false);
	const runId = previewRunId;

	if (state.mode !== "melody" && state.mode !== "continuous" && state.durationMs === 0) {
		setStatus("0 ms completes without audible output");
		return;
	}
	if (state.mode !== "note" && state.mode !== "melody" && (state.dutyPercent === 0 || state.dutyPercent === 100)) {
		setStatus(`${state.dutyPercent}% duty cycle is silent`);
		return;
	}

	try {
		const context = await resumeAudioContext();
		if (runId !== previewRunId) return;
		if (state.mode === "melody") {
			await playMelodyPreview(context, runId);
			return;
		}

		const note = selectedNote();
		const frequencyHz = effectiveFrequency();
		const dutyPercent = effectiveDuty();
		const description =
			state.mode === "note"
				? note.frequencyHz === 0
					? `Rest · ${state.durationMs} ms`
					: `${note.label} · ${frequencyHz} Hz`
				: `${frequencyHz.toLocaleString()} Hz · ${dutyPercent}% duty`;

		setPlaying(true);
		setStatus(state.mode === "continuous" ? `${description} · continuous` : description, true);
		if (state.mode === "continuous") {
			startBrowserTone(context, frequencyHz, dutyPercent, null);
			return;
		}

		let source: OscillatorNode | null = null;
		if (frequencyHz > 0) source = startBrowserTone(context, frequencyHz, dutyPercent, state.durationMs);
		await waitForPreview(runId, state.durationMs);
		if (runId !== previewRunId) return;
		if (oscillator === source) {
			oscillator = null;
			gainNode = null;
		}
		setPlaying(false);
		setStatus("Preview complete");
	} catch (error) {
		if (runId !== previewRunId) return;
		setPlaying(false);
		setStatus(error instanceof Error ? error.message : "Preview could not start");
	}
}

function appendNoteOptions(select: HTMLSelectElement): void {
	select.append(new Option("REST · silence", "REST"));
	for (const octave of [3, 4, 5, 6, 7, 8]) {
		const group = document.createElement("optgroup");
		group.label = `Octave ${octave}`;
		for (const note of NOTES.filter((candidate) => candidate.octave === octave)) {
			group.append(new Option(`${note.label} · ${note.frequencyHz} Hz · BUZZER_NOTE.${note.constant}`, note.constant));
		}
		select.append(group);
	}
}

function bindNumberAndRange(
	numberInput: HTMLInputElement,
	rangeInput: HTMLInputElement,
	minimum: number,
	maximum: number,
	update: (value: number) => void,
): void {
	rangeInput.addEventListener("input", () => {
		stopPreview(false);
		update(Number(rangeInput.value));
		render();
	});

	numberInput.addEventListener("change", () => {
		stopPreview(false);
		const value = Number.isFinite(numberInput.valueAsNumber) ? numberInput.valueAsNumber : minimum;
		update(clamp(value, minimum, maximum));
		render();
	});
}

appendNoteOptions(noteSelect);

bindNumberAndRange(frequencyInput, frequencyRange, 100, 10_000, (value) => {
	state.frequencyHz = value;
});
bindNumberAndRange(dutyInput, dutyRange, 0, 100, (value) => {
	state.dutyPercent = value;
});

durationInput.addEventListener("change", () => {
	stopPreview(false);
	const value = Number.isFinite(durationInput.valueAsNumber) ? durationInput.valueAsNumber : 0;
	state.durationMs = clamp(value, 0, 65_535);
	render();
});

tempoInput.addEventListener("change", () => {
	stopPreview(false);
	const value = Number.isFinite(tempoInput.valueAsNumber) ? tempoInput.valueAsNumber : DEFAULTS.tempoBpm;
	state.tempoBpm = Math.min(1000, Math.max(1, value));
	render();
});

gateInput.addEventListener("change", () => {
	stopPreview(false);
	const value = Number.isFinite(gateInput.valueAsNumber) ? gateInput.valueAsNumber : DEFAULTS.gatePercent;
	state.gatePercent = Math.min(100, Math.max(1, value));
	render();
});

addStepButton.addEventListener("click", () => {
	stopPreview(false);
	state.melody.push({ noteConstant: "C4", beats: 1 });
	render();
	melodyList.lastElementChild?.scrollIntoView({ block: "nearest" });
});

csvInput.addEventListener("input", () => {
	setCsvStatus("Ready to import.");
});

importCsvButton.addEventListener("click", () => {
	try {
		const imported = parseMelodyCsv(csvInput.value, VALID_NOTE_CONSTANTS);
		stopPreview(false);
		state.melody = imported;
		setCsvStatus(`${imported.length} steps imported.`);
		setStatus("CSV melody imported");
		render();
	} catch (error) {
		setCsvStatus(error instanceof Error ? error.message : "CSV could not be imported.", true);
	}
});

volumeInput.addEventListener("input", () => {
	state.previewVolume = Number(volumeInput.value);
	volumeValue.value = `${state.previewVolume}%`;
	if (audioContext && gainNode) {
		gainNode.gain.setTargetAtTime((state.previewVolume / 100) * 0.18, audioContext.currentTime, 0.01);
	}
});

noteSelect.addEventListener("change", () => {
	stopPreview(false);
	state.noteConstant = noteSelect.value;
	render();
});

for (const button of modeButtons) {
	button.addEventListener("click", () => {
		stopPreview(false);
		state.mode = button.dataset.mode as PreviewMode;
		setStatus("Ready to preview");
		render();
	});
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-duration]")) {
	button.addEventListener("click", () => {
		stopPreview(false);
		state.durationMs = Number(button.dataset.duration);
		render();
	});
}

playButton.addEventListener("click", () => void playPreview());
stopButton.addEventListener("click", () => stopPreview());

resetButton.addEventListener("click", () => {
	stopPreview(false);
	Object.assign(state, DEFAULTS);
	state.melody = DEFAULT_MELODY.map((step) => ({ ...step }));
	setStatus("Defaults restored");
	render();
});

copyButton.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(generatedCode.textContent ?? "");
		copyButton.textContent = "Copied";
		window.clearTimeout(copyTimer);
		copyTimer = window.setTimeout(() => {
			copyButton.textContent = "Copy code";
		}, 1800);
	} catch {
		setStatus("Copy was blocked. Select the code and copy it manually.");
	}
});

document.addEventListener("visibilitychange", () => {
	if (document.hidden) stopPreview(false);
});

window.addEventListener("pagehide", () => {
	stopPreview(false);
	void audioContext?.close();
	audioContext = null;
});

render();
