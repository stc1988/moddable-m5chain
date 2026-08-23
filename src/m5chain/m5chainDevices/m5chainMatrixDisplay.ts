import { assertKnownConfigurationOptions, M5ChainDevice, readPacketByte } from "m5chainDevice";
import {
	assertBoolean,
	assertUnitInterval,
	type MatrixRotation,
	rotationFromWire,
	rotationToWire,
	SCROLL_STATE,
	type ScrollState,
	scrollStateFromWire,
	scrollStateToWire,
} from "matrixDisplayProtocol";
import type { DeviceConfiguration, DeviceConfigurationSnapshot } from "types";

export {
	type DisplayCoordinate,
	MATRIX_ROTATION,
	type MatrixRotation,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
	SCROLL_STATE,
	type ScrollBehavior,
	type ScrollDirection,
	type ScrollSettings,
	type ScrollState,
} from "matrixDisplayProtocol";

export type MatrixDisplayConfiguration = DeviceConfiguration & {
	rotation?: MatrixRotation;
	brightness?: number;
	saveToFlash?: boolean;
};

export type MatrixDisplayConfigurationSnapshot = DeviceConfigurationSnapshot & {
	rotation: MatrixRotation;
	brightness: number;
};

const DISPLAY_MODE = Object.freeze({
	PIXEL: 0,
	SCROLL: 1,
} as const);
type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];

abstract class M5ChainMatrixDisplay extends M5ChainDevice {
	static CMD = Object.freeze({
		...M5ChainDevice.CMD,
		SET_DISPLAY_MODE: 0x10,
		GET_DISPLAY_MODE: 0x11,
		SET_PIXELS: 0x30,
		WRITE_FRAME: 0x31,
		GET_PIXELS: 0x32,
		READ_FRAME: 0x33,
		DRAW_CHARACTER: 0x34,
		SET_SCROLL_TEXT: 0x40,
		GET_SCROLL_TEXT: 0x41,
		SET_SCROLL_STATE: 0x42,
		GET_SCROLL_STATE: 0x43,
		SET_ROTATION: 0xe0,
		GET_ROTATION: 0xe1,
		SET_BRIGHTNESS: 0xe2,
		GET_BRIGHTNESS: 0xe3,
		CLEAR: 0xe4,
	} as const);

	readonly width = 8;
	readonly height = 8;

	#displayMode: DisplayMode | undefined;
	#operationMutex: Promise<void> = Promise.resolve();

