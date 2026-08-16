import CanSample from "canSample";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, assertObjectOption, withDeviceFeatures } from "m5chainDevice";
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
import type { DeviceConfiguration, DeviceConfigurationSnapshot, PacketBuffer, SampleHandler } from "types";

export { PIR_REPORT_MODE, PIR_STATUS, type PIRReportMode, type PIRStatus } from "pirProtocol";

export type PIRConfiguration = DeviceConfiguration & {
	pir?: {
		reportMode?: PIRReportMode;
		holdSeconds?: number;
		saveToFlash?: boolean;
	};
};

export type PIRConfigurationSnapshot = DeviceConfigurationSnapshot & {
	pir: {
		reportMode: PIRReportMode;
		holdSeconds: number;
	};
};

export type PIRPresenceHandler = ((status: PIRStatus) => void | Promise<void>) | null;

class M5ChainPIR extends withDeviceFeatures(HasLed, CanSample<PIRStatus>) {
	static DEVICE_TYPE = 0x0009;
	readonly kind = "pir" as const;
	static PIR_STATUS = PIR_STATUS;
	static PIR_REPORT_MODE = PIR_REPORT_MODE;
	static CMD = Object.freeze({
		...super.CMD,
		...PIR_COMMAND,
	} as const);
	declare onSample: SampleHandler<PIRStatus>;
	declare sample: () => PIRStatus | undefined;
	declare dispatchOnSample: (value: PIRStatus) => void;

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
		assertKnownConfigurationOptions(options, ["pir"]);
		await super.configure(options);
		if (options.pir === undefined) return;
		assertObjectOption("options.pir", options.pir);

		if (options.pir.reportMode !== undefined) {
			await this.#setReportMode(options.pir.reportMode);
		}
		if (options.pir.holdSeconds !== undefined) {
			await this.#setHoldSeconds(options.pir.holdSeconds, options.pir.saveToFlash ?? false);
		} else if (options.pir.saveToFlash !== undefined) {
			throw new RangeError("options.pir.saveToFlash requires options.pir.holdSeconds.");
		}
	}

	async readConfiguration(): Promise<PIRConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			pir: {
				reportMode: await this.#getReportMode(),
				holdSeconds: await this.#getHoldSeconds(),
			},
		};
	}

	async readSample(): Promise<PIRStatus | undefined> {
		const bus = this.bus;
		const packet = await bus.sendAndWaitForResult(this.id, M5ChainPIR.CMD.GET_STATUS, bus.cmdBuffer, 0);
		if (!(packet instanceof Uint8Array)) {
			throw new Error(`PIR sample read failed: ${packet.__m5chain}`);
		}
		return pirStatusFromValue(packet[6]);
	}

	async getPresenceStatus(): Promise<PIRStatus> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_STATUS, bus.cmdBuffer, 0);
		return pirStatusFromValue(packet[6]);
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
		if (packet[6] !== 1) {
			throw new Error("configure PIR report mode failed.\n");
		}
	}

	async #getReportMode(): Promise<PIRReportMode> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_REPORT_MODE, bus.cmdBuffer, 0);
		return pirReportModeFromValue(packet[6]);
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
		if (packet[6] !== 1) {
			throw new Error("configure PIR hold time failed.\n");
		}
	}

	async #getHoldSeconds(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainPIR.CMD.GET_HOLD_SECONDS, bus.cmdBuffer, 0);
		return packet[6];
	}
}

export default M5ChainPIR;
