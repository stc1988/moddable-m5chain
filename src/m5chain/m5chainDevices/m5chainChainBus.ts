import {
	assertI2CAddress,
	assertI2CData,
	assertI2CLength,
	assertOperationResponse,
	CHAIN_BUS_COMMAND,
	type ChainBusGPIODrive,
	type ChainBusGPIOEdge,
	type ChainBusGPIOMode,
	type ChainBusGPIOPull,
	type ChainBusI2CFrequency,
	gpioDriveToValue,
	gpioEdgeToValue,
	gpioPullToValue,
	i2cFrequencyToValue,
	readAnalogResponse,
	readDigitalResponse,
	readI2CScanResponse,
	readInterruptEvent,
	readModesResponse,
	readOperationData,
	writeRegisterAddress,
} from "chainBusProtocol";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures } from "m5chainDevice";
import type { ChainBus, DeviceConfiguration, DeviceConfigurationSnapshot, DeviceFactoryOptions } from "types";

export type {
	ChainBusGPIODrive,
	ChainBusGPIOEdge,
	ChainBusGPIOMode,
	ChainBusGPIOPull,
	ChainBusI2CFrequency,
} from "chainBusProtocol";

export type ChainBusGPIOConfiguration =
	| { mode: "output"; drive?: ChainBusGPIODrive; pull?: ChainBusGPIOPull }
	| { mode: "input"; pull?: ChainBusGPIOPull }
	| { mode: "interrupt"; pull?: ChainBusGPIOPull; edge: ChainBusGPIOEdge | "both" }
	| { mode: "analog" };

export type ChainBusConfiguration = DeviceConfiguration & {
	i2c?: { frequency: ChainBusI2CFrequency };
	gpio1?: ChainBusGPIOConfiguration;
	gpio2?: ChainBusGPIOConfiguration;
};

export type ChainBusConfigurationSnapshot = DeviceConfigurationSnapshot & {
	gpio1: { mode: ChainBusGPIOMode };
	gpio2: { mode: ChainBusGPIOMode };
};

export type ChainBusGPIOInterruptHandler = ((edge: ChainBusGPIOEdge) => void | Promise<void>) | null;

type ChainBusDevice = {
	readonly bus: ChainBus;
	readonly id: number;
};

function assertPlainObject(name: string, value: unknown): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
}

class ChainBusI2C {
	readonly #device: ChainBusDevice;

	constructor(device: ChainBusDevice) {
		this.#device = device;
	}

	async configure(options: { frequency: ChainBusI2CFrequency }): Promise<void> {
		assertPlainObject("options", options);
		for (const key in options) if (key !== "frequency") throw new RangeError(`Unsupported I2C option: ${key}`);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = i2cFrequencyToValue(options.frequency);
		assertOperationResponse(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_CONFIGURE, bus.cmdBuffer, 1),
			"configure I2C",
		);
	}

	async read(address: number, length: number): Promise<Uint8Array> {
		assertI2CAddress(address);
		assertI2CLength(length);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = address;
		bus.cmdBuffer[1] = length;
		return readOperationData(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_READ, bus.cmdBuffer, 2),
			"read I2C",
			length,
		);
	}

	async write(address: number, data: Uint8Array): Promise<void> {
		assertI2CAddress(address);
		assertI2CData(data);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = address;
		bus.cmdBuffer[1] = data.length;
		bus.cmdBuffer.set(data, 2);
		assertOperationResponse(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_WRITE, bus.cmdBuffer, data.length + 2),
			"write I2C",
		);
	}

	async readRegister(
		address: number,
		register: number,
		registerAddressSize: 1 | 2,
		length: number,
	): Promise<Uint8Array> {
		assertI2CAddress(address);
		assertI2CLength(length);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = address;
		writeRegisterAddress(bus.cmdBuffer, 1, register, registerAddressSize);
		bus.cmdBuffer[4] = length;
		return readOperationData(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_READ_REGISTER, bus.cmdBuffer, 5),
			"read I2C register",
			length,
		);
	}

	async writeRegister(address: number, register: number, registerAddressSize: 1 | 2, data: Uint8Array): Promise<void> {
		assertI2CAddress(address);
		assertI2CData(data);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = address;
		writeRegisterAddress(bus.cmdBuffer, 1, register, registerAddressSize);
		bus.cmdBuffer[4] = data.length;
		bus.cmdBuffer.set(data, 5);
		assertOperationResponse(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_WRITE_REGISTER, bus.cmdBuffer, data.length + 5),
			"write I2C register",
		);
	}

	async scan(): Promise<readonly number[]> {
		const bus = this.#device.bus;
		return readI2CScanResponse(await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.I2C_SCAN, bus.cmdBuffer, 0));
	}
}

