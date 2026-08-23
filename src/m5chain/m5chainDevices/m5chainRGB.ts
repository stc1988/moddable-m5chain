import { readPacketByte, readPacketUint16LE } from "m5chainDevice";
import M5ChainMatrixDisplay, {
	type DisplayCoordinate,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
	SCROLL_STATE,
	type ScrollBehavior,
	type ScrollDirection,
	type ScrollSettings,
} from "m5chainMatrixDisplay";
import {
	assertColor,
	assertIntegerInRange,
	assertScrollInterval,
	colorFromRgb565,
	colorToRgb565,
	decodeScrollMode,
	decodeText,
	encodeCharacter,
	encodeCoordinate,
	encodeScrollMode,
	encodeText,
	type WireDirectionMap,
	writeRgb565,
} from "matrixDisplayProtocol";
import type { LedColor } from "types";

export {
	type DisplayCoordinate,
	MATRIX_ROTATION,
	type MatrixDisplayConfiguration,
	type MatrixDisplayConfigurationSnapshot,
	type MatrixRotation,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
	SCROLL_STATE,
	type ScrollBehavior,
	type ScrollDirection,
	type ScrollSettings,
	type ScrollState,
} from "m5chainMatrixDisplay";
export type { LedColor } from "types";

export type RgbMatrixPixel = DisplayCoordinate & {
	color: LedColor;
};

export type RgbScrollColor = LedColor | "gradient";

export type RgbScrollOptions = {
	direction?: ScrollDirection;
	behavior?: ScrollBehavior;
	intervalMs?: number;
	color?: RgbScrollColor;
};

export type RgbScrollText = ScrollSettings & {
	text: string;
	color: RgbScrollColor;
};

const RGB_DIRECTIONS: WireDirectionMap = Object.freeze({
	[SCROLL_DIRECTION.LEFT]: 0,
	[SCROLL_DIRECTION.RIGHT]: 1,
	[SCROLL_DIRECTION.UP]: 2,
	[SCROLL_DIRECTION.DOWN]: 3,
});

class M5ChainRGB extends M5ChainMatrixDisplay {
	static DEVICE_TYPE = 0x000e;
	readonly kind = "rgb" as const;

	async setPixel(x: number, y: number, color: LedColor): Promise<void> {
		await this.setPixels([{ x, y, color }]);
	}

