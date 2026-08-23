import CanSample, { type CanSampleMethods } from "canSample";
import HasKey, { type HasKeyMethods } from "hasKey";
import HasLed, { type HasLedMethods } from "hasLed";
import {
	assertKnownConfigurationOptions,
	assertObjectOption,
	readPacketByte,
	readPacketInt8,
	readPacketInt16LE,
	readPacketUint16LE,
	withDeviceFeatures,
} from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot } from "types";

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
	mappedRange?: JoystickMappedRange;
};

export type JoystickConfigurationSnapshot = DeviceConfigurationSnapshot & {
	mappedRange: JoystickMappedRange;
};

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Runtime mixins install the merged feature methods.
class M5ChainJoyStick extends withDeviceFeatures(HasLed, HasKey, CanSample<JoystickValue>()) {
	static DEVICE_TYPE = 0x0004;
	readonly kind = "joystick" as const;
	static CMD = Object.freeze({
		...super.CMD,
		GET_16ADC: 0x30 /**< Command to get 16-bit ADC values */,
		GET_8ADC: 0x31 /**< Command to get 8-bit ADC values */,
		GET_ADC_XY_MAPPED_RANGE: 0x32 /**< Command to get mapped range for X and Y axes */,
		SET_ADC_XY_MAPPED_RANGE: 0x33 /**< Command to set mapped range for X and Y axes */,
		GET_ADC_XY_MAPPED_INT16_VALUE: 0x34 /**< Command to get 16-bit mapped values for X and Y */,
		GET_ADC_XY_MAPPED_INT8_VALUE: 0x35 /**< Command to get 8-bit mapped values for X and Y */,
	} as const);
	async configure(options: JoystickConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["key", "mappedRange"]);
		await super.configure(options);
		if (options.mappedRange !== undefined) {
			const range = options.mappedRange;
			assertObjectOption("options.mappedRange", range);
			await this.#setJoystickMappedRange(range.xMin, range.xMax, range.yMin, range.yMax);
		}
	}

	async readConfiguration(): Promise<JoystickConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			mappedRange: await this.#getJoystickMappedRange(),
		};
	}

	async readSample(): Promise<JoystickValue | undefined> {
		const bus = this.bus;
		const packet = await bus.sendAndWaitForResult(
			this.id,
			M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT8_VALUE,
			bus.cmdBuffer,
			0,
		);
		if (!(packet instanceof Uint8Array)) {
			throw new Error(`JoyStick sample read failed: ${packet.__m5chain}`);
		}
		return {
			x: readPacketInt8(packet, 6, "read joystick sample"),
			y: readPacketInt8(packet, 7, "read joystick sample"),
		};
	}

	// 0 ~ 65535
	async getJoystick16Adc(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_16ADC, bus.cmdBuffer, 0);
		return {
			x: readPacketUint16LE(packet, 6, "get 16-bit joystick ADC"),
			y: readPacketUint16LE(packet, 8, "get 16-bit joystick ADC"),
		};
	}
	//0 ~ 255
	async getJoystick8Adc(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return {
			x: readPacketByte(packet, 6, "get 8-bit joystick ADC"),
			y: readPacketByte(packet, 7, "get 8-bit joystick ADC"),
		};
	}
	async #getJoystickMappedRange(): Promise<JoystickMappedRange> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_RANGE, bus.cmdBuffer, 0);
		return {
			xMin: readPacketByte(packet, 6, "get joystick mapped range"),
			xMax: readPacketByte(packet, 7, "get joystick mapped range"),
			yMin: readPacketByte(packet, 8, "get joystick mapped range"),
			yMax: readPacketByte(packet, 9, "get joystick mapped range"),
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
		const result = readPacketByte(packet, 6, "set joystick mapped range");
		if (result !== 1) {
			throw new Error("configure joystick mapped range failed.\n");
		}
	}
	//-4095-4095
	async getJoystickMappedInt16Value(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT16_VALUE, bus.cmdBuffer, 0);
		return {
			x: readPacketInt16LE(packet, 6, "get mapped 16-bit joystick value"),
			y: readPacketInt16LE(packet, 8, "get mapped 16-bit joystick value"),
		};
	}
	//  -128~127
	async getJoystickMappedInt8Value(): Promise<JoystickValue> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainJoyStick.CMD.GET_ADC_XY_MAPPED_INT8_VALUE, bus.cmdBuffer, 0);
		return {
			x: readPacketInt8(packet, 6, "get mapped 8-bit joystick value"),
			y: readPacketInt8(packet, 7, "get mapped 8-bit joystick value"),
		};
	}
}

interface M5ChainJoyStick extends HasLedMethods, HasKeyMethods, CanSampleMethods<JoystickValue> {}

export default M5ChainJoyStick;