class ChainBusGPIO {
	readonly #device: ChainBusDevice;
	readonly #readModes: () => Promise<readonly [ChainBusGPIOMode, ChainBusGPIOMode]>;
	readonly number: 1 | 2;
	#onInterrupt: ChainBusGPIOInterruptHandler = null;

	constructor(
		device: ChainBusDevice,
		number: 1 | 2,
		readModes: () => Promise<readonly [ChainBusGPIOMode, ChainBusGPIOMode]>,
	) {
		this.#device = device;
		this.number = number;
		this.#readModes = readModes;
	}

	set onInterrupt(handler: ChainBusGPIOInterruptHandler) {
		if (handler !== null && typeof handler !== "function") {
			throw new TypeError("onInterrupt must be a function or null.");
		}
		this.#onInterrupt = handler;
	}

	get onInterrupt(): ChainBusGPIOInterruptHandler {
		return this.#onInterrupt;
	}

	dispatchInterrupt(edge: ChainBusGPIOEdge): void | Promise<void> | undefined {
		return this.#onInterrupt?.(edge);
	}

	async configure(options: ChainBusGPIOConfiguration): Promise<void> {
		assertPlainObject("options", options);
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = this.number;
		let command: number;
		let size: number;
		switch (options.mode) {
			case "output":
				for (const key in options) {
					if (key !== "mode" && key !== "drive" && key !== "pull") {
						throw new RangeError(`Unsupported output GPIO option: ${key}`);
					}
				}
				bus.cmdBuffer[1] = gpioDriveToValue(options.drive ?? "push-pull");
				bus.cmdBuffer[2] = gpioPullToValue(options.pull ?? "none");
				command = CHAIN_BUS_COMMAND.GPIO_CONFIGURE_OUTPUT;
				size = 3;
				break;
			case "input":
				for (const key in options) {
					if (key !== "mode" && key !== "pull") throw new RangeError(`Unsupported input GPIO option: ${key}`);
				}
				bus.cmdBuffer[1] = gpioPullToValue(options.pull ?? "none");
				command = CHAIN_BUS_COMMAND.GPIO_CONFIGURE_INPUT;
				size = 2;
				break;
			case "interrupt":
				for (const key in options) {
					if (key !== "mode" && key !== "pull" && key !== "edge") {
						throw new RangeError(`Unsupported interrupt GPIO option: ${key}`);
					}
				}
				bus.cmdBuffer[1] = gpioPullToValue(options.pull ?? "none");
				bus.cmdBuffer[2] = gpioEdgeToValue(options.edge);
				command = CHAIN_BUS_COMMAND.GPIO_CONFIGURE_INTERRUPT;
				size = 3;
				break;
			case "analog":
				for (const key in options) {
					if (key !== "mode") throw new RangeError(`Unsupported analog GPIO option: ${key}`);
				}
				command = CHAIN_BUS_COMMAND.GPIO_CONFIGURE_ANALOG;
				size = 1;
				break;
			default:
				throw new RangeError(`Unknown GPIO mode: ${(options as { mode?: unknown }).mode}`);
		}
		assertOperationResponse(
			await bus.sendAndWait(this.#device.id, command, bus.cmdBuffer, size),
			`configure GPIO ${this.number}`,
		);
	}

	async readMode(): Promise<ChainBusGPIOMode> {
		const modes = await this.#readModes();
		return this.number === 1 ? modes[0] : modes[1];
	}

	async write(value: boolean): Promise<void> {
		if (value !== true && value !== false) throw new TypeError("value must be a boolean.");
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = this.number;
		bus.cmdBuffer[1] = value ? 1 : 0;
		assertOperationResponse(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.GPIO_WRITE, bus.cmdBuffer, 2),
			`write GPIO ${this.number}`,
		);
	}

