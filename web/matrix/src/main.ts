import "./styles.css";
import { BLACK, colorFromHex, type DeviceType, generateCode, isOn } from "./matrix";

const byId = <T extends HTMLElement>(id: string) => {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing #${id}`);
	return element as T;
};

const initialDevice = new URLSearchParams(location.search).get("device");
let device: DeviceType = initialDevice === "rgb" ? "rgb" : "mono";
let frame = Array.from({ length: 64 }, () => ({ ...BLACK }));
let painting = false;
let paintOn = true;
let erasing = false;

const matrix = byId<HTMLDivElement>("matrix");
const colorInput = byId<HTMLInputElement>("color");
const colorField = byId<HTMLElement>("color-field");
const eraser = byId<HTMLButtonElement>("eraser");
const rotation = byId<HTMLSelectElement>("rotation");
const brightness = byId<HTMLInputElement>("brightness");
const brightnessValue = byId<HTMLOutputElement>("brightness-value");
const generatedCode = byId<HTMLElement>("generated-code");
const status = byId<HTMLOutputElement>("status");
const cells: HTMLButtonElement[] = [];

for (let index = 0; index < 64; index++) {
	const cell = document.createElement("button");
	cell.type = "button";
	cell.className = "pixel";
	cell.dataset.index = String(index);
	cell.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		painting = true;
		paintOn = device === "mono" ? !isOn(frame[index] ?? BLACK) : !erasing;
		paint(index);
		cell.setPointerCapture(event.pointerId);
	});
	cell.addEventListener("pointerenter", () => {
		if (painting) paint(index);
	});
	cell.addEventListener("click", (event) => {
		if (event.detail === 0) {
			paintOn = device === "mono" ? !isOn(frame[index] ?? BLACK) : !erasing;
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
byId<HTMLButtonElement>("clear").addEventListener("click", () => {
	frame = frame.map(() => ({ ...BLACK }));
	render();
});
byId<HTMLButtonElement>("sample").addEventListener("click", () => {
	const pattern = ["00111100", "01000010", "10100101", "10000001", "10100101", "10011001", "01000010", "00111100"];
	const color = device === "mono" ? { r: 255, g: 255, b: 255 } : colorFromHex(colorInput.value);
	frame = pattern.flatMap((row) => [...row].map((bit) => (bit === "1" ? { ...color } : { ...BLACK })));
	render();
});
byId<HTMLButtonElement>("copy").addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(generatedCode.textContent ?? "");
		status.textContent = "Copied to clipboard.";
	} catch {
		status.textContent = "Clipboard access failed. Select the code and copy it manually.";
	}
});

function paint(index: number) {
	frame[index] =
		device === "mono"
			? paintOn
				? { r: 255, g: 255, b: 255 }
				: { ...BLACK }
			: paintOn
				? colorFromHex(colorInput.value)
				: { ...BLACK };
	render();
}

function render() {
	const level = Number(brightness.value) / 255;
	const degrees = Number(rotation.value);
	matrix.style.setProperty("--rotation", `${degrees}deg`);
	matrix.style.setProperty("--brightness", String(0.15 + level * 0.85));
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
	generatedCode.textContent = generateCode(device, frame, degrees, Number(brightness.value));
}

render();
