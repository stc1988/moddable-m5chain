/*---
description: validates ChainBus protocol encoding and decoding on XS
flags: [module]
---*/

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
} from "chainBusProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

function response(...payload) {
	const packet = new Uint8Array(payload.length + 9);
	packet.set(payload, 6);
	return packet;
}

assertDeepEqual(CHAIN_BUS_COMMAND, {
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
assertI2CAddress(0);
assertI2CAddress(0x7f);
assertThrows(() => assertI2CAddress(-1), /address/);
assertThrows(() => assertI2CAddress(0x80), /address/);
assertI2CLength(1);
assertI2CLength(64);
assertThrows(() => assertI2CLength(0), /length/);
assertThrows(() => assertI2CLength(65), /length/);
assertI2CData(new Uint8Array(1));
assertThrows(() => assertI2CData(new Uint8Array(65)), /length/);
assertThrows(() => assertI2CData([1]), /Uint8Array/);
assert.sameValue(i2cFrequencyToValue(100_000), 0);
assert.sameValue(i2cFrequencyToValue(400_000), 1);
assertThrows(() => i2cFrequencyToValue(1_000_000), /frequency/);

const buffer = new Uint8Array(4);
writeRegisterAddress(buffer, 0, 0xab, 1);
assertDeepEqual(buffer, new Uint8Array([1, 0xab, 0, 0]));
writeRegisterAddress(buffer, 0, 0xabcd, 2);
assertDeepEqual(buffer, new Uint8Array([2, 0xcd, 0xab, 0]));
assertThrows(() => writeRegisterAddress(buffer, 0, 0x100, 1), /register/);
assertThrows(() => writeRegisterAddress(buffer, 0, 0, 3), /registerAddressSize/);

assert.sameValue(gpioPullToValue("up"), 0);
assert.sameValue(gpioPullToValue("down"), 1);
assert.sameValue(gpioPullToValue("none"), 2);
assert.sameValue(gpioDriveToValue("push-pull"), 0);
assert.sameValue(gpioDriveToValue("open-drain"), 1);
assert.sameValue(gpioEdgeToValue("rising"), 0);
assert.sameValue(gpioEdgeToValue("falling"), 1);
assert.sameValue(gpioEdgeToValue("both"), 2);
assertDeepEqual([0, 1, 2, 3, 4, 5].map(gpioModeFromValue), ["none", "output", "input", "interrupt", "analog", "i2c"]);
assertThrows(() => gpioModeFromValue(6), /Unknown GPIO mode/);

assertOperationResponse(response(1), "configure");
assertThrows(() => assertOperationResponse(response(0), "configure"), /failed/);
assertThrows(() => assertOperationResponse(response(2), "configure"), /mode mismatch/);
assertThrows(() => assertOperationResponse(response(3), "configure"), /unknown operation status/);
assertThrows(() => assertOperationResponse(response(1, 0), "configure"), /must be 10 bytes/);
const packet = response(1, 0xaa, 0xbb);
const data = readOperationData(packet, "read", 2);
assertDeepEqual(data, new Uint8Array([0xaa, 0xbb]));
packet[7] = 0;
assertDeepEqual(data, new Uint8Array([0xaa, 0xbb]));
assertThrows(() => readOperationData(response(1, 2), "read", 2), /must be 12 bytes/);

const addresses = readI2CScanResponse(response(1, 2, 0x44, 0x68));
assertDeepEqual(addresses, [0x44, 0x68]);
assert(Object.isFrozen(addresses));
assertThrows(() => readI2CScanResponse(response(1, 2, 0x44)), /must be 13 bytes/);
assertThrows(() => readI2CScanResponse(response(1, 1, 0x80)), /address/);
assertThrows(() => readI2CScanResponse(response(0, 0)), /failed/);

assert.sameValue(readDigitalResponse(response(1, 0), "read GPIO"), false);
assert.sameValue(readDigitalResponse(response(1, 1), "read GPIO"), true);
assertThrows(() => readDigitalResponse(response(1, 2), "read GPIO"), /digital value/);
assert.sameValue(readAnalogResponse(response(1, 0xff, 0x0f)), 4095);
assertThrows(() => readAnalogResponse(response(1, 0, 0x10)), /12-bit range/);
assertDeepEqual(readModesResponse(response(1, 5)), ["output", "i2c"]);
assertDeepEqual(readInterruptEvent(response(0, 1)), { gpio: 1, edge: "rising" });
assertDeepEqual(readInterruptEvent(response(1, 2)), { gpio: 2, edge: "falling" });
assertThrows(() => readInterruptEvent(response(2, 1)), /interrupt edge/);
assertThrows(() => readInterruptEvent(response(0, 3)), /interrupt pin/);
