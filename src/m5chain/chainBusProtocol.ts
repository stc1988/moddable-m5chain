export const CHAIN_BUS_COMMAND = Object.freeze({
	I2C_CONFIGURE: 0x10,
	I2C_READ: 0x11,
	I2C_WRITE: 0x12,
	I2C_READ_REGISTER: 0x13,
	I2C_WRITE_REGISTER: 0x14,
	I2C_SCAN: 0x15,
	GPIO_CONFIGURE_OUTPUT: 0x30,
	GPIO_WRITE: 0x31,
	GPIO_READ_OUTPUT: 0x32,
	GPIO_CONFIGURE_INPUT: 0x40,
	GPIO_READ: 0x41,
	GPIO_CONFIGURE_INTERRUPT: 0x50,
	GPIO_CONFIGURE_ANALOG: 0x60,
	GPIO_READ_ANALOG: 0x61,
	GPIO_READ_MODES: 0x70,
	GPIO_INTERRUPT: 0xe0,
} as const);

export type ChainBusI2CFrequency = 100_000 | 400_000;
export type ChainBusGPIOMode = "none" | "output" | "input" | "interrupt" | "analog" | "i2c";
export type ChainBusGPIOPull = "up" | "down" | "none";
export type ChainBusGPIODrive = "push-pull" | "open-drain";
export type ChainBusGPIOEdge = "rising" | "falling";

const RESPONSE_BASE_SIZE = 9;

function assertIntegerRange(name: string, value: unknown, minimum: number, maximum: number): asserts value is number {
	if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
	}
}

function readByte(packet: Uint8Array, offset: number, operation: string): number {
	const value = packet[offset];
	if (value === undefined) throw new Error(`${operation} response is too short (missing byte at offset ${offset}).`);
	return value;
}

function assertPacketSize(packet: Uint8Array, expected: number, operation: string): void {
	if (packet.length !== expected) {
		throw new Error(`${operation} response must be ${expected} bytes; received ${packet.length}.`);
	}
}

export function assertI2CAddress(address: number): void {
	assertIntegerRange("address", address, 0, 0x7f);
}

export function assertI2CLength(length: number): void {
	assertIntegerRange("length", length, 1, 64);
}

export function assertI2CData(data: unknown): asserts data is Uint8Array {
	if (!(data instanceof Uint8Array)) throw new TypeError("data must be a Uint8Array.");
	assertI2CLength(data.length);
}

export function i2cFrequencyToValue(frequency: ChainBusI2CFrequency): number {
	if (frequency === 100_000) return 0;
	if (frequency === 400_000) return 1;
	throw new RangeError("frequency must be 100000 or 400000 Hz.");
}

export function writeRegisterAddress(
	buffer: Uint8Array,
	offset: number,
	register: number,
	registerAddressSize: 1 | 2,
): void {
	if (registerAddressSize !== 1 && registerAddressSize !== 2) {
		throw new RangeError("registerAddressSize must be 1 or 2 bytes.");
	}
	assertIntegerRange("register", register, 0, registerAddressSize === 1 ? 0xff : 0xffff);
	buffer[offset] = registerAddressSize;
	buffer[offset + 1] = register & 0xff;
	buffer[offset + 2] = register >> 8;
}

export function gpioPullToValue(pull: ChainBusGPIOPull): number {
	switch (pull) {
		case "up":
			return 0;
		case "down":
			return 1;
		case "none":
			return 2;
		default:
			throw new RangeError(`Unknown GPIO pull: ${pull}`);
	}
}

export function gpioDriveToValue(drive: ChainBusGPIODrive): number {
	switch (drive) {
		case "push-pull":
			return 0;
		case "open-drain":
			return 1;
		default:
			throw new RangeError(`Unknown GPIO drive: ${drive}`);
	}
}