	async configure(options: MatrixDisplayConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["rotation", "brightness", "saveToFlash"]);
		await super.configure(options);
		const saveToFlash = options.saveToFlash ?? false;
		assertBoolean("options.saveToFlash", saveToFlash);
		if (options.rotation !== undefined) {
			await this.setRotation(options.rotation, saveToFlash);
		}
		if (options.brightness !== undefined) {
			await this.setBrightness(options.brightness, saveToFlash);
		}
	}

	async readConfiguration(): Promise<MatrixDisplayConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			rotation: await this.getRotation(),
			brightness: await this.getBrightness(),
		};
	}

	async clear(): Promise<void> {
		await this.withDisplayLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.CLEAR, new Uint8Array(0), 0);
			this.assertOperationSucceeded("clear", readPacketByte(packet, 6, "clear matrix display"));
		});
	}

	async setRotation(rotation: MatrixRotation, saveToFlash = false): Promise<void> {
		const wireRotation = rotationToWire(rotation);
		assertBoolean("saveToFlash", saveToFlash);
		await this.withDisplayLock(async () => {
			const data = new Uint8Array([wireRotation, saveToFlash ? 1 : 0]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_ROTATION, data, data.length);
			this.assertOperationSucceeded("setRotation", readPacketByte(packet, 6, "set matrix rotation"));
		});
	}

	async getRotation(): Promise<MatrixRotation> {
		return await this.withDisplayLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.GET_ROTATION, new Uint8Array(0), 0);
			return rotationFromWire(readPacketByte(packet, 6, "get matrix rotation"));
		});
	}

	async setBrightness(brightness: number, saveToFlash = false): Promise<void> {
		assertUnitInterval("brightness", brightness);
		assertBoolean("saveToFlash", saveToFlash);
		await this.withDisplayLock(async () => {
			const data = new Uint8Array([this.brightnessToWire(brightness), saveToFlash ? 1 : 0]);
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_BRIGHTNESS, data, data.length);
			this.assertOperationSucceeded("setBrightness", readPacketByte(packet, 6, "set matrix brightness"));
		});
	}

	async getBrightness(): Promise<number> {
		return await this.withDisplayLock(async () => {
			const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.GET_BRIGHTNESS, new Uint8Array(0), 0);
			return this.brightnessFromWire(readPacketByte(packet, 6, "get matrix brightness"));
		});
	}

	async pauseScrolling(): Promise<void> {
		await this.setScrollingState(SCROLL_STATE.PAUSED);
	}

	async resumeScrolling(): Promise<void> {
		await this.setScrollingState(SCROLL_STATE.RUNNING);
	}

	async stopScrolling(): Promise<void> {
		await this.setScrollingState(SCROLL_STATE.STOPPED);
	}

	async getScrollState(): Promise<ScrollState> {
		return await this.withDisplayLock(async () => {
			const packet = await this.bus.sendAndWait(
				this.id,
				M5ChainMatrixDisplay.CMD.GET_SCROLL_STATE,
				new Uint8Array(0),
				0,
			);
			return scrollStateFromWire(readPacketByte(packet, 6, "get matrix scroll state"));
		});
	}

	protected abstract brightnessToWire(brightness: number): number;
	protected abstract brightnessFromWire(value: number): number;

	protected async withPixelMode<T>(operation: () => Promise<T>): Promise<T> {
		return await this.withDisplayLock(async () => {
			await this.ensureDisplayMode(DISPLAY_MODE.PIXEL);
			return await operation();
		});
	}

	protected async withScrollMode<T>(operation: () => Promise<T>): Promise<T> {
		return await this.withDisplayLock(async () => {
			await this.ensureDisplayMode(DISPLAY_MODE.SCROLL);
			return await operation();
		});
	}

	protected async applyScrollState(state: ScrollState): Promise<void> {
		const data = new Uint8Array([scrollStateToWire(state)]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_SCROLL_STATE, data, data.length);
		this.assertOperationSucceeded("set scroll state", readPacketByte(packet, 6, "set matrix scroll state"), true);
	}

	protected assertOperationSucceeded(operation: string, status: number, modeMismatchPossible = false) {
		if (status === 1) return;
		if (modeMismatchPossible && status === 2) {
			this.#displayMode = undefined;
			throw new Error(`${operation} failed: display mode mismatch.`);
		}
		throw new Error(`${operation} failed.`);
	}

	private async setScrollingState(state: ScrollState): Promise<void> {
		await this.withScrollMode(async () => {
			await this.applyScrollState(state);
		});
	}

	private async ensureDisplayMode(mode: DisplayMode) {
		if (this.#displayMode === mode) return;
		const data = new Uint8Array([mode]);
		const packet = await this.bus.sendAndWait(this.id, M5ChainMatrixDisplay.CMD.SET_DISPLAY_MODE, data, data.length);
		this.assertOperationSucceeded("set display mode", readPacketByte(packet, 6, "set matrix display mode"));
		this.#displayMode = mode;
	}

	private async withDisplayLock<T>(operation: () => Promise<T>): Promise<T> {
		let release: (() => void) | undefined;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		const previous = this.#operationMutex;
		this.#operationMutex = previous.then(() => current);
		await previous;
		try {
			return await operation();
		} finally {
			release?.();
		}
	}
}

export default M5ChainMatrixDisplay;