	async setPixels(pixels: readonly RgbMatrixPixel[]): Promise<void> {
		if (!Array.isArray(pixels) || pixels.length < 1 || pixels.length > 64) {
			throw new RangeError("pixels must contain between 1 and 64 entries.");
		}
		const data = new Uint8Array(pixels.length * 3 + 1);
		data[0] = pixels.length;
		for (let i = 0; i < pixels.length; i++) {
			const pixel = pixels[i];
			if (!pixel) throw new RangeError(`pixels must contain an entry at index ${i}.`);
			assertColor(`pixels[${i}].color`, pixel.color);
			data[i * 3 + 1] = encodeCoordinate(pixel.x, pixel.y);
			writeRgb565(data, i * 3 + 2, colorToRgb565(pixel.color));
		}
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_PIXELS, data, data.length);
			this.assertOperationSucceeded("setPixels", readPacketByte(packet, 6, "set RGB pixels"), true);
		});
	}

	async getPixel(x: number, y: number): Promise<LedColor> {
		const values = await this.getPixels([{ x, y }]);
		const value = values[0];
		if (!value) throw new Error("getPixel returned no color.");
		return value;
	}

	async getPixels(coordinates: readonly DisplayCoordinate[]): Promise<LedColor[]> {
		if (!Array.isArray(coordinates) || coordinates.length < 1 || coordinates.length > 64) {
			throw new RangeError("coordinates must contain between 1 and 64 entries.");
		}
		const data = new Uint8Array(coordinates.length + 1);
		data[0] = coordinates.length;
		for (let i = 0; i < coordinates.length; i++) {
			const coordinate = coordinates[i];
			if (!coordinate) throw new RangeError(`coordinates must contain an entry at index ${i}.`);
			data[i + 1] = encodeCoordinate(coordinate.x, coordinate.y);
		}
		return await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.GET_PIXELS, data, data.length);
			const values: LedColor[] = [];
			for (let i = 0; i < coordinates.length; i++) {
				values.push(colorFromRgb565(readPacketUint16LE(packet, 6 + i * 2, "get RGB pixels")));
			}
			return values;
		});
	}

	async writeFrame(colors: readonly LedColor[]): Promise<void> {
		if (!Array.isArray(colors) || colors.length !== 64) {
			throw new RangeError("colors must contain exactly 64 entries.");
		}
		const data = new Uint8Array(128);
		for (let i = 0; i < colors.length; i++) {
			const color = colors[i];
			if (!color) throw new RangeError(`colors must contain an entry at index ${i}.`);
			assertColor(`colors[${i}]`, color);
			writeRgb565(data, i * 2, colorToRgb565(color));
		}
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.WRITE_FRAME, data, data.length);
			this.assertOperationSucceeded("writeFrame", readPacketByte(packet, 6, "write RGB frame"), true);
		});
	}

	async readFrame(): Promise<LedColor[]> {
		return await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.READ_FRAME, new Uint8Array(0), 0);
			const colors: LedColor[] = [];
			for (let i = 0; i < 64; i++) {
				colors.push(colorFromRgb565(readPacketUint16LE(packet, 6 + i * 2, "read RGB frame")));
			}
			return colors;
		});
	}

	async drawCharacter(character: string, options: { x?: number; y?: number; color?: LedColor } = {}): Promise<void> {
		const x = options.x ?? 0;
		const y = options.y ?? 0;
		const color = options.color ?? { r: 255, g: 255, b: 255 };
		assertIntegerInRange("options.x", x, 0, 7);
		assertIntegerInRange("options.y", y, 0, 7);
		assertColor("options.color", color);
		const data = new Uint8Array(4);
		data[0] = encodeCharacter(character);
		data[1] = (x << 4) | y;
		writeRgb565(data, 2, colorToRgb565(color));
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.DRAW_CHARACTER, data, data.length);
			this.assertOperationSucceeded("drawCharacter", readPacketByte(packet, 6, "draw RGB character"), true);
		});
	}

	async scrollText(text: string, options: RgbScrollOptions = {}): Promise<void> {
		const encodedText = encodeText(text);
		const direction = options.direction ?? SCROLL_DIRECTION.LEFT;
		const behavior = options.behavior ?? SCROLL_BEHAVIOR.LOOP;
		const intervalMs = options.intervalMs ?? 100;
		const color = options.color ?? "gradient";
		assertScrollInterval(intervalMs);
		let wireColor = 0;
		if (color !== "gradient") {
			assertColor("options.color", color);
			wireColor = colorToRgb565(color);
			if (wireColor === 0) {
				throw new RangeError("RGB scrolling color black is reserved by the device for the gradient effect.");
			}
		}
		const data = new Uint8Array(encodedText.length + 6);
		data[0] = encodeScrollMode(direction, behavior, RGB_DIRECTIONS);
		data[1] = intervalMs & 0xff;
		data[2] = (intervalMs >> 8) & 0xff;
		writeRgb565(data, 3, wireColor);
		data[5] = encodedText.length;
		data.set(encodedText, 6);
		await this.withScrollMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_SCROLL_TEXT, data, data.length);
			this.assertOperationSucceeded("scrollText", readPacketByte(packet, 6, "set RGB scroll text"), true);
			await this.applyScrollState(SCROLL_STATE.RUNNING);
		});
	}

	async readScrollText(): Promise<RgbScrollText> {
		return await this.withScrollMode(async () => {
			const packet = await this.bus.sendAndWait(
				this.id,
				M5ChainMatrixDisplay.CMD.GET_SCROLL_TEXT,
				new Uint8Array(0),
				0,
			);
			const mode = decodeScrollMode(readPacketByte(packet, 6, "get RGB scroll text"), RGB_DIRECTIONS);
			const intervalMs = readPacketUint16LE(packet, 7, "get RGB scroll text");
			const wireColor = readPacketUint16LE(packet, 9, "get RGB scroll text");
			const length = readPacketByte(packet, 11, "get RGB scroll text");
			return {
				text: decodeText(packet, 12, length),
				...mode,
				intervalMs,
				color: wireColor === 0 ? "gradient" : colorFromRgb565(wireColor),
			};
		});
	}

	protected brightnessToWire(brightness: number): number {
		return Math.round(brightness * 100);
	}

	protected brightnessFromWire(value: number): number {
		assertIntegerInRange("RGB brightness", value, 0, 100);
		return value / 100;
	}
}

export default M5ChainRGB;
