import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, LedColor } from "types";

type HasLedMethods = {
	setLedColor(r: number, g: number, b: number): Promise<void>;
	getLedColor(): Promise<LedColor>;
	setLedColors(index: number, num: number, colors: LedColor[]): Promise<void>;
	getLedColors(index: number, num: number): Promise<LedColor[]>;
	setLedBrightness(brightness: number, saveToFlash?: boolean): Promise<void>;
	getLedBrightness(): Promise<number>;
};

type RgbCommandSet = {
	RGB: {
		SET_RGB_VALUE: number;
		GET_RGB_VALUE: number;
		SET_RGB_LIGHT: number;
		GET_RGB_LIGHT: number;
	};
};

function assertIntegerInRange(name: string, value: number, min: number, max: number) {
	if (typeof value !== "number" || Number.isNaN(value) || value !== Math.floor(value) || value < min || value > max) {
		throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
	}
}

function assertUnitInterval(name: string, value: number) {
	if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
		throw new RangeError(`${name} must be between 0 and 1.`);
	}
}

const HasLed = <TBase extends DeviceConstructor<M5ChainDevice>>(Base: TBase) =>
	class extends Base {
		static CMD = {
			RGB: {
				SET_RGB_VALUE: 0x20 /**< Set RGB value. */,
				GET_RGB_VALUE: 0x21 /**< Get RGB value. */,
				SET_RGB_LIGHT: 0x22 /**< Set RGB brightness. */,
				GET_RGB_LIGHT: 0x23 /**< Get RGB brightness. */,
			},
		} as const;

		async setLedColor(r: number, g: number, b: number): Promise<void> {
			return await this.setLedColors(0, 1, [{ r, g, b }]);
		}

		async getLedColor(): Promise<LedColor> {
			const colors = await this.getLedColors(0, 1);
			return colors[0];
		}

		async setLedColors(index: number, num: number, colors: LedColor[]) {
			assertIntegerInRange("index", index, 0, 255);
			assertIntegerInRange("num", num, 0, 255);
			if (!Array.isArray(colors)) {
				throw new RangeError("colors must be an array.");
			}
			if (colors.length < num) {
				throw new RangeError(`colors must contain at least ${num} entries.`);
			}
			for (let i = 0; i < num; i++) {
				assertIntegerInRange(`colors[${i}].r`, colors[i].r, 0, 255);
				assertIntegerInRange(`colors[${i}].g`, colors[i].g, 0, 255);
				assertIntegerInRange(`colors[${i}].b`, colors[i].b, 0, 255);
			}
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			const commands = (this.constructor as typeof Base & { CMD: RgbCommandSet }).CMD;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			for (let i = 0; i < num; i++) {
				cmdBuffer[2 + i * 3] = colors[i].r;
				cmdBuffer[3 + i * 3] = colors[i].g;
				cmdBuffer[4 + i * 3] = colors[i].b;
			}
			const packet = await bus.sendAndWait(this.id, commands.RGB.SET_RGB_VALUE, cmdBuffer, num * 3 + 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setLedColors failed.\n");
			}
		}

		async getLedColors(index: number, num: number): Promise<LedColor[]> {
			assertIntegerInRange("index", index, 0, 255);
			assertIntegerInRange("num", num, 0, 255);
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			const commands = (this.constructor as typeof Base & { CMD: RgbCommandSet }).CMD;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			const packet = await bus.sendAndWait(this.id, commands.RGB.GET_RGB_VALUE, cmdBuffer, 2);
			let start = 6;
			let count = num;
			if (packet[6] === index && packet[7] === num) {
				start = 8;
				count = packet[7];
			}
			const colors: LedColor[] = [];
			for (let i = 0; i < count; i++) {
				colors.push({
					r: packet[start + i * 3],
					g: packet[start + i * 3 + 1],
					b: packet[start + i * 3 + 2],
				});
			}
			return colors;
		}

		async setLedBrightness(brightness: number, saveToFlash = false) {
			assertUnitInterval("brightness", brightness);
			if (saveToFlash !== true && saveToFlash !== false) {
				throw new RangeError("saveToFlash must be a boolean.");
			}
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			const commands = (this.constructor as typeof Base & { CMD: RgbCommandSet }).CMD;
			cmdBuffer[0] = Math.round(brightness * 100);
			cmdBuffer[1] = saveToFlash ? 1 : 0;
			const packet = await bus.sendAndWait(this.id, commands.RGB.SET_RGB_LIGHT, cmdBuffer, 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error("setLedBrightness failed.\n");
			}
		}

		async getLedBrightness(): Promise<number> {
			const bus = this.bus;
			const commands = (this.constructor as typeof Base & { CMD: RgbCommandSet }).CMD;
			const packet = await bus.sendAndWait(this.id, commands.RGB.GET_RGB_LIGHT, bus.cmdBuffer, 0);
			return packet[6] / 100;
		}
	};

export default HasLed as DeviceMixin<DeviceConstructor<M5ChainDevice>, HasLedMethods>;