export function gpioEdgeToValue(edge: ChainBusGPIOEdge | "both"): number {
	switch (edge) {
		case "rising":
			return 0;
		case "falling":
			return 1;
		case "both":
			return 2;
		default:
			throw new RangeError(`Unknown GPIO edge: ${edge}`);
	}
}

export function gpioModeFromValue(value: number): ChainBusGPIOMode {
	switch (value) {
		case 0:
			return "none";
		case 1:
			return "output";
		case 2:
			return "input";
		case 3:
			return "interrupt";
		case 4:
			return "analog";
		case 5:
			return "i2c";
		default:
			throw new Error(`Unknown GPIO mode: ${value}`);
	}
}

export function assertOperationResponse(packet: Uint8Array, operation: string): void {
	assertPacketSize(packet, RESPONSE_BASE_SIZE + 1, operation);
	readOperationStatus(packet, operation);
}

function readOperationStatus(packet: Uint8Array, operation: string): void {
	const status = readByte(packet, 6, operation);
	if (status === 1) return;
	if (status === 0) throw new Error(`${operation} failed.`);
	if (status === 2) throw new Error(`${operation} failed: mode mismatch.`);
	throw new Error(`${operation} response has unknown operation status: ${status}.`);
}

export function readOperationData(packet: Uint8Array, operation: string, length: number): Uint8Array {
	assertPacketSize(packet, RESPONSE_BASE_SIZE + 1 + length, operation);
	readOperationStatus(packet, operation);
	return packet.slice(7, 7 + length);
}

export function readI2CScanResponse(packet: Uint8Array): readonly number[] {
	const operation = "scan I2C";
	if (packet.length < RESPONSE_BASE_SIZE + 2) {
		throw new Error(`${operation} response is too short.`);
	}
	readOperationStatus(packet, operation);
	const count = readByte(packet, 7, operation);
	assertPacketSize(packet, RESPONSE_BASE_SIZE + 2 + count, operation);
	const addresses: number[] = [];
	for (let index = 0; index < count; index += 1) {
		const address = readByte(packet, 8 + index, operation);
		assertI2CAddress(address);
		addresses.push(address);
	}
	return Object.freeze(addresses);
}

export function readDigitalResponse(packet: Uint8Array, operation: string): boolean {
	const data = readOperationData(packet, operation, 1);
	const value = data[0];
	if (value === 0) return false;
	if (value === 1) return true;
	throw new Error(`${operation} response has unknown digital value: ${value}.`);
}

export function readAnalogResponse(packet: Uint8Array): number {
	const data = readOperationData(packet, "read analog GPIO", 2);
	const value = (data[0] ?? 0) | ((data[1] ?? 0) << 8);
	if (value > 4095) throw new Error(`read analog GPIO response is outside the 12-bit range: ${value}.`);
	return value;
}

export function readModesResponse(packet: Uint8Array): readonly [ChainBusGPIOMode, ChainBusGPIOMode] {
	const operation = "read GPIO modes";
	assertPacketSize(packet, RESPONSE_BASE_SIZE + 2, operation);
	return [gpioModeFromValue(readByte(packet, 6, operation)), gpioModeFromValue(readByte(packet, 7, operation))];
}

export function readInterruptEvent(packet: Uint8Array): { gpio: 1 | 2; edge: ChainBusGPIOEdge } {
	const operation = "GPIO interrupt";
	assertPacketSize(packet, RESPONSE_BASE_SIZE + 2, operation);
	const edgeValue = readByte(packet, 6, operation);
	const gpioValue = readByte(packet, 7, operation);
	if (gpioValue !== 1 && gpioValue !== 2) throw new Error(`Unknown GPIO interrupt pin: ${gpioValue}`);
	let edge: ChainBusGPIOEdge;
	if (edgeValue === 0) edge = "rising";
	else if (edgeValue === 1) edge = "falling";
	else throw new Error(`Unknown GPIO interrupt edge: ${edgeValue}`);
	return { gpio: gpioValue, edge };
}
