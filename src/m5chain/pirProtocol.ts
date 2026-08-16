export const PIR_STATUS = Object.freeze({
	NO_PERSON: 0,
	PERSON_DETECTED: 1,
} as const);
export type PIRStatus = (typeof PIR_STATUS)[keyof typeof PIR_STATUS];

export const PIR_REPORT_MODE = Object.freeze({
	DISABLED: 0,
	ENABLED: 1,
} as const);
export type PIRReportMode = (typeof PIR_REPORT_MODE)[keyof typeof PIR_REPORT_MODE];

export const PIR_COMMAND = Object.freeze({
	GET_STATUS: 0x37,
	REPORT_STATUS: 0xe0,
	SET_REPORT_MODE: 0xe1,
	GET_REPORT_MODE: 0xe2,
	SET_HOLD_SECONDS: 0xe3,
	GET_HOLD_SECONDS: 0xe4,
} as const);

const PIR_EVENT_TYPE = 0x05;

export function pirStatusFromValue(value: number): PIRStatus {
	switch (value) {
		case PIR_STATUS.NO_PERSON:
			return PIR_STATUS.NO_PERSON;
		case PIR_STATUS.PERSON_DETECTED:
			return PIR_STATUS.PERSON_DETECTED;
		default:
			throw new Error(`Unknown PIR status: ${value}`);
	}
}

export function pirStatusFromEventPacket(buffer: Uint8Array): PIRStatus {
	if (buffer[7] !== PIR_EVENT_TYPE) {
		throw new Error(`Unknown PIR event type: ${buffer[7]}`);
	}
	return pirStatusFromValue(buffer[6]);
}

export function pirReportModeToValue(mode: PIRReportMode): number {
	if (mode !== PIR_REPORT_MODE.DISABLED && mode !== PIR_REPORT_MODE.ENABLED) {
		throw new RangeError(`Unknown PIR report mode: ${mode}`);
	}
	return mode;
}

export function pirReportModeFromValue(value: number): PIRReportMode {
	switch (value) {
		case PIR_REPORT_MODE.DISABLED:
			return PIR_REPORT_MODE.DISABLED;
		case PIR_REPORT_MODE.ENABLED:
			return PIR_REPORT_MODE.ENABLED;
		default:
			throw new Error(`Unknown PIR report mode: ${value}`);
	}
}

export function assertPIRHoldSeconds(holdSeconds: number): void {
	if (!Number.isInteger(holdSeconds) || holdSeconds < 0 || holdSeconds > 255) {
		throw new RangeError("holdSeconds must be an integer between 0 and 255.");
	}
}
