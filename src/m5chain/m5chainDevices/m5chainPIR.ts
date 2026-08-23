import CanSample, { type CanSampleMethods } from "canSample";
import HasLed, { type HasLedMethods } from "hasLed";
import { assertKnownConfigurationOptions, readPacketByte, withDeviceFeatures } from "m5chainDevice";
import {
	assertPIRHoldSeconds,
	PIR_COMMAND,
	PIR_REPORT_MODE,
	PIR_STATUS,
	type PIRReportMode,
	type PIRStatus,
	pirReportModeFromValue,
	pirReportModeToValue,
	pirStatusFromEventPacket,
	pirStatusFromValue,
} from "pirProtocol";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, PacketBuffer } from "types";

export { PIR_REPORT_MODE, PIR_STATUS, type PIRReportMode, type PIRStatus } from "pirProtocol";

export type PIRConfiguration = DeviceConfiguration & {
	reportMode?: PIRReportMode;
	holdSeconds?: number;
	saveToFlash?: boolean;
};

export type PIRConfigurationSnapshot = DeviceConfigurationSnapshot & {
	reportMode: PIRReportMode;
	holdSeconds: number;
};

export type PIRPresenceHandler = ((status: PIRStatus) => void | Promise<void>) | null;

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Runtime mixins install the merged feature methods.
class M5ChainPIR extends withDeviceFeatures(HasLed, CanSample<PIRStatus>()) {
	static DEVICE_TYPE = 0x0009;
	readonly kind = "pir" as const;
	static PIR_STATUS = PIR_STATUS;
	static PIR_REPORT_MODE = PIR_REPORT_MODE;
	static CMD = Object.freeze({
		...super.CMD,
		...PIR_COMMAND,
	} as const);

	#onPresenceChanged: PIRPresenceHandler = null;

	set onPresenceChanged(fn: PIRPresenceHandler) {
		if (fn !== null && typeof fn !== "function") {
			throw new Error("onPresenceChanged must be a function or null");
		}
		this.#onPresenceChanged = fn;
	}

	get onPresenceChanged(): PIRPresenceHandler {
		return this.#onPresenceChanged;
	}

	async configure(options: PIRConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["reportMode", "holdSeconds", "saveToFlash"]);
		await super.configure(options);

		if (options.reportMode !== undefined) {
			await this.#setReportMode(options.reportMode);
		}
		if (options.holdSeconds !== undefined) {
			await this.#setHoldSeconds(options.holdSeconds, options.saveToFlash ?? false);
		} else if (options.saveToFlash !== undefined) {
			throw new RangeError("options.saveToFlash requires options.holdSeconds.");
		}
	}

	async readConfiguration(): Promise<PIRConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			reportMode: await this.#getReportMode(),
			holdSeconds: await this.#getHoldSeconds(),
		};
	}

	async readSample(): Promise<PIRStatus | undefined> {
		const bus = this.bus;
		const packet = await bus.sendAndWaitForResult(this.id, M5ChainPIR.CMD.GET_STATUS, bus.cmdBuffer, 0);
		if (!(packet instanceof Uint8Array)) {
			throw new Error(`PIR sample read failed: ${packet.__m5chain}`);
		}
		return pirStatusFromValue(readPacketByte(packet, 6, "read PIR sample"));
	}

	async getPresenceStatus(): Promise<PIRStatus> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_STATUS, bus.cmdBuffer, 0);
		return pirStatusFromValue(readPacketByte(packet, 6, "get PIR presence status"));
	}

	async isPersonDetected(): Promise<boolean> {
		return (await this.getPresenceStatus()) === PIR_STATUS.PERSON_DETECTED;
	}

	onDispatchEvent(buffer: PacketBuffer) {
		return this.#onPresenceChanged?.(pirStatusFromEventPacket(buffer));
	}

	async #setReportMode(mode: PIRReportMode): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = pirReportModeToValue(mode);
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.SET_REPORT_MODE, bus.cmdBuffer, 1);
		if (readPacketByte(packet, 6, "set PIR report mode") !== 1) {
			throw new Error("configure PIR report mode failed.\n");
		}
	}

	async #getReportMode(): Promise<PIRReportMode> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_REPORT_MODE, bus.cmdBuffer, 0);
		return pirReportModeFromValue(readPacketByte(packet, 6, "get PIR report mode"));
	}

	async #setHoldSeconds(holdSeconds: number, saveToFlash: boolean): Promise<void> {
		assertPIRHoldSeconds(holdSeconds);
		if (saveToFlash !== true && saveToFlash !== false) {
			throw new RangeError("saveToFlash must be a boolean.");
		}
		const bus = this.bus;
		bus.cmdBuffer[0] = holdSeconds;
		bus.cmdBuffer[1] = saveToFlash ? 1 : 0;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.SET_HOLD_SECONDS, bus.cmdBuffer, 2);
		if (readPacketByte(packet, 6, "set PIR hold time") !== 1) {
			throw new Error("configure PIR hold time failed.\n");
		}
	}

	async #getHoldSeconds(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_HOLD_SECONDS, bus.cmdBuffer, 0);
		return readPacketByte(packet, 6, "get PIR hold time");
	}
}

interface M5ChainPIR extends HasLedMethods, CanSampleMethods<PIRStatus> {}

export default M5ChainPIR;
