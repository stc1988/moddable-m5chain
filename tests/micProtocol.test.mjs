import assert from "node:assert/strict";
import test from "node:test";
import {
	assertMICThreshold,
	assertMICTriggerInterval,
	MIC_COMMAND,
	MIC_REPORT_MODE,
	MIC_TRIGGER,
	micReportModeFromValue,
	micReportModeToValue,
	micTriggerFromEventPacket,
	micTriggerFromValue,
} from "../src/m5chain/micProtocol.ts";

test("matches MIC command values", () => {
	assert.deepEqual(MIC_COMMAND, {
		GET_12ADC: 0x30,
		GET_8ADC: 0x31,
		SET_THRESHOLD: 0x32,
		GET_THRESHOLD: 0x33,
		REPORT_TRIGGER: 0xe0,
		SET_REPORT_MODE: 0xe1,
		GET_REPORT_MODE: 0xe2,
		SET_TRIGGER_INTERVAL: 0xe3,
		GET_TRIGGER_INTERVAL: 0xe4,
	});
});

test("decodes MIC threshold trigger packets", () => {
	assert.equal(micTriggerFromValue(0x0300), MIC_TRIGGER.LOW_THRESHOLD);
	assert.equal(micTriggerFromValue(0x0301), MIC_TRIGGER.HIGH_THRESHOLD);
	assert.throws(() => micTriggerFromValue(0x0302), /Unknown MIC trigger/);

	const event = new Uint8Array(11);
	event[6] = 0x01;
	event[7] = 0x03;
	assert.equal(micTriggerFromEventPacket(event), MIC_TRIGGER.HIGH_THRESHOLD);
	event[6] = 0x02;
	assert.throws(() => micTriggerFromEventPacket(event), /Unknown MIC trigger/);
});

test("validates MIC report mode values", () => {
	assert.equal(micReportModeToValue(MIC_REPORT_MODE.DISABLED), 0);
	assert.equal(micReportModeToValue(MIC_REPORT_MODE.ENABLED), 1);
	assert.equal(micReportModeFromValue(0), MIC_REPORT_MODE.DISABLED);
	assert.equal(micReportModeFromValue(1), MIC_REPORT_MODE.ENABLED);
	assert.throws(() => micReportModeToValue(2), /Unknown MIC report mode/);
	assert.throws(() => micReportModeFromValue(2), /Unknown MIC report mode/);
});

test("accepts only 12-bit MIC thresholds", () => {
	assert.doesNotThrow(() => assertMICThreshold(0));
	assert.doesNotThrow(() => assertMICThreshold(4095));
	assert.throws(() => assertMICThreshold(-1), /integer between 0 and 4095/);
	assert.throws(() => assertMICThreshold(4096), /integer between 0 and 4095/);
	assert.throws(() => assertMICThreshold(1.5), /integer between 0 and 4095/);
});

test("accepts MIC trigger intervals from 300 to 1000 milliseconds", () => {
	assert.doesNotThrow(() => assertMICTriggerInterval(300));
	assert.doesNotThrow(() => assertMICTriggerInterval(1000));
	assert.throws(() => assertMICTriggerInterval(299), /integer between 300 and 1000/);
	assert.throws(() => assertMICTriggerInterval(1001), /integer between 300 and 1000/);
	assert.throws(() => assertMICTriggerInterval(300.5), /integer between 300 and 1000/);
});
