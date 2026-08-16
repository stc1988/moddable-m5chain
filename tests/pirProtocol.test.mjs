import assert from "node:assert/strict";
import test from "node:test";
import {
	assertPIRHoldSeconds,
	PIR_COMMAND,
	PIR_REPORT_MODE,
	PIR_STATUS,
	pirReportModeFromValue,
	pirReportModeToValue,
	pirStatusFromEventPacket,
	pirStatusFromValue,
} from "../src/m5chain/pirProtocol.ts";

test("decodes PIR status values", () => {
	assert.equal(pirStatusFromValue(0), PIR_STATUS.NO_PERSON);
	assert.equal(pirStatusFromValue(1), PIR_STATUS.PERSON_DETECTED);
	assert.throws(() => pirStatusFromValue(2), /Unknown PIR status/);
});

test("matches PIR command and event packet values", () => {
	assert.deepEqual(PIR_COMMAND, {
		GET_STATUS: 0x37,
		REPORT_STATUS: 0xe0,
		SET_REPORT_MODE: 0xe1,
		GET_REPORT_MODE: 0xe2,
		SET_HOLD_SECONDS: 0xe3,
		GET_HOLD_SECONDS: 0xe4,
	});

	const event = new Uint8Array(11);
	event[6] = PIR_STATUS.PERSON_DETECTED;
	event[7] = 0x05;
	assert.equal(pirStatusFromEventPacket(event), PIR_STATUS.PERSON_DETECTED);
	event[7] = 0x06;
	assert.throws(() => pirStatusFromEventPacket(event), /Unknown PIR event type/);
});

test("validates PIR report mode values", () => {
	assert.equal(pirReportModeToValue(PIR_REPORT_MODE.DISABLED), 0);
	assert.equal(pirReportModeToValue(PIR_REPORT_MODE.ENABLED), 1);
	assert.equal(pirReportModeFromValue(0), PIR_REPORT_MODE.DISABLED);
	assert.equal(pirReportModeFromValue(1), PIR_REPORT_MODE.ENABLED);
	assert.throws(() => pirReportModeToValue(2), /Unknown PIR report mode/);
	assert.throws(() => pirReportModeFromValue(2), /Unknown PIR report mode/);
});

test("accepts only byte-sized integer PIR hold times", () => {
	assert.doesNotThrow(() => assertPIRHoldSeconds(0));
	assert.doesNotThrow(() => assertPIRHoldSeconds(255));
	assert.throws(() => assertPIRHoldSeconds(-1), /integer between 0 and 255/);
	assert.throws(() => assertPIRHoldSeconds(256), /integer between 0 and 255/);
	assert.throws(() => assertPIRHoldSeconds(1.5), /integer between 0 and 255/);
});
