import "./styles.css";
import { BLACK, type Color, colorFromHex, type DeviceType, generateAnimationCode, isOn } from "./matrix";
import { createMatrixTools, type MatrixSettings, type ModelContext, registerMatrixTools } from "./webmcp";

const byId = <T extends HTMLElement>(id: string) => {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing #${id}`);
	return element as T;
};
const initialDevice = new URLSearchParams(location.search).get("device");
let device: DeviceType = initialDevice === "rgb" ? "rgb" : "mono";
const frames: Color[][] = [blankFrame()];
let currentFrameIndex = 0;
let painting = false;
let paintOn = true;
let erasing = false;
let previewTimer: number | undefined;
const matrix = byId<HTMLFieldSetElement>("matrix");
const colorInput = byId<HTMLInputElement>("color");
const colorField = byId<HTMLElement>("color-field");
const eraser = byId<HTMLButtonElement>("eraser");
const rotation = byId<HTMLSelectElement>("rotation");
const brightness = byId<HTMLInputElement>("brightness");
const brightnessValue = byId<HTMLOutputElement>("brightness-value");
const frameDuration = byId<HTMLInputElement>("frame-duration");
const loop = byId<HTMLInputElement>("loop");
const frameList = byId<HTMLDivElement>("frame-list");
const framePosition = byId<HTMLOutputElement>("frame-position");
const playButton = byId<HTMLButtonElement>("play");
const stopButton = byId<HTMLButtonElement>("stop");
const generatedCode = byId<HTMLElement>("generated-code");
const status = byId<HTMLOutputElement>("status");
const cells: HTMLButtonElement[] = [];

for (let index = 0; index < 64; index++) {
	const cell = document.createElement("button");
	cell.type = "button";
	cell.className = "pixel";
	cell.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		stopPreview(false);
		painting = true;
		paintOn = device === "mono" ? !isOn(currentFrame()[index] ?? BLACK) : !erasing;
		paint(index);
		cell.setPointerCapture(event.pointerId);
	});
	cell.addEventListener("pointerenter", () => {
		if (painting) paint(index);
	});
	cell.addEventListener("click", (event) => {
		if (event.detail === 0) {
			stopPreview(false);
			paintOn = device === "mono" ? !isOn(currentFrame()[index] ?? BLACK) : !erasing;
			paint(index);
		}
	});
	matrix.append(cell);
	cells.push(cell);
}
window.addEventListener("pointerup", () => {
	painting = false;
});
document.querySelectorAll<HTMLButtonElement>("[data-device]").forEach((button) => {
	button.addEventListener("click", () => {
		stopPreview(false);
		device = button.dataset.device as DeviceType;
		erasing = false;
		render();
	});
});
eraser.addEventListener("click", () => {
	erasing = !erasing;
	render();
});
colorInput.addEventListener("input", () => {
	erasing = false;
	render();
});
rotation.addEventListener("change", render);
brightness.addEventListener("input", render);
frameDuration.addEventListener("change", () => {
	frameDuration.value = String(validDuration(Number(frameDuration.value)));
	if (previewTimer !== undefined) startPreview();
	render();
});
loop.addEventListener("change", render);
byId<HTMLButtonElement>("clear").addEventListener("click", () => {
	stopPreview(false);
	frames[currentFrameIndex] = blankFrame();
	render();
});
byId<HTMLButtonElement>("sample").addEventListener("click", loadSample);
byId<HTMLButtonElement>("add-frame").addEventListener("click", () => addFrame(false));
byId<HTMLButtonElement>("duplicate-frame").addEventListener("click", () => addFrame(true));
byId<HTMLButtonElement>("delete-frame").addEventListener("click", () => deleteFrame());
playButton.addEventListener("click", startPreview);
stopButton.addEventListener("click", () => stopPreview());
byId<HTMLButtonElement>("copy").addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(generatedCode.textContent ?? "");
		status.textContent = "Copied to clipboard.";
	} catch {
		status.textContent = "Clipboard access failed. Select the code and copy it manually.";
	}
});

