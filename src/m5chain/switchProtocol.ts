export const SWITCH_DIRECTION = Object.freeze({
	DOWN_TO_UP_DECREASES: 0,
	DOWN_TO_UP_INCREASES: 1,
} as const);
export type SwitchDirection = (typeof SWITCH_DIRECTION)[keyof typeof SWITCH_DIRECTION];

export const SWITCH_STATUS = Object.freeze({
	CLOSED: 0,
	OPEN: 1,
} as const);
export type SwitchStatus = (typeof SWITCH_STATUS)[keyof typeof SWITCH_STATUS];

export const SWITCH_REPORT_MODE = Object.freeze({
	DISABLED: 0,
	ENABLED: 1,
} as const);
export type SwitchReportMode = (typeof SWITCH_REPORT_MODE)[keyof typeof SWITCH_REPORT_MODE];

export const SWITCH_COMMAND = Object.freeze({
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
} as const);

const SWITCH_EVENT_TYPE = 0x04;
const ADC_12BIT_MAX = 0x0fff;

function readSwitchPacketByte(buffer: Uint8Array, offset: number): number {
	const value = buffer[offset];
	if (value === undefined) {
		throw new Error(`Switch event packet is too short (missing byte at offset ${offset}).`);
	}
	return value;
}

export function switchDirectionToValue(direction: SwitchDirection): number {
	if (direction !== SWITCH_DIRECTION.DOWN_TO_UP_DECREASES && direction !== SWITCH_DIRECTION.DOWN_TO_UP_INCREASES) {
		throw new RangeError(`Unknown switch direction: ${direction}`);
	}
	return direction;
}

export function switchDirectionFromValue(value: number): SwitchDirection {
	switch (value) {
		case SWITCH_DIRECTION.DOWN_TO_UP_DECREASES:
			return SWITCH_DIRECTION.DOWN_TO_UP_DECREASES;
		case SWITCH_DIRECTION.DOWN_TO_UP_INCREASES:
			return SWITCH_DIRECTION.DOWN_TO_UP_INCREASES;
		default:
			throw new Error(`Unknown switch direction: ${value}`);
	}
}

export function switchStatusFromValue(value: number): SwitchStatus {
	switch (value) {
		case SWITCH_STATUS.CLOSED:
			return SWITCH_STATUS.CLOSED;
		case SWITCH_STATUS.OPEN:
			return SWITCH_STATUS.OPEN;
		default:
			throw new Error(`Unknown switch status: ${value}`);
	}
}

export function switchStatusFromEventPacket(buffer: Uint8Array): SwitchStatus {
	const eventType = readSwitchPacketByte(buffer, 7);
	if (eventType !== SWITCH_EVENT_TYPE) {
		throw new Error(`Unknown switch event type: ${eventType}`);
	}
	return switchStatusFromValue(readSwitchPacketByte(buffer, 6));
}

export function switchReportModeToValue(mode: SwitchReportMode): number {
	if (mode !== SWITCH_REPORT_MODE.DISABLED && mode !== SWITCH_REPORT_MODE.ENABLED) {
		throw new RangeError(`Unknown switch report mode: ${mode}`);
	}
	return mode;
}

export function switchReportModeFromValue(value: number): SwitchReportMode {
	switch (value) {
		case SWITCH_REPORT_MODE.DISABLED:
			return SWITCH_REPORT_MODE.DISABLED;
		case SWITCH_REPORT_MODE.ENABLED:
			return SWITCH_REPORT_MODE.ENABLED;
		default:
			throw new Error(`Unknown switch report mode: ${value}`);
	}
}

export function assertSwitchThresholds(open: number, close: number): void {
	if (!Number.isInteger(open) || open < 0 || open > ADC_12BIT_MAX) {
		throw new RangeError(`thresholds.open must be an integer between 0 and ${ADC_12BIT_MAX}.`);
	}
	if (!Number.isInteger(close) || close < 0 || close > ADC_12BIT_MAX) {
		throw new RangeError(`thresholds.close must be an integer between 0 and ${ADC_12BIT_MAX}.`);
	}
	if (open <= close) {
		throw new RangeError("thresholds.open must be greater than thresholds.close.");
	}
}
