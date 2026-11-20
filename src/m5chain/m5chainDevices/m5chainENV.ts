import CanSample from "canSample";
import {
	assertENVRate,
	assertENVTemperatureSource,
	ENV_COMMAND,
	type ENVAHT20Data,
	type ENVRate,
	type ENVSample,
	type ENVSPA06Data,
	type ENVTemperatureThreshold,
	type ENVThreshold,
	type ENVWarning,
	envPacketView,
	envScaledInteger,
	envWarningFromPacket,
} from "envProtocol";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, PacketBuffer } from "types";

export {
	ENV_RATE,
	ENV_REPORT_MODE,
	ENV_TEMPERATURE_SOURCE,
	type ENVAHT20Data,
	type ENVRate,
	type ENVSample,
	type ENVSPA06Data,
	type ENVTemperatureSource,
	type ENVTemperatureThreshold,
	type ENVThreshold,
	type ENVWarning,
	type ENVWarningState,
} from "envProtocol";

export type ENVConfiguration = DeviceConfiguration & {
	temperatureRate?: ENVRate;
	pressureRate?: ENVRate;
	seaLevelPressure?: number;
	saveToFlash?: boolean;
	reportMode?: number;
	temperatureThreshold?: ENVTemperatureThreshold;
	humidityThreshold?: ENVThreshold;
	pressureThreshold?: ENVThreshold;
	altitudeThreshold?: ENVThreshold;
};
export type ENVConfigurationSnapshot = DeviceConfigurationSnapshot & Required<Omit<ENVConfiguration, "saveToFlash">>;
export type ENVWarningHandler = ((warning: ENVWarning) => void | Promise<void>) | null;

class M5ChainENV extends withDeviceFeatures(HasLed, CanSample<ENVSample>()) {
	static readonly DEVICE_TYPE = 0x000f;
	override readonly kind = "env" as const;
	static override CMD = Object.freeze({ ...super.CMD, ...ENV_COMMAND } as const);
	#onWarning: ENVWarningHandler = null;

	set onWarning(fn: ENVWarningHandler) {
		if (fn !== null && typeof fn !== "function") throw new Error("onWarning must be a function or null");
		this.#onWarning = fn;
	}
	get onWarning(): ENVWarningHandler {
		return this.#onWarning;
	}
	onDispatchEvent(packet: PacketBuffer) {
		return this.#onWarning?.(envWarningFromPacket(packet));
	}