function blankFrame(): Color[] {
	return Array.from({ length: 64 }, () => ({ ...BLACK }));
}
function currentFrame(): Color[] {
	const value = frames[currentFrameIndex];
	if (!value) throw new Error("Current animation frame is missing.");
	return value;
}
function paint(index: number) {
	currentFrame()[index] =
		device === "mono"
			? paintOn
				? { r: 255, g: 255, b: 255 }
				: { ...BLACK }
			: paintOn
				? colorFromHex(colorInput.value)
				: { ...BLACK };
	render();
}
function loadSample() {
	stopPreview(false);
	const pattern = ["00111100", "01000010", "10100101", "10000001", "10100101", "10011001", "01000010", "00111100"];
	const color = device === "mono" ? { r: 255, g: 255, b: 255 } : colorFromHex(colorInput.value);
	frames[currentFrameIndex] = pattern.flatMap((row) =>
		[...row].map((bit) => (bit === "1" ? { ...color } : { ...BLACK })),
	);
	render();
}
function addFrame(copyCurrent: boolean) {
	stopPreview(false);
	frames.push(copyCurrent ? currentFrame().map((color) => ({ ...color })) : blankFrame());
	currentFrameIndex = frames.length - 1;
	render();
}
function selectFrame(index: number) {
	if (!Number.isInteger(index) || index < 0 || index >= frames.length)
		throw new RangeError("frameIndex is out of range.");
	stopPreview(false);
	currentFrameIndex = index;
	render();
}
function deleteFrame(index = currentFrameIndex) {
	if (!Number.isInteger(index) || index < 0 || index >= frames.length)
		throw new RangeError("frameIndex is out of range.");
	if (frames.length === 1) throw new Error("The animation must keep at least one frame.");
	stopPreview(false);
	frames.splice(index, 1);
	currentFrameIndex = Math.min(currentFrameIndex, frames.length - 1);
	render();
}
function startPreview() {
	stopPreview(false);
	if (frames.length < 2) throw new Error("Add at least two frames to preview an animation.");
	previewTimer = window.setInterval(
		() => {
			if (currentFrameIndex + 1 >= frames.length && !loop.checked) return stopPreview();
			currentFrameIndex = (currentFrameIndex + 1) % frames.length;
			render();
		},
		validDuration(Number(frameDuration.value)),
	);
	playButton.disabled = true;
	stopButton.disabled = false;
	status.textContent = "Animation preview is running in this browser.";
}
function stopPreview(showStatus = true) {
	if (previewTimer !== undefined) window.clearInterval(previewTimer);
	previewTimer = undefined;
	playButton.disabled = frames.length < 2;
	stopButton.disabled = true;
	if (showStatus) status.textContent = "Animation preview stopped.";
}
function validDuration(value: number): number {
	if (!Number.isInteger(value) || value < 20 || value > 60_000)
		throw new RangeError("Frame time must be an integer from 20 to 60000 ms.");
	return value;
}
function configure(settings: Partial<MatrixSettings>) {
	stopPreview(false);
	if (settings.device !== undefined) device = settings.device;
	if (settings.rotation !== undefined) rotation.value = String(settings.rotation);
	if (settings.brightness !== undefined) brightness.value = String(settings.brightness);
	if (settings.frameDurationMs !== undefined) frameDuration.value = String(settings.frameDurationMs);
	if (settings.loop !== undefined) loop.checked = settings.loop;
	render();
}
function render() {
	const degrees = Number(rotation.value);
	matrix.style.setProperty("--rotation", `${degrees}deg`);
	matrix.style.setProperty("--brightness", String(0.15 + (Number(brightness.value) / 255) * 0.85));
	const frame = currentFrame();
	for (let index = 0; index < cells.length; index++) {
		const cell = cells[index];
		const value = frame[index] ?? BLACK;
		const on = isOn(value);
		cell?.style.setProperty("--pixel-color", device === "mono" ? "#f4fbef" : `rgb(${value.r} ${value.g} ${value.b})`);
		cell?.classList.toggle("is-on", on);
		cell?.setAttribute("aria-label", `Pixel ${(index % 8) + 1}, ${Math.floor(index / 8) + 1}: ${on ? "on" : "off"}`);
	}
	document.querySelectorAll<HTMLButtonElement>("[data-device]").forEach((button) => {
		button.setAttribute("aria-pressed", String(button.dataset.device === device));
	});
	colorField.hidden = device !== "rgb";
	eraser.setAttribute("aria-pressed", String(erasing));
	byId("device-caption").textContent = device === "mono" ? "White LED" : "RGB565 output";
	brightnessValue.textContent = brightness.value;
	framePosition.textContent = `Frame ${currentFrameIndex + 1} / ${frames.length}`;
	renderFrameList();
	playButton.disabled = previewTimer !== undefined || frames.length < 2;
	byId<HTMLButtonElement>("delete-frame").disabled = frames.length === 1;
	generatedCode.textContent = generateAnimationCode(
		device,
		frames,
		degrees,
		Number(brightness.value),
		validDuration(Number(frameDuration.value)),
		loop.checked,
	);
}
function renderFrameList() {
	frameList.replaceChildren();
	for (let index = 0; index < frames.length; index++) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = String(index + 1);
		button.setAttribute("aria-label", `Edit frame ${index + 1}`);
		button.setAttribute("aria-pressed", String(index === currentFrameIndex));
		button.addEventListener("click", () => selectFrame(index));
		frameList.append(button);
	}
}

const webmcpLifetime = new AbortController();
const webmcpTools = createMatrixTools({
	getState: () => ({
		device,
		rotation: Number(rotation.value),
		brightness: Number(brightness.value),
		frameDurationMs: Number(frameDuration.value),
		loop: loop.checked,
		currentFrameIndex,
		frames: frames.map((item) => item.map((color) => ({ ...color }))),
		playing: previewTimer !== undefined,
		generatedCode: generatedCode.textContent ?? "",
	}),
	configure,
	setPixel: (frameIndex, x, y, color) => {
		const index = frameIndex ?? currentFrameIndex;
		const target = frames[index];
		if (!target) throw new RangeError("frameIndex is out of range.");
		target[y * 8 + x] = color ? { ...color } : { ...BLACK };
		stopPreview(false);
		render();
	},
	addFrame,
	selectFrame,
	deleteFrame,
	preview: startPreview,
	stop: () => stopPreview(),
});
void registerMatrixTools(
	(document as Document & { modelContext?: ModelContext }).modelContext,
	webmcpTools,
	webmcpLifetime.signal,
).catch((error: unknown) => {
	webmcpLifetime.abort();
	console.warn("WebMCP tools could not be registered", error);
});
render();
