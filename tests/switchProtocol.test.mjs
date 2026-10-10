import assert from "node:assert/strict";
import test from "node:test";
import {
	assertSwitchThresholds,
	SWITCH_COMMAND,
	SWITCH_DIRECTION,
	SWITCH_REPORT_MODE,
	SWITCH_STATUS,
	switchDirectionFromValue,
	switchDirectionToValue,
	switchReportModeFromValue,
	switchReportModeToValue,
	switchStatusFromEventPacket,
	switchStatusFromValue,
} from "../src/m5chain/switchProtocol.ts";

test("matches Switch command values", () => {
	assert.deepEqual(SWITCH_COMMAND, {
		GET_12ADC: 0x30,
		GET_8ADC: 0x31,
		SET_DIRECTION: 0x32,
		GET_DIRECTION: 0x33,
		SET_THRESHOLDS: 0x34,
		GET_THRESHOLDS: 0x35,
		GET_STATUS: 0x36,
		REPORT_STATUS: 0xe0,
		SET_REPORT_MODE: 0xe1,
		GET_REPORT_MODE: 0xe2,
	});
});

test("decodes Switch direction values", () => {
	assert.equal(switchDirectionToValue(SWITCH_DIRECTION.DOWN_TO_UP_DECREASES), 0);
	assert.equal(switchDirectionToValue(SWITCH_DIRECTION.DOWN_TO_UP_INCREASES), 1);
	assert.equal(switchDirectionFromValue(0), SWITCH_DIRECTION.DOWN_TO_UP_DECREASES);
	assert.equal(switchDirectionFromValue(1), SWITCH_DIRECTION.DOWN_TO_UP_INCREASES);
	assert.throws(() => switchDirectionToValue(2), /Unknown switch direction/);
	assert.throws(() => switchDirectionFromValue(2), /Unknown switch direction/);
});

test("decodes Switch status and event packets", () => {
	assert.equal(switchStatusFromValue(0), SWITCH_STATUS.CLOSED);
	assert.equal(switchStatusFromValue(1), SWITCH_STATUS.OPEN);
	assert.throws(() => switchStatusFromValue(2), /Unknown switch status/);

	const event = new Uint8Array(11);
	event[6] = SWITCH_STATUS.OPEN;
	event[7] = 0x04;
	assert.equal(switchStatusFromEventPacket(event), SWITCH_STATUS.OPEN);
	event[7] = 0x05;
	assert.throws(() => switchStatusFromEventPacket(event), /Unknown switch event type/);
});

test("validates Switch report mode values", () => {
	assert.equal(switchReportModeToValue(SWITCH_REPORT_MODE.DISABLED), 0);
	assert.equal(switchReportModeToValue(SWITCH_REPORT_MODE.ENABLED), 1);
	assert.equal(switchReportModeFromValue(0), SWITCH_REPORT_MODE.DISABLED);
	assert.equal(switchReportModeFromValue(1), SWITCH_REPORT_MODE.ENABLED);
	assert.throws(() => switchReportModeToValue(2), /Unknown switch report mode/);
	assert.throws(() => switchReportModeFromValue(2), /Unknown switch report mode/);
});

test("accepts ordered 12-bit Switch thresholds", () => {
	assert.doesNotThrow(() => assertSwitchThresholds(4095, 0));
	assert.doesNotThrow(() => assertSwitchThresholds(3967, 80));
	assert.throws(() => assertSwitchThresholds(4096, 0), /thresholds.open/);
	assert.throws(() => assertSwitchThresholds(100, -1), /thresholds.close/);
	assert.throws(() => assertSwitchThresholds(100, 100), /greater than/);
	assert.throws(() => assertSwitchThresholds(100, 101), /greater than/);
	assert.throws(() => assertSwitchThresholds(100.5, 10), /thresholds.open/);
});
