/*---
description: validates Chain MIC protocol conversions on XS
flags: [module]
---*/

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
} from "micProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

assertDeepEqual(MIC_COMMAND, {
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
assert.sameValue(micTriggerFromValue(0x0300), MIC_TRIGGER.LOW_THRESHOLD);
assert.sameValue(micTriggerFromValue(0x0301), MIC_TRIGGER.HIGH_THRESHOLD);
assertThrows(() => micTriggerFromValue(0x0302), /Unknown MIC trigger/);
const event = new Uint8Array(11);
event[6] = 0x01;
event[7] = 0x03;
assert.sameValue(micTriggerFromEventPacket(event), MIC_TRIGGER.HIGH_THRESHOLD);
event[6] = 0x02;
assertThrows(() => micTriggerFromEventPacket(event), /Unknown MIC trigger/);
assert.sameValue(micReportModeToValue(MIC_REPORT_MODE.DISABLED), 0);
assert.sameValue(micReportModeToValue(MIC_REPORT_MODE.ENABLED), 1);
assert.sameValue(micReportModeFromValue(0), MIC_REPORT_MODE.DISABLED);
assert.sameValue(micReportModeFromValue(1), MIC_REPORT_MODE.ENABLED);
assertThrows(() => micReportModeToValue(2), /Unknown MIC report mode/);
assertThrows(() => micReportModeFromValue(2), /Unknown MIC report mode/);
assertMICThreshold(0);
assertMICThreshold(4095);
assertThrows(() => assertMICThreshold(-1), /integer between 0 and 4095/);
assertThrows(() => assertMICThreshold(4096), /integer between 0 and 4095/);
assertThrows(() => assertMICThreshold(1.5), /integer between 0 and 4095/);
assertMICTriggerInterval(300);
assertMICTriggerInterval(1000);
assertThrows(() => assertMICTriggerInterval(299), /integer between 300 and 1000/);
assertThrows(() => assertMICTriggerInterval(1001), /integer between 300 and 1000/);
assertThrows(() => assertMICTriggerInterval(300.5), /integer between 300 and 1000/);
