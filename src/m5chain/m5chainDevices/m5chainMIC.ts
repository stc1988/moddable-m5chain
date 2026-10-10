import CanSample from "canSample";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, readPacketByte, readPacketUint16LE, withDeviceFeatures } from "m5chainDevice";
import {
	assertMICThreshold,
	assertMICTriggerInterval,
	MIC_COMMAND,
	MIC_REPORT_MODE,
	MIC_TRIGGER,
	type MICReportMode,
	type MICTrigger,
	micReportModeFromValue,
	micReportModeToValue,
	micTriggerFromEventPacket,
} from "micProtocol";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, PacketBuffer } from "types";

export { MIC_REPORT_MODE, MIC_TRIGGER, type MICReportMode, type MICTrigger } from "micProtocol";

export type MICConfiguration = DeviceConfiguration & {
	threshold?: number;
	reportMode?: MICReportMode;
	triggerIntervalMs?: number;
	saveToFlash?: boolean;
};

export type MICConfigurationSnapshot = DeviceConfigurationSnapshot & {
	threshold: number;
	reportMode: MICReportMode;
	triggerIntervalMs: number;
};

export type MICThresholdHandler = ((trigger: MICTrigger) => void | Promise<void>) | null;

class M5ChainMIC extends withDeviceFeatures(HasLed, CanSample<number>()) {
	static readonly DEVICE_TYPE = 0x000a;
	override readonly kind = "mic" as const;
	static MIC_REPORT_MODE = MIC_REPORT_MODE;
	static MIC_TRIGGER = MIC_TRIGGER;
	static override CMD = Object.freeze({
		...super.CMD,
		...MIC_COMMAND,
	} as const);

	#onThresholdCrossed: MICThresholdHandler = null;

	set onThresholdCrossed(fn: MICThresholdHandler) {
		if (fn !== null && typeof fn !== "function") {
			throw new Error("onThresholdCrossed must be a function or null");
		}
		this.#onThresholdCrossed = fn;
	}

	get onThresholdCrossed(): MICThresholdHandler {
		return this.#onThresholdCrossed;
	}

	override async configure(options: MICConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["threshold", "reportMode", "triggerIntervalMs", "saveToFlash"]);
		await super.configure(options);

		const saveToFlash = options.saveToFlash ?? false;
		if (saveToFlash !== true && saveToFlash !== false) {
			throw new RangeError("saveToFlash must be a boolean.");
		}
		if (options.threshold !== undefined) {
			assertMICThreshold(options.threshold);
		}
		if (options.reportMode !== undefined) {
			micReportModeToValue(options.reportMode);
		}
		if (options.triggerIntervalMs !== undefined) {
			assertMICTriggerInterval(options.triggerIntervalMs);
		}
		if (options.saveToFlash !== undefined && options.threshold === undefined) {
			throw new RangeError("options.saveToFlash requires options.threshold.");
		}

		if (options.threshold !== undefined) {
			await this.#setThreshold(options.threshold, saveToFlash);
		}
		if (options.reportMode !== undefined) {
			await this.#setReportMode(options.reportMode);
		}
		if (options.triggerIntervalMs !== undefined) {
			await this.#setTriggerInterval(options.triggerIntervalMs);
		}
	}

	override async readConfiguration(): Promise<MICConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			threshold: await this.#getThreshold(),
			reportMode: await this.#getReportMode(),
			triggerIntervalMs: await this.#getTriggerInterval(),
		};
	}

	override async readSample(): Promise<number | undefined> {
		const bus = this.bus;
		const packet = await bus.sendAndWaitForResult(this.id, M5ChainMIC.CMD.GET_12ADC, bus.cmdBuffer, 0);
		if (!(packet instanceof Uint8Array)) {
			throw new Error(`MIC sample read failed: ${packet.__m5chain}`);
		}
		return readPacketUint16LE(packet, 6, "read MIC sample");
	}

	async getMic12Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.GET_12ADC, bus.cmdBuffer, 0);
		return readPacketUint16LE(packet, 6, "get 12-bit MIC ADC");
	}

	async getMic8Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return readPacketByte(packet, 6, "get 8-bit MIC ADC");
	}

	onDispatchEvent(buffer: PacketBuffer) {
		return this.#onThresholdCrossed?.(micTriggerFromEventPacket(buffer));
	}

	async #setThreshold(threshold: number, saveToFlash: boolean): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = threshold & 0xff;
		bus.cmdBuffer[1] = threshold >> 8;
		bus.cmdBuffer[2] = saveToFlash ? 1 : 0;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.SET_THRESHOLD, bus.cmdBuffer, 3);
		if (readPacketByte(packet, 6, "set MIC threshold") !== 1) {
			throw new Error("configure MIC threshold failed.\n");
		}
	}

	async #getThreshold(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.GET_THRESHOLD, bus.cmdBuffer, 0);
		return readPacketUint16LE(packet, 6, "get MIC threshold");
	}

	async #setReportMode(mode: MICReportMode): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = micReportModeToValue(mode);
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.SET_REPORT_MODE, bus.cmdBuffer, 1);
		if (readPacketByte(packet, 6, "set MIC report mode") !== 1) {
			throw new Error("configure MIC report mode failed.\n");
		}
	}

	async #getReportMode(): Promise<MICReportMode> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.GET_REPORT_MODE, bus.cmdBuffer, 0);
		return micReportModeFromValue(readPacketByte(packet, 6, "get MIC report mode"));
	}

	async #setTriggerInterval(triggerIntervalMs: number): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = triggerIntervalMs & 0xff;
		bus.cmdBuffer[1] = triggerIntervalMs >> 8;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.SET_TRIGGER_INTERVAL, bus.cmdBuffer, 2);
		if (readPacketByte(packet, 6, "set MIC trigger interval") !== 1) {
			throw new Error("configure MIC trigger interval failed.\n");
		}
	}

	async #getTriggerInterval(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainMIC.CMD.GET_TRIGGER_INTERVAL, bus.cmdBuffer, 0);
		return readPacketUint16LE(packet, 6, "get MIC trigger interval");
	}
}

export default M5ChainMIC;
