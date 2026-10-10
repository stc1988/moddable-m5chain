import CanSample from "canSample";
import HasLed from "hasLed";
import {
	assertKnownConfigurationOptions,
	assertObjectOption,
	readPacketByte,
	readPacketUint16LE,
	withDeviceFeatures,
} from "m5chainDevice";
import {
	assertSwitchThresholds,
	SWITCH_COMMAND,
	SWITCH_DIRECTION,
	SWITCH_REPORT_MODE,
	SWITCH_STATUS,
	type SwitchDirection,
	type SwitchReportMode,
	type SwitchStatus,
	switchDirectionFromValue,
	switchDirectionToValue,
	switchReportModeFromValue,
	switchReportModeToValue,
	switchStatusFromEventPacket,
	switchStatusFromValue,
} from "switchProtocol";
import type { DeviceConfiguration, DeviceConfigurationSnapshot, PacketBuffer } from "types";

export {
	SWITCH_DIRECTION,
	SWITCH_REPORT_MODE,
	SWITCH_STATUS,
	type SwitchDirection,
	type SwitchReportMode,
	type SwitchStatus,
} from "switchProtocol";

export type SwitchThresholds = {
	open: number;
	close: number;
};

export type SwitchConfiguration = DeviceConfiguration & {
	direction?: SwitchDirection;
	thresholds?: SwitchThresholds;
	reportMode?: SwitchReportMode;
	saveToFlash?: boolean;
};

export type SwitchConfigurationSnapshot = DeviceConfigurationSnapshot & {
	direction: SwitchDirection;
	thresholds: SwitchThresholds;
	reportMode: SwitchReportMode;
};

export type SwitchChangeHandler = ((status: SwitchStatus) => void | Promise<void>) | null;

class M5ChainSwitch extends withDeviceFeatures(HasLed, CanSample<number>()) {
	static readonly DEVICE_TYPE = 0x0007;
	override readonly kind = "switch" as const;
	static SWITCH_DIRECTION = SWITCH_DIRECTION;
	static SWITCH_REPORT_MODE = SWITCH_REPORT_MODE;
	static SWITCH_STATUS = SWITCH_STATUS;
	static override CMD = Object.freeze({
		...super.CMD,
		...SWITCH_COMMAND,
	} as const);

	#onSwitchChanged: SwitchChangeHandler = null;

	set onSwitchChanged(fn: SwitchChangeHandler) {
		if (fn !== null && typeof fn !== "function") {
			throw new Error("onSwitchChanged must be a function or null");
		}
		this.#onSwitchChanged = fn;
	}

	get onSwitchChanged(): SwitchChangeHandler {
		return this.#onSwitchChanged;
	}

	override async configure(options: SwitchConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["direction", "thresholds", "reportMode", "saveToFlash"]);
		await super.configure(options);
		const saveToFlash = options.saveToFlash ?? false;
		if (saveToFlash !== true && saveToFlash !== false) {
			throw new RangeError("saveToFlash must be a boolean.");
		}
		if (options.direction !== undefined) {
			switchDirectionToValue(options.direction);
		}
		if (options.thresholds !== undefined) {
			assertObjectOption("options.thresholds", options.thresholds);
			assertSwitchThresholds(options.thresholds.open, options.thresholds.close);
		}
		if (options.reportMode !== undefined) {
			switchReportModeToValue(options.reportMode);
		}
		if (options.saveToFlash !== undefined && options.direction === undefined && options.thresholds === undefined) {
			throw new RangeError("options.saveToFlash requires options.direction or options.thresholds.");
		}

