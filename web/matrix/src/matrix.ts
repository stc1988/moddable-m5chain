export type DeviceType = "mono" | "rgb";
export type Color = { r: number; g: number; b: number };

export const BLACK: Color = Object.freeze({ r: 0, g: 0, b: 0 });
export const DEFAULT_COLOR: Color = Object.freeze({ r: 85, g: 219, b: 225 });

export function isOn(color: Color): boolean {
	return color.r !== 0 || color.g !== 0 || color.b !== 0;
}

export function packMonoRows(frame: readonly Color[]): number[] {
	assertFrame(frame);
	return Array.from({ length: 8 }, (_, y) => {
		let row = 0;
		for (let x = 0; x < 8; x++) if (isOn(frame[y * 8 + x] as Color)) row |= 1 << (7 - x);
		return row;
	});
}

export function generateCode(
	device: DeviceType,
	frame: readonly Color[],
	rotation: number,
	brightness: number,
): string {
	assertFrame(frame);
	if (![0, 90, 180, 270].includes(rotation)) throw new RangeError("rotation must be 0, 90, 180, or 270.");
	if (!Number.isInteger(brightness) || brightness < 0 || brightness > 255)
		throw new RangeError("brightness must be an integer between 0 and 255.");
	const name = device === "mono" ? "mono" : "rgb";
	const className = device === "mono" ? "M5ChainMono" : "M5ChainRGB";
	const lines = [
		'import M5Chain from "m5chain";',
		`import ${className}, { MATRIX_ROTATION } from "m5chain${device === "mono" ? "Mono" : "RGB"}";`,
		"",
		`const m5chain = new M5Chain({ deviceClasses: [${className}] });`,
		"await m5chain.start();",
		`const ${name} = m5chain.devices.find((device) => device.kind === "${name}");`,
		`if (!${name}) throw new Error("M5Chain ${device === "mono" ? "Mono" : "RGB"} was not found.");`,
		"",
		`await ${name}.configure({`,
		`\trotation: MATRIX_ROTATION.DEG_${rotation},`,
		`\tbrightness: ${brightness},`,
		"});",
		"",
	];
	if (device === "mono") {
		lines.push(`await mono.writeFrame(new Uint8Array([${packMonoRows(frame).map(formatByte).join(", ")}]));`);
	} else {
		lines.push("const frame = [");
		for (let y = 0; y < 8; y++) {
			const row = frame.slice(y * 8, y * 8 + 8).map(({ r, g, b }) => `{ r: ${r}, g: ${g}, b: ${b} }`);
			lines.push(`\t${row.join(", ")},`);
		}
		lines.push("];", "", "await rgb.writeFrame(frame);");
	}
	return lines.join("\n");
}

export function colorFromHex(value: string): Color {
	if (!/^#[0-9a-f]{6}$/i.test(value)) throw new RangeError("color must use #RRGGBB format.");
	return {
		r: Number.parseInt(value.slice(1, 3), 16),
		g: Number.parseInt(value.slice(3, 5), 16),
		b: Number.parseInt(value.slice(5, 7), 16),
	};
}

function assertFrame(frame: readonly Color[]) {
	if (!Array.isArray(frame) || frame.length !== 64) throw new RangeError("frame must contain exactly 64 colors.");
}

function formatByte(value: number): string {
	return `0b${value.toString(2).padStart(8, "0")}`;
}
