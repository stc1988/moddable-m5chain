import CanSample from "canSample";
import HasKey from "hasKey";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, SampleHandler } from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

export type JoystickValue = {
	x: number;
	y: number;
};

export type JoystickMappedRange = {
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
};

export type JoystickConfiguration = DeviceConfiguration & {
	joystick?: {
		mappedRange?: JoystickMappedRange;
	};
};

export type JoystickConfigurationSnapshot = DeviceConfigurationSnapshot & {
	joystick: {
		mappedRange: JoystickMappedRange;
	};
};

class M5ChainJoyStick extends withDeviceFeatures(HasLed, HasKey, CanSample<JoystickValue>) {
	static DEVICE_TYPE = 0x0004;
	static CMD = {
		...super.CMD,
		GET_16ADC: 0x30 /**< Command to get 16-bit ADC values */,
		GET_8ADC: 0x31 /**< Command to get 8-bit ADC values */,
		GET_ADC_XY_MAPPED_RANGE: 0x32 /**< Command to get mapped range for X and Y axes */,
		SET_ADC_XY_MAPPED_RANGE: 0x33 /**< Command to set mapped range for X and Y axes */,
		GET_ADC_XY_MAPPED_INT16_VALUE: 0x34 /**< Command to get 16-bit mapped values for X and Y */,
		GET_ADC_XY_MAPPED_INT8_VALUE: 0x35 /**< Command to get 8-bit mapped values for X and Y */,
	} as const;
	declare onSample: SampleHandler<JoystickValue>;
	declare sample: () => JoystickValue | undefined;
	declare dispatchOnSample: (value: JoystickValue) => void;

	async configure(options: JoystickConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["key", "joystick"]);
		await super.configure(options);
		if (options.joystick === undefined) return;
		assertObjectOption("options.joystick", options.joystick);
		if (options.joystick.mappedRange !== undefined) {
			const range = options.joystick.mappedRange;
			assertObjectOption("options.joystick.mappedRange", range);
			await this.#setJoystickMappedRange(range.xMin, range.xMax, range.yMin, range.yMax);
		}
	}

	async readConfiguration(): Promise<JoystickConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			joystick: {
				mappedRange: await this.#getJoystickMappedRange(),
			},
		};
	}

	async readSample(): Promise<JoystickValue> {
		return await this.getJoystickMappedInt8Value();
	}

	// 0 ~ 65535
	async getJoystick16Adc(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_16ADC, bus.cmdBuffer, 0);
		return {
			x: (packet[7] << 8) | packet[6],
			y: (packet[9] << 8) | packet[8],
		};
	}
	//0 ~ 255
	async getJoystick8Adc(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return {
			x: packet[6],
			y: packet[7],
		};
	}
	async #getJoystickMappedRange(): Promise<JoystickMappedRange> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_RANGE, bus.cmdBuffer, 0);
		return {
			xMin: packet[6],
			xMax: packet[7],
			yMin: packet[8],
			yMax: packet[9],
		};
	}
	async #setJoystickMappedRange(xMin: number, xMax: number, yMin: number, yMax: number): Promise<void> {
		const bus = this.bus;
		const cmdBuffer = bus.cmdBuffer;
		cmdBuffer[0] = xMin;
		cmdBuffer[1] = xMax;
		cmdBuffer[2] = yMin;
		cmdBuffer[3] = yMax;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.SET_ADC_XY_MAPPED_RANGE, cmdBuffer, 4);
		const result = packet[6];
		if (result !== 1) {
			throw new Error("configure joystick mapped range failed.\n");
		}
	}
	//-4095-4095
	async getJoystickMappedInt16Value(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT16_VALUE, bus.cmdBuffer, 0);
		const x = (packet[7] << 8) | packet[6];
		const y = (packet[9] << 8) | packet[8];
		return {
			x: (x << 16) >> 16,
			y: (y << 16) >> 16,
		};
	}
	//  -128~127
	async getJoystickMappedInt8Value(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT8_VALUE, bus.cmdBuffer, 0);
		return {
			x: (packet[6] << 24) >> 24,
			y: (packet[7] << 24) >> 24,
		};
	}
}

export default M5ChainJoyStick;