		if (options.direction !== undefined) {
			await this.#setDirection(options.direction, saveToFlash);
		}
		if (options.thresholds !== undefined) {
			await this.#setThresholds(options.thresholds, saveToFlash);
		}
		if (options.reportMode !== undefined) {
			await this.#setReportMode(options.reportMode);
		}
	}

	override async readConfiguration(): Promise<SwitchConfigurationSnapshot> {
		return {
			...(await super.readConfiguration()),
			direction: await this.#getDirection(),
			thresholds: await this.#getThresholds(),
			reportMode: await this.#getReportMode(),
		};
	}

	override async readSample(): Promise<number | undefined> {
		const bus = this.bus;
		const packet = await bus.sendAndWaitForResult(this.id, M5ChainSwitch.CMD.GET_12ADC, bus.cmdBuffer, 0);
		if (!(packet instanceof Uint8Array)) {
			throw new Error(`Switch sample read failed: ${packet.__m5chain}`);
		}
		return readPacketUint16LE(packet, 6, "read switch sample");
	}

	async getSwitch12Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_12ADC, bus.cmdBuffer, 0);
		return readPacketUint16LE(packet, 6, "get 12-bit switch ADC");
	}

	async getSwitch8Adc(): Promise<number> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_8ADC, bus.cmdBuffer, 0);
		return readPacketByte(packet, 6, "get 8-bit switch ADC");
	}

	async getSwitchStatus(): Promise<SwitchStatus> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_STATUS, bus.cmdBuffer, 0);
		return switchStatusFromValue(readPacketByte(packet, 6, "get switch status"));
	}

	async isOpen(): Promise<boolean> {
		return (await this.getSwitchStatus()) === SWITCH_STATUS.OPEN;
	}

	onDispatchEvent(buffer: PacketBuffer) {
		return this.#onSwitchChanged?.(switchStatusFromEventPacket(buffer));
	}

	async #setDirection(direction: SwitchDirection, saveToFlash: boolean): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = switchDirectionToValue(direction);
		bus.cmdBuffer[1] = saveToFlash ? 1 : 0;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.SET_DIRECTION, bus.cmdBuffer, 2);
		if (readPacketByte(packet, 6, "set switch direction") !== 1) {
			throw new Error("configure switch direction failed.\n");
		}
	}

	async #getDirection(): Promise<SwitchDirection> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_DIRECTION, bus.cmdBuffer, 0);
		return switchDirectionFromValue(readPacketByte(packet, 6, "get switch direction"));
	}

	async #setThresholds(thresholds: SwitchThresholds, saveToFlash: boolean): Promise<void> {
		assertSwitchThresholds(thresholds.open, thresholds.close);
		const bus = this.bus;
		bus.cmdBuffer[0] = thresholds.open & 0xff;
		bus.cmdBuffer[1] = thresholds.open >> 8;
		bus.cmdBuffer[2] = thresholds.close & 0xff;
		bus.cmdBuffer[3] = thresholds.close >> 8;
		bus.cmdBuffer[4] = saveToFlash ? 1 : 0;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.SET_THRESHOLDS, bus.cmdBuffer, 5);
		if (readPacketByte(packet, 6, "set switch thresholds") !== 1) {
			throw new Error("configure switch thresholds failed.\n");
		}
	}

	async #getThresholds(): Promise<SwitchThresholds> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_THRESHOLDS, bus.cmdBuffer, 0);
		return {
			open: readPacketUint16LE(packet, 6, "get switch open threshold"),
			close: readPacketUint16LE(packet, 8, "get switch close threshold"),
		};
	}

	async #setReportMode(mode: SwitchReportMode): Promise<void> {
		const bus = this.bus;
		bus.cmdBuffer[0] = switchReportModeToValue(mode);
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.SET_REPORT_MODE, bus.cmdBuffer, 1);
		if (readPacketByte(packet, 6, "set switch report mode") !== 1) {
			throw new Error("configure switch report mode failed.\n");
		}
	}

	async #getReportMode(): Promise<SwitchReportMode> {
		const bus = this.bus;
		const packet = await bus.sendAndWait(this.id, M5ChainSwitch.CMD.GET_REPORT_MODE, bus.cmdBuffer, 0);
		return switchReportModeFromValue(readPacketByte(packet, 6, "get switch report mode"));
	}
}

export default M5ChainSwitch;
