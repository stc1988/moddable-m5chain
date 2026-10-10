/*---
description: validates Chain PIR protocol conversions on XS
flags: [module]
---*/

import {
	assertPIRHoldSeconds,
	PIR_COMMAND,
	PIR_REPORT_MODE,
	PIR_STATUS,
	pirReportModeFromValue,
	pirReportModeToValue,
	pirStatusFromEventPacket,
	pirStatusFromValue,
} from "pirProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

assert.sameValue(pirStatusFromValue(0), PIR_STATUS.NO_PERSON);
assert.sameValue(pirStatusFromValue(1), PIR_STATUS.PERSON_DETECTED);
assertThrows(() => pirStatusFromValue(2), /Unknown PIR status/);
assertDeepEqual(PIR_COMMAND, {
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
assert.sameValue(pirStatusFromEventPacket(event), PIR_STATUS.PERSON_DETECTED);
event[7] = 0x06;
assertThrows(() => pirStatusFromEventPacket(event), /Unknown PIR event type/);
assert.sameValue(pirReportModeToValue(PIR_REPORT_MODE.DISABLED), 0);
assert.sameValue(pirReportModeToValue(PIR_REPORT_MODE.ENABLED), 1);
assert.sameValue(pirReportModeFromValue(0), PIR_REPORT_MODE.DISABLED);
assert.sameValue(pirReportModeFromValue(1), PIR_REPORT_MODE.ENABLED);
assertThrows(() => pirReportModeToValue(2), /Unknown PIR report mode/);
assertThrows(() => pirReportModeFromValue(2), /Unknown PIR report mode/);
assertPIRHoldSeconds(0);
assertPIRHoldSeconds(255);
assertThrows(() => assertPIRHoldSeconds(-1), /integer between 0 and 255/);
assertThrows(() => assertPIRHoldSeconds(256), /integer between 0 and 255/);
assertThrows(() => assertPIRHoldSeconds(1.5), /integer between 0 and 255/);