	override async configure(options: ENVConfiguration = {}): Promise<void> {
		await super.configure(options);
		assertKnownConfigurationOptions(options, [
			"temperatureRate",
			"pressureRate",
			"seaLevelPressure",
			"saveToFlash",
			"reportMode",
			"temperatureThreshold",
			"humidityThreshold",
			"pressureThreshold",
			"altitudeThreshold",
		]);
		const save = options.saveToFlash ?? false;
		if (typeof save !== "boolean") throw new RangeError("saveToFlash must be a boolean.");
		if (options.saveToFlash !== undefined && options.seaLevelPressure === undefined)
			throw new RangeError("saveToFlash requires seaLevelPressure.");
		// Validate the entire configuration before sending any commands.
		if (options.temperatureRate !== undefined) assertENVRate(options.temperatureRate);
		if (options.pressureRate !== undefined) assertENVRate(options.pressureRate);
		if (options.seaLevelPressure !== undefined)
			envScaledInteger("seaLevelPressure", options.seaLevelPressure, 10, 3000, 11000);
		if (options.reportMode !== undefined) envScaledInteger("reportMode", options.reportMode, 1, 0, 15);
		const temperature = options.temperatureThreshold;
		if (temperature !== undefined) {
			assertENVTemperatureSource(temperature.source);
			this.#thresholdData(temperature, 1, 0, 255);
		}
		if (options.humidityThreshold !== undefined) this.#thresholdData(options.humidityThreshold, 1, 0, 100);
		if (options.pressureThreshold !== undefined) this.#thresholdData(options.pressureThreshold, 10, 7000, 12000);
		if (options.altitudeThreshold !== undefined)
			this.#thresholdData(options.altitudeThreshold, 100, -2147483648, 2147483647);
		if (options.temperatureRate !== undefined)
			await this.#set(ENV_COMMAND.SET_TEMPERATURE_RATE, Uint8Array.of(options.temperatureRate));
		if (options.pressureRate !== undefined)
			await this.#set(ENV_COMMAND.SET_PRESSURE_RATE, Uint8Array.of(options.pressureRate));
		if (options.seaLevelPressure !== undefined) {
			const data = new Uint8Array(3);
			new DataView(data.buffer).setUint16(0, Math.round(options.seaLevelPressure * 10), true);
			data[2] = save ? 1 : 0;
			await this.#set(ENV_COMMAND.SET_SEA_LEVEL_PRESSURE, data);
		}
		if (options.reportMode !== undefined)
			await this.#set(ENV_COMMAND.SET_REPORT_MODE, Uint8Array.of(options.reportMode));
		if (temperature !== undefined)
			await this.#set(
				ENV_COMMAND.SET_TEMPERATURE_THRESHOLD,
				Uint8Array.of(temperature.source, temperature.low, temperature.high),
			);
		if (options.humidityThreshold !== undefined)
			await this.#set(ENV_COMMAND.SET_HUMIDITY_THRESHOLD, this.#thresholdData(options.humidityThreshold, 1, 0, 100));
		if (options.pressureThreshold !== undefined)
			await this.#set(
				ENV_COMMAND.SET_PRESSURE_THRESHOLD,
				this.#thresholdData(options.pressureThreshold, 10, 7000, 12000),
			);
		if (options.altitudeThreshold !== undefined)
			await this.#set(
				ENV_COMMAND.SET_ALTITUDE_THRESHOLD,
				this.#thresholdData(options.altitudeThreshold, 100, -2147483648, 2147483647),
			);
	}

	override async readConfiguration(): Promise<ENVConfigurationSnapshot> {
		const temperatureRate = (await this.#get(ENV_COMMAND.GET_TEMPERATURE_RATE, 1)).getUint8(0);
		assertENVRate(temperatureRate);
		const pressureRate = (await this.#get(ENV_COMMAND.GET_PRESSURE_RATE, 1)).getUint8(0);
		assertENVRate(pressureRate);
		const seaLevelPressure = (await this.#get(ENV_COMMAND.GET_SEA_LEVEL_PRESSURE, 2)).getUint16(0, true) / 10;
		const reportMode = (await this.#get(ENV_COMMAND.GET_REPORT_MODE, 1)).getUint8(0);
		envScaledInteger("reportMode", reportMode, 1, 0, 15);
		const temperature = await this.#get(ENV_COMMAND.GET_TEMPERATURE_THRESHOLD, 3);
		const source = temperature.getUint8(0);
		assertENVTemperatureSource(source);
		const humidity = await this.#get(ENV_COMMAND.GET_HUMIDITY_THRESHOLD, 2);
		const pressure = await this.#get(ENV_COMMAND.GET_PRESSURE_THRESHOLD, 4);
		const altitude = await this.#get(ENV_COMMAND.GET_ALTITUDE_THRESHOLD, 8);
		return {
			...(await super.readConfiguration()),
			temperatureRate,
			pressureRate,
			seaLevelPressure,
			reportMode,
			temperatureThreshold: { source, low: temperature.getUint8(1), high: temperature.getUint8(2) },
			humidityThreshold: { low: humidity.getUint8(0), high: humidity.getUint8(1) },
			pressureThreshold: { low: pressure.getUint16(0, true) / 10, high: pressure.getUint16(2, true) / 10 },
			altitudeThreshold: { low: altitude.getInt32(0, true) / 100, high: altitude.getInt32(4, true) / 100 },
		};
	}

	async getAHT20Data(): Promise<ENVAHT20Data> {
		const data = await this.#get(ENV_COMMAND.GET_AHT20_DATA, 3);
		return { temperature: data.getInt16(0, true) / 100, humidity: data.getUint8(2) };
	}
	async getSPA06Data(): Promise<ENVSPA06Data> {
		const data = await this.#get(ENV_COMMAND.GET_SPA06_DATA, 8);
		return {
			temperature: data.getInt16(0, true) / 100,
			pressure: data.getUint16(2, true) / 10,
			altitude: data.getInt32(4, true) / 100,
		};
	}
	override async readSample(): Promise<ENVSample> {
		const aht = await this.getAHT20Data();
		const spa = await this.getSPA06Data();
		return { ...aht, pressureTemperature: spa.temperature, pressure: spa.pressure, altitude: spa.altitude };
	}
	async calibrateSeaLevelPressure(referenceAltitude: number, saveToFlash = false): Promise<void> {
		const altitude = envScaledInteger("referenceAltitude", referenceAltitude, 100, -2147483648, 2147483647);
		if (typeof saveToFlash !== "boolean") throw new RangeError("saveToFlash must be a boolean.");
		const data = new Uint8Array(5);
		new DataView(data.buffer).setInt32(0, altitude, true);
		data[4] = saveToFlash ? 1 : 0;
		await this.#set(ENV_COMMAND.CALIBRATE_SEA_LEVEL_PRESSURE, data, 10000);
	}

	#thresholdData(threshold: ENVThreshold, scale: number, min: number, max: number): Uint8Array {
		const low = envScaledInteger("threshold.low", threshold.low, scale, min, max);
		const high = envScaledInteger("threshold.high", threshold.high, scale, min, max);
		if (low >= high) throw new RangeError("threshold.low must be less than threshold.high.");
		const width = scale === 100 ? 4 : scale === 10 ? 2 : 1;
		const data = new Uint8Array(width * 2);
		const view = new DataView(data.buffer);
		if (width === 4) {
			view.setInt32(0, low, true);
			view.setInt32(4, high, true);
		} else if (width === 2) {
			view.setUint16(0, low, true);
			view.setUint16(2, high, true);
		} else {
			data[0] = low;
			data[1] = high;
		}
		return data;
	}
	async #get(command: number, size: number): Promise<DataView> {
		const bus = this.bus;
		return envPacketView(await bus.sendAndWait(this.id, command, bus.cmdBuffer, 0), size);
	}
	async #set(command: number, data: Uint8Array, timeoutMs = 800): Promise<void> {
		const packet = await this.bus.sendAndWait(this.id, command, data, data.length, { timeoutMs });
		if (envPacketView(packet, 1).getUint8(0) !== 1) throw new Error("ENV operation failed.");
	}
}
export default M5ChainENV;
