/*---
description: validates Chain Switch protocol conversions on XS
flags: [module]
---*/

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
} from "switchProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

assertDeepEqual(SWITCH_COMMAND, {
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
assert.sameValue(switchDirectionToValue(SWITCH_DIRECTION.DOWN_TO_UP_DECREASES), 0);
assert.sameValue(switchDirectionToValue(SWITCH_DIRECTION.DOWN_TO_UP_INCREASES), 1);
assert.sameValue(switchDirectionFromValue(0), SWITCH_DIRECTION.DOWN_TO_UP_DECREASES);
assert.sameValue(switchDirectionFromValue(1), SWITCH_DIRECTION.DOWN_TO_UP_INCREASES);
assertThrows(() => switchDirectionToValue(2), /Unknown switch direction/);
assertThrows(() => switchDirectionFromValue(2), /Unknown switch direction/);
assert.sameValue(switchStatusFromValue(0), SWITCH_STATUS.CLOSED);
assert.sameValue(switchStatusFromValue(1), SWITCH_STATUS.OPEN);
assertThrows(() => switchStatusFromValue(2), /Unknown switch status/);
const event = new Uint8Array(11);
event[6] = SWITCH_STATUS.OPEN;
event[7] = 0x04;
assert.sameValue(switchStatusFromEventPacket(event), SWITCH_STATUS.OPEN);
event[7] = 0x05;
assertThrows(() => switchStatusFromEventPacket(event), /Unknown switch event type/);
assert.sameValue(switchReportModeToValue(SWITCH_REPORT_MODE.DISABLED), 0);
assert.sameValue(switchReportModeToValue(SWITCH_REPORT_MODE.ENABLED), 1);
assert.sameValue(switchReportModeFromValue(0), SWITCH_REPORT_MODE.DISABLED);
assert.sameValue(switchReportModeFromValue(1), SWITCH_REPORT_MODE.ENABLED);
assertThrows(() => switchReportModeToValue(2), /Unknown switch report mode/);
assertThrows(() => switchReportModeFromValue(2), /Unknown switch report mode/);
assertSwitchThresholds(4095, 0);
assertSwitchThresholds(3967, 80);
assertThrows(() => assertSwitchThresholds(4096, 0), /thresholds.open/);
assertThrows(() => assertSwitchThresholds(100, -1), /thresholds.close/);
assertThrows(() => assertSwitchThresholds(100, 100), /greater than/);
assertThrows(() => assertSwitchThresholds(100, 101), /greater than/);
assertThrows(() => assertSwitchThresholds(100.5, 10), /thresholds.open/);
