import assert from "node:assert/strict";
import test from "node:test";
import {
	assertI2CAddress,
	assertI2CData,
	assertI2CLength,
	assertOperationResponse,
	CHAIN_BUS_COMMAND,
	gpioDriveToValue,
	gpioEdgeToValue,
	gpioModeFromValue,
	gpioPullToValue,
	i2cFrequencyToValue,
	readAnalogResponse,
	readDigitalResponse,
	readI2CScanResponse,
	readInterruptEvent,
	readModesResponse,
	readOperationData,
	writeRegisterAddress,
} from "../src/m5chain/chainBusProtocol.ts";

function response(...payload) {
	const packet = new Uint8Array(payload.length + 9);
	packet.set(payload, 6);
	return packet;
}

test("defines every ChainBus Unit command", () => {
	assert.deepEqual(CHAIN_BUS_COMMAND, {
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
	});
});

test("validates I2C inputs and converts frequencies", () => {
	assert.doesNotThrow(() => assertI2CAddress(0));
	assert.doesNotThrow(() => assertI2CAddress(0x7f));
	assert.throws(() => assertI2CAddress(-1), /address/);
	assert.throws(() => assertI2CAddress(0x80), /address/);
	assert.doesNotThrow(() => assertI2CLength(1));
	assert.doesNotThrow(() => assertI2CLength(64));
	assert.throws(() => assertI2CLength(0), /length/);
	assert.throws(() => assertI2CLength(65), /length/);
	assert.doesNotThrow(() => assertI2CData(new Uint8Array(1)));
	assert.throws(() => assertI2CData(new Uint8Array(65)), /length/);
	assert.throws(() => assertI2CData([1]), /Uint8Array/);
	assert.equal(i2cFrequencyToValue(100_000), 0);
	assert.equal(i2cFrequencyToValue(400_000), 1);
	assert.throws(() => i2cFrequencyToValue(1_000_000), /frequency/);
});

test("encodes one-byte and two-byte register addresses little-endian", () => {
	const buffer = new Uint8Array(4);
	writeRegisterAddress(buffer, 0, 0xab, 1);
	assert.deepEqual(buffer, new Uint8Array([1, 0xab, 0, 0]));
	writeRegisterAddress(buffer, 0, 0xabcd, 2);
	assert.deepEqual(buffer, new Uint8Array([2, 0xcd, 0xab, 0]));
	assert.throws(() => writeRegisterAddress(buffer, 0, 0x100, 1), /register/);
	assert.throws(() => writeRegisterAddress(buffer, 0, 0, 3), /registerAddressSize/);
});

test("converts GPIO configuration and mode values", () => {
	assert.equal(gpioPullToValue("up"), 0);
	assert.equal(gpioPullToValue("down"), 1);
	assert.equal(gpioPullToValue("none"), 2);
	assert.equal(gpioDriveToValue("push-pull"), 0);
	assert.equal(gpioDriveToValue("open-drain"), 1);
	assert.equal(gpioEdgeToValue("rising"), 0);
	assert.equal(gpioEdgeToValue("falling"), 1);
	assert.equal(gpioEdgeToValue("both"), 2);
	assert.deepEqual([0, 1, 2, 3, 4, 5].map(gpioModeFromValue), [
		"none",
		"output",
		"input",
		"interrupt",
		"analog",
		"i2c",
	]);
	assert.throws(() => gpioModeFromValue(6), /Unknown GPIO mode/);
});

test("validates operation status and exact response lengths", () => {
	assert.doesNotThrow(() => assertOperationResponse(response(1), "configure"));
	assert.throws(() => assertOperationResponse(response(0), "configure"), /failed/);
	assert.throws(() => assertOperationResponse(response(2), "configure"), /mode mismatch/);
	assert.throws(() => assertOperationResponse(response(3), "configure"), /unknown operation status/);
	assert.throws(() => assertOperationResponse(response(1, 0), "configure"), /must be 10 bytes/);

	const packet = response(1, 0xaa, 0xbb);
	const data = readOperationData(packet, "read", 2);
	assert.deepEqual(data, new Uint8Array([0xaa, 0xbb]));
	packet[7] = 0;
	assert.deepEqual(data, new Uint8Array([0xaa, 0xbb]));
	assert.throws(() => readOperationData(response(1, 2), "read", 2), /must be 12 bytes/);
});

test("decodes I2C scans and rejects malformed addresses or lengths", () => {
	const addresses = readI2CScanResponse(response(1, 2, 0x44, 0x68));
	assert.deepEqual(addresses, [0x44, 0x68]);
	assert.ok(Object.isFrozen(addresses));
	assert.throws(() => readI2CScanResponse(response(1, 2, 0x44)), /must be 13 bytes/);
	assert.throws(() => readI2CScanResponse(response(1, 1, 0x80)), /address/);
	assert.throws(() => readI2CScanResponse(response(0, 0)), /failed/);
});

test("decodes digital, analog, mode, and interrupt responses", () => {
	assert.equal(readDigitalResponse(response(1, 0), "read GPIO"), false);
	assert.equal(readDigitalResponse(response(1, 1), "read GPIO"), true);
	assert.throws(() => readDigitalResponse(response(1, 2), "read GPIO"), /digital value/);
	assert.equal(readAnalogResponse(response(1, 0xff, 0x0f)), 4095);
	assert.throws(() => readAnalogResponse(response(1, 0, 0x10)), /12-bit range/);
	assert.deepEqual(readModesResponse(response(1, 5)), ["output", "i2c"]);
	assert.deepEqual(readInterruptEvent(response(0, 1)), { gpio: 1, edge: "rising" });
	assert.deepEqual(readInterruptEvent(response(1, 2)), { gpio: 2, edge: "falling" });
	assert.throws(() => readInterruptEvent(response(2, 1)), /interrupt edge/);
	assert.throws(() => readInterruptEvent(response(0, 3)), /interrupt pin/);
});
