import { readPacketByte } from "m5chainDevice";

export const ENV_COMMAND = Object.freeze({
	GET_AHT20_DATA: 0x30,
	GET_SPA06_DATA: 0x31,
	SET_TEMPERATURE_RATE: 0x32,
	GET_TEMPERATURE_RATE: 0x33,
	SET_PRESSURE_RATE: 0x34,
	GET_PRESSURE_RATE: 0x35,
	SET_SEA_LEVEL_PRESSURE: 0x36,
	GET_SEA_LEVEL_PRESSURE: 0x37,
	CALIBRATE_SEA_LEVEL_PRESSURE: 0x38,
	REPORT_WARNING: 0xe0,
	SET_REPORT_MODE: 0xe1,
	GET_REPORT_MODE: 0xe2,
	SET_TEMPERATURE_THRESHOLD: 0xe3,
	GET_TEMPERATURE_THRESHOLD: 0xe4,
	SET_HUMIDITY_THRESHOLD: 0xe5,
	GET_HUMIDITY_THRESHOLD: 0xe6,
	SET_PRESSURE_THRESHOLD: 0xe7,
	GET_PRESSURE_THRESHOLD: 0xe8,
	SET_ALTITUDE_THRESHOLD: 0xe9,
	GET_ALTITUDE_THRESHOLD: 0xea,
} as const);

export const ENV_RATE = Object.freeze({
	HZ_1: 0x00,
	HZ_2: 0x01,
	HZ_4: 0x02,
	HZ_8: 0x03,
	HZ_16: 0x04,
	HZ_32: 0x05,
	HZ_64: 0x06,
	HZ_128: 0x07,
	HZ_25_16: 0x08,
	HZ_25_8: 0x09,
	HZ_25_4: 0x0a,
	HZ_25_2: 0x0b,
	HZ_25: 0x0c,
	HZ_50: 0x0d,
	HZ_100: 0x0e,
	HZ_200: 0x0f,
} as const);

export const ENV_REPORT_MODE = Object.freeze({
	DISABLED: 0x00,
	TEMPERATURE: 0x01,
	HUMIDITY: 0x02,
	PRESSURE: 0x04,
	ALTITUDE: 0x08,
	ALL: 0x0f,
} as const);

export const ENV_TEMPERATURE_SOURCE = Object.freeze({
	AHT20: 0x00,
	SPA06: 0x01,
} as const);

export type ENVRate = (typeof ENV_RATE)[keyof typeof ENV_RATE];
export type ENVTemperatureSource = (typeof ENV_TEMPERATURE_SOURCE)[keyof typeof ENV_TEMPERATURE_SOURCE];
export type ENVThreshold = { low: number; high: number };
export type ENVTemperatureThreshold = ENVThreshold & { source: ENVTemperatureSource };
export type ENVAHT20Data = { temperature: number; humidity: number };
export type ENVSPA06Data = { temperature: number; pressure: number; altitude: number };
export type ENVSample = ENVAHT20Data & { pressureTemperature: number; pressure: number; altitude: number };
// Each field retains its last transition code, even when another field caused the report.
export type ENVWarningState = 0 | 1 | 2 | 3;
export type ENVWarning = {
	temperature: ENVWarningState;
	humidity: ENVWarningState;
	pressure: ENVWarningState;
	altitude: ENVWarningState;
};

export function envPacketView(packet: Uint8Array, payloadSize: number): DataView {
	if (packet.length !== payloadSize + 9) throw new Error("ENV response has an invalid payload length.");
	return new DataView(packet.buffer, packet.byteOffset + 6, payloadSize);
}

export function envScaledInteger(name: string, value: number, scale: number, min: number, max: number): number {
	const scaled = Math.round(value * scale);
	if (!Number.isFinite(value) || scaled < min || scaled > max || Math.abs(value * scale - scaled) > 0.000001) {
		throw new RangeError(`${name} must be between ${min / scale} and ${max / scale} in steps of ${1 / scale}.`);
	}
	return scaled;
}

export function assertENVRate(value: number): asserts value is ENVRate {
	envScaledInteger("ENV rate", value, 1, 0, 15);
}

export function assertENVTemperatureSource(value: number): asserts value is ENVTemperatureSource {
	envScaledInteger("temperature source", value, 1, 0, 1);
}

export function envWarningFromPacket(packet: Uint8Array): ENVWarning {
	envPacketView(packet, 2);
	if (readPacketByte(packet, 7, "ENV warning") !== 0x0f) throw new Error("Unknown ENV warning report type.");
	const status = readPacketByte(packet, 6, "ENV warning");
	return {
		temperature: (status & 3) as ENVWarningState,
		humidity: ((status >> 2) & 3) as ENVWarningState,
		pressure: ((status >> 4) & 3) as ENVWarningState,
		altitude: ((status >> 6) & 3) as ENVWarningState,
	};
}