	async readOutput(): Promise<boolean> {
		return this.#readDigital(CHAIN_BUS_COMMAND.GPIO_READ_OUTPUT, `read GPIO ${this.number} output`);
	}

	async read(): Promise<boolean> {
		return this.#readDigital(CHAIN_BUS_COMMAND.GPIO_READ, `read GPIO ${this.number}`);
	}

	async #readDigital(command: number, operation: string): Promise<boolean> {
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = this.number;
		return readDigitalResponse(await bus.sendAndWait(this.#device.id, command, bus.cmdBuffer, 1), operation);
	}

	async readAnalog(): Promise<number> {
		const bus = this.#device.bus;
		bus.cmdBuffer[0] = this.number;
		return readAnalogResponse(
			await bus.sendAndWait(this.#device.id, CHAIN_BUS_COMMAND.GPIO_READ_ANALOG, bus.cmdBuffer, 1),
		);
	}
}

const ChainBusDeviceBase = withDeviceFeatures(HasLed);

class M5ChainChainBus extends ChainBusDeviceBase {
	static readonly DEVICE_TYPE = 0x0006;
	override readonly kind = "chainbus" as const;
	static override CMD = Object.freeze({
		...super.CMD,
		CHAIN_BUS: CHAIN_BUS_COMMAND,
	} as const);

	readonly i2c: ChainBusI2C;
	readonly gpio1: ChainBusGPIO;
	readonly gpio2: ChainBusGPIO;

	constructor(bus: ChainBus, options: DeviceFactoryOptions) {
		super(bus, options);
		this.i2c = new ChainBusI2C(this);
		const readModes = () => this.#readModes();
		this.gpio1 = new ChainBusGPIO(this, 1, readModes);
		this.gpio2 = new ChainBusGPIO(this, 2, readModes);
	}

	override async configure(options: ChainBusConfiguration = {}): Promise<void> {
		assertObjectOption("options", options);
		assertKnownConfigurationOptions(options, ["i2c", "gpio1", "gpio2"]);
		await super.configure(options);
		if (options.i2c !== undefined) await this.i2c.configure(options.i2c);
		if (options.gpio1 !== undefined) await this.gpio1.configure(options.gpio1);
		if (options.gpio2 !== undefined) await this.gpio2.configure(options.gpio2);
	}

	async #readModes(): Promise<readonly [ChainBusGPIOMode, ChainBusGPIOMode]> {
		const bus = this.bus;
		return readModesResponse(await bus.sendAndWait(this.id, CHAIN_BUS_COMMAND.GPIO_READ_MODES, bus.cmdBuffer, 0));
	}

	override async readConfiguration(): Promise<ChainBusConfigurationSnapshot> {
		const [gpio1, gpio2] = await this.#readModes();
		return { gpio1: { mode: gpio1 }, gpio2: { mode: gpio2 } };
	}

	onDispatchEvent(packet: Uint8Array): void | Promise<void> | undefined {
		const event = readInterruptEvent(packet);
		return (event.gpio === 1 ? this.gpio1 : this.gpio2).dispatchInterrupt(event.edge);
	}
}

export { ChainBusGPIO, ChainBusI2C };
export default M5ChainChainBus;
