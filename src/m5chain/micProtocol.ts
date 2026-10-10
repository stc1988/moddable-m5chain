export const MIC_REPORT_MODE = Object.freeze({
	DISABLED: 0,
	ENABLED: 1,
} as const);
export type MICReportMode = (typeof MIC_REPORT_MODE)[keyof typeof MIC_REPORT_MODE];

export const MIC_TRIGGER = Object.freeze({
	LOW_THRESHOLD: 0x0300,
	HIGH_THRESHOLD: 0x0301,
} as const);
export type MICTrigger = (typeof MIC_TRIGGER)[keyof typeof MIC_TRIGGER];

export const MIC_COMMAND = Object.freeze({
	GET_12ADC: 0x30,
	GET_8ADC: 0x31,
	SET_THRESHOLD: 0x32,
	GET_THRESHOLD: 0x33,
	REPORT_TRIGGER: 0xe0,
	SET_REPORT_MODE: 0xe1,
	GET_REPORT_MODE: 0xe2,
	SET_TRIGGER_INTERVAL: 0xe3,
	GET_TRIGGER_INTERVAL: 0xe4,
} as const);

const ADC_12BIT_MAX = 0x0fff;
const TRIGGER_INTERVAL_MIN_MS = 300;
const TRIGGER_INTERVAL_MAX_MS = 1000;

function readMICPacketByte(buffer: Uint8Array, offset: number): number {
	const value = buffer[offset];
	if (value === undefined) {
		throw new Error(`MIC event packet is too short (missing byte at offset ${offset}).`);
	}
	return value;
}

export function micTriggerFromValue(value: number): MICTrigger {
	switch (value) {
		case MIC_TRIGGER.LOW_THRESHOLD:
			return MIC_TRIGGER.LOW_THRESHOLD;
		case MIC_TRIGGER.HIGH_THRESHOLD:
			return MIC_TRIGGER.HIGH_THRESHOLD;
		default:
			throw new Error(`Unknown MIC trigger: ${value}`);
	}
}

export function micTriggerFromEventPacket(buffer: Uint8Array): MICTrigger {
	const value = readMICPacketByte(buffer, 6) | (readMICPacketByte(buffer, 7) << 8);
	return micTriggerFromValue(value);
}

export function micReportModeToValue(mode: MICReportMode): number {
	if (mode !== MIC_REPORT_MODE.DISABLED && mode !== MIC_REPORT_MODE.ENABLED) {
		throw new RangeError(`Unknown MIC report mode: ${mode}`);
	}
	return mode;
}

export function micReportModeFromValue(value: number): MICReportMode {
	switch (value) {
		case MIC_REPORT_MODE.DISABLED:
			return MIC_REPORT_MODE.DISABLED;
		case MIC_REPORT_MODE.ENABLED:
			return MIC_REPORT_MODE.ENABLED;
		default:
			throw new Error(`Unknown MIC report mode: ${value}`);
	}
}

export function assertMICThreshold(threshold: number): void {
	if (!Number.isInteger(threshold) || threshold < 0 || threshold > ADC_12BIT_MAX) {
		throw new RangeError(`threshold must be an integer between 0 and ${ADC_12BIT_MAX}.`);
	}
}

export function assertMICTriggerInterval(triggerIntervalMs: number): void {
	if (
		!Number.isInteger(triggerIntervalMs) ||
		triggerIntervalMs < TRIGGER_INTERVAL_MIN_MS ||
		triggerIntervalMs > TRIGGER_INTERVAL_MAX_MS
	) {
		throw new RangeError(
			`triggerIntervalMs must be an integer between ${TRIGGER_INTERVAL_MIN_MS} and ${TRIGGER_INTERVAL_MAX_MS}.`,
		);
	}
}
