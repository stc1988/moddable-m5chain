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
	assertBoolean,
	assertIntegerInRange,
	assertScrollInterval,
	decodeScrollMode,
	decodeText,
	encodeCharacter,
	encodeCoordinate,
	encodeScrollMode,
	encodeText,
	type WireDirectionMap,
} from "matrixDisplayProtocol";

export type MonoPixel = DisplayCoordinate & {
	on: boolean;
};

export type MonoScrollOptions = {
	direction?: ScrollDirection;
	behavior?: ScrollBehavior;
	intervalMs?: number;
};

export type MonoScrollText = ScrollSettings & {
	text: string;
};

const MONO_DIRECTIONS: WireDirectionMap = Object.freeze({
	[SCROLL_DIRECTION.LEFT]: 1,
	[SCROLL_DIRECTION.RIGHT]: 0,
	[SCROLL_DIRECTION.UP]: 2,
	[SCROLL_DIRECTION.DOWN]: 3,
});

class M5ChainMono extends M5ChainMatrixDisplay {
	static DEVICE_TYPE = 0x000d;
	readonly kind = "mono" as const;

	async setPixel(x: number, y: number, on = true): Promise<void> {
		await this.setPixels([{ x, y, on }]);
	}

	async setPixels(pixels: readonly MonoPixel[]): Promise<void> {
		if (!Array.isArray(pixels) || pixels.length < 1 || pixels.length > 64) {
			throw new RangeError("pixels must contain between 1 and 64 entries.");
		}
		const data = new Uint8Array(pixels.length + 1);
		data[0] = pixels.length;
		for (let i = 0; i < pixels.length; i++) {
			assertBoolean(`pixels[${i}].on`, pixels[i].on);
			data[i + 1] = encodeCoordinate(pixels[i].x, pixels[i].y) | (pixels[i].on ? 0x40 : 0);
		}
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_PIXELS, data, data.length);
			this.assertOperationSucceeded("setPixels", packet[6], true);
		});
	}

	async getPixel(x: number, y: number): Promise<boolean> {
		const values = await this.getPixels([{ x, y }]);
		return values[0];
	}

	async getPixels(coordinates: readonly DisplayCoordinate[]): Promise<boolean[]> {
		if (!Array.isArray(coordinates) || coordinates.length < 1 || coordinates.length > 64) {
			throw new RangeError("coordinates must contain between 1 and 64 entries.");
		}
		const data = new Uint8Array(coordinates.length + 1);
		data[0] = coordinates.length;
		for (let i = 0; i < coordinates.length; i++) {
			data[i + 1] = encodeCoordinate(coordinates[i].x, coordinates[i].y);
		}
		return await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.GET_PIXELS, data, data.length);
			const values: boolean[] = [];
			for (let i = 0; i < coordinates.length; i++) {
				if (packet[6 + i] !== 0 && packet[6 + i] !== 1) {
					throw new Error(`Unknown Mono pixel state: ${packet[6 + i]}`);
				}
				values.push(packet[6 + i] === 1);
			}
			return values;
		});
	}

	async writeFrame(rows: Uint8Array): Promise<void> {
		if (!(rows instanceof Uint8Array) || rows.length !== 8) {
			throw new RangeError("rows must be a Uint8Array containing exactly 8 bytes.");
		}
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.WRITE_FRAME, rows, rows.length);
			this.assertOperationSucceeded("writeFrame", packet[6], true);
		});
	}

	async readFrame(): Promise<Uint8Array> {
		return await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.READ_FRAME, new Uint8Array(0), 0);
			return packet.slice(6, 14);
		});
	}

	async drawCharacter(character: string, options: { x?: number; y?: number } = {}): Promise<void> {
		const x = options.x ?? 0;
		const y = options.y ?? 0;
		assertIntegerInRange("options.x", x, 0, 7);
		assertIntegerInRange("options.y", y, 0, 7);
		const data = new Uint8Array([encodeCharacter(character), (x << 4) | y]);
		await this.withPixelMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.DRAW_CHARACTER, data, data.length);
			this.assertOperationSucceeded("drawCharacter", packet[6], true);
		});
	}

	async scrollText(text: string, options: MonoScrollOptions = {}): Promise<void> {
		const encodedText = encodeText(text);
		const direction = options.direction ?? SCROLL_DIRECTION.LEFT;
		const behavior = options.behavior ?? SCROLL_BEHAVIOR.LOOP;
		const intervalMs = options.intervalMs ?? 100;
		assertScrollInterval(intervalMs);
		const data = new Uint8Array(encodedText.length + 4);
		data[0] = encodeScrollMode(direction, behavior, MONO_DIRECTIONS);
		data[1] = intervalMs & 0xff;
		data[2] = (intervalMs >> 8) & 0xff;
		data[3] = encodedText.length;
		data.set(encodedText, 4);
		await this.withScrollMode(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_SCROLL_TEXT, data, data.length);
			this.assertOperationSucceeded("scrollText", packet[6], true);
			await this.applyScrollState(SCROLL_STATE.RUNNING);
		});
	}

	async readScrollText(): Promise<MonoScrollText> {
		return await this.withScrollMode(async () => {
			const packet = await this.bus.sendAndWait(
				this.id,
				M5ChainMatrixDisplay.CMD.GET_SCROLL_TEXT,
				new Uint8Array(0),
				0,
			);
			const mode = decodeScrollMode(packet[6], MONO_DIRECTIONS);
			const intervalMs = packet[7] | (packet[8] << 8);
			const length = packet[9];
			return {
				text: decodeText(packet, 10, length),
				...mode,
				intervalMs,
			};
		});
	}

	protected brightnessToWire(brightness: number): number {
		return Math.round(brightness * 7);
	}

	protected brightnessFromWire(value: number): number {
		assertIntegerInRange("Mono brightness", value, 0, 7);
		return value / 7;
	}
}

export default M5ChainMono;
