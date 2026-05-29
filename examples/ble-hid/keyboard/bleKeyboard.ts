import { GATTServer } from "embedded:io/bluetoothle/peripheral";
import Timer from "timer";

const DEFAULT_DEVICE_NAME = "BLE Keyboard";
const MANUFACTURER_NAME = "M5Stack";
const MODEL_NUMBER = "M5Chain Keyboard";
const DEFAULT_RELEASE_DELAY_MS = 20;
const DEFAULT_BATTERY_LEVEL = 100;
const AD_FLAG_GENERAL_DISCOVERABLE = 0x02;
const AD_FLAG_BLE_ONLY = 0x04;
const AD_TYPE_APPEARANCE = 0x19;
const KEYBOARD_APPEARANCE = Uint8Array.of(0xc1, 0x03);
const ASCII_A = 0x61;
const ASCII_1 = 0x31;

type KeyboardCharacteristic = object;
type ProtocolMode = (typeof PROTOCOL_MODE)[keyof typeof PROTOCOL_MODE];

type KeyboardInputReportCharacteristic = KeyboardCharacteristic & {
	protocolMode: ProtocolMode;
};

type KeyboardConnection = {
	close(): void;
	notify(characteristic: unknown, value: ArrayBuffer, callback?: (error?: Error) => void): void;
	replyToPasskey(action: "input" | "compareNumber" | "outOfBand", value: number | boolean | ArrayBuffer): void;
	readonly maxinumWrite: number;
	subscribedReports?: KeyboardInputReportCharacteristic[];
	releaseTimer?: ReturnType<typeof Timer.set>;
};

type KeyboardDescriptor = {
	uuid: string;
	value?: Uint8Array;
};

type KeyboardServer = {
	startAdvertising(scan: object, response?: object): void;
};

type BLEKeyboardOptions = {
	deviceName?: string;
	releaseDelayMs?: number;
	batteryLevel?: number;
};

type KeyOptions = {
	keyCode?: KeyCode | number;
	keyCodes?: (KeyCode | number)[];
	character?: string;
	modifiers?: Modifier;
};

type TypeTextOptions = {
	intervalMs?: number;
	modifiers?: Modifier;
	onComplete?: (sent: boolean) => void;
};

type ConnectionState = {
	connected: boolean;
	connectionCount: number;
	protocolMode: ProtocolMode;
	subscribed: boolean;
	subscribedReportCount: number;
};

type ConnectionHandler = ((state: ConnectionState) => void) | null;
type IndicatorHandler = ((indicators: number) => void) | null;
type NotifyErrorHandler = ((error: Error) => void) | null;

type QueuedTextReport = {
	intervalMs: number;
	onComplete?: (sent: boolean) => void;
	report: Uint8Array;
};

const MODIFIER = {
	LEFT_CONTROL: 0x01,
	LEFT_SHIFT: 0x02,
	LEFT_ALT: 0x04,
	LEFT_GUI: 0x08,
	RIGHT_CONTROL: 0x10,
	RIGHT_SHIFT: 0x20,
	RIGHT_ALT: 0x40,
	RIGHT_GUI: 0x80,
} as const;

type Modifier = (typeof MODIFIER)[keyof typeof MODIFIER] | number;

const PROTOCOL_MODE = {
	BOOT: 0,
	REPORT: 1,
} as const;

const KEY_CODE = {
	A: 0x04,
	B: 0x05,
	C: 0x06,
	D: 0x07,
	E: 0x08,
	F: 0x09,
	G: 0x0a,
	H: 0x0b,
	I: 0x0c,
	J: 0x0d,
	K: 0x0e,
	L: 0x0f,
	M: 0x10,
	N: 0x11,
	O: 0x12,
	P: 0x13,
	Q: 0x14,
	R: 0x15,
	S: 0x16,
	T: 0x17,
	U: 0x18,
	V: 0x19,
	W: 0x1a,
	X: 0x1b,
	Y: 0x1c,
	Z: 0x1d,
	NUMBER_1: 0x1e,
	NUMBER_2: 0x1f,
	NUMBER_3: 0x20,
	NUMBER_4: 0x21,
	NUMBER_5: 0x22,
	NUMBER_6: 0x23,
	NUMBER_7: 0x24,
	NUMBER_8: 0x25,
	NUMBER_9: 0x26,
	NUMBER_0: 0x27,
	ENTER: 0x28,
	ESCAPE: 0x29,
	BACKSPACE: 0x2a,
	TAB: 0x2b,
	SPACE: 0x2c,
	MINUS: 0x2d,
	EQUAL: 0x2e,
	LEFT_BRACKET: 0x2f,
	RIGHT_BRACKET: 0x30,
	BACKSLASH: 0x31,
	SEMICOLON: 0x33,
	SINGLE_QUOTE: 0x34,
	GRAVE_ACCENT: 0x35,
	COMMA: 0x36,
	PERIOD: 0x37,
	FORWARD_SLASH: 0x38,
	CAPS_LOCK: 0x39,
	F1: 0x3a,
	F2: 0x3b,
	F3: 0x3c,
	F4: 0x3d,
	F5: 0x3e,
	F6: 0x3f,
	F7: 0x40,
	F8: 0x41,
	F9: 0x42,
	F10: 0x43,
	F11: 0x44,
	F12: 0x45,
	PRINT_SCREEN: 0x46,
	SCROLL_LOCK: 0x47,
	PAUSE: 0x48,
	INSERT: 0x49,
	HOME: 0x4a,
	PAGE_UP: 0x4b,
	DELETE: 0x4c,
	END: 0x4d,
	PAGE_DOWN: 0x4e,
	RIGHT_ARROW: 0x4f,
	LEFT_ARROW: 0x50,
	DOWN_ARROW: 0x51,
	UP_ARROW: 0x52,
	NUM_LOCK: 0x53,
	KEYPAD_FORWARD_SLASH: 0x54,
	KEYPAD_ASTERISK: 0x55,
	KEYPAD_MINUS: 0x56,
	KEYPAD_PLUS: 0x57,
	KEYPAD_ENTER: 0x58,
	KEYPAD_1: 0x59,
	KEYPAD_2: 0x5a,
	KEYPAD_3: 0x5b,
	KEYPAD_4: 0x5c,
	KEYPAD_5: 0x5d,
	KEYPAD_6: 0x5e,
	KEYPAD_7: 0x5f,
	KEYPAD_8: 0x60,
	KEYPAD_9: 0x61,
	KEYPAD_0: 0x62,
	KEYPAD_PERIOD: 0x63,
	NON_US_BACKSLASH: 0x64,
	APPLICATION: 0x65,
} as const;

type KeyCode = (typeof KEY_CODE)[keyof typeof KEY_CODE];

const INDICATOR = {
	NUM_LOCK: 0x01,
	CAPS_LOCK: 0x02,
	SCROLL_LOCK: 0x04,
	COMPOSE: 0x08,
	KANA: 0x10,
} as const;

type Indicator = (typeof INDICATOR)[keyof typeof INDICATOR] | number;

const keyboardReportMap = Uint8Array.of(
	0x05,
	0x01, // Usage Page (Generic Desktop)
	0x09,
	0x06, // Usage (Keyboard)
	0xa1,
	0x01, // Collection (Application)
	0x05,
	0x07, // Usage Page (Keyboard)
	0x19,
	0xe0, // Usage Minimum (Left Control)
	0x29,
	0xe7, // Usage Maximum (Right GUI)
	0x15,
	0x00, // Logical Minimum (0)
	0x25,
	0x01, // Logical Maximum (1)
	0x75,
	0x01, // Report Size (1)
	0x95,
	0x08, // Report Count (8)
	0x81,
	0x02, // Input (Data, Variable, Absolute)
	0x95,
	0x01, // Report Count (1)
	0x75,
	0x08, // Report Size (8)
	0x81,
	0x01, // Input (Constant)
	0x95,
	0x05, // Report Count (5)
	0x75,
	0x01, // Report Size (1)
	0x05,
	0x08, // Usage Page (LEDs)
	0x19,
	0x01, // Usage Minimum (Num Lock)
	0x29,
	0x05, // Usage Maximum (Kana)
	0x91,
	0x02, // Output (Data, Variable, Absolute)
	0x95,
	0x01, // Report Count (1)
	0x75,
	0x03, // Report Size (3)
	0x91,
	0x01, // Output (Constant)
	0x95,
	0x06, // Report Count (6)
	0x75,
	0x08, // Report Size (8)
	0x15,
	0x00, // Logical Minimum (0)
	0x25,
	0x65, // Logical Maximum (101)
	0x05,
	0x07, // Usage Page (Keyboard)
	0x19,
	0x00, // Usage Minimum (Reserved)
	0x29,
	0x65, // Usage Maximum (Keyboard Application)
	0x81,
	0x00, // Input (Data, Array, Absolute)
	0xc0, // End Collection
);

const emptyKeyboardReport = Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0);

function shiftedCharacter(character: string) {
	switch (character) {
		case "!":
			return "1";
		case "@":
			return "2";
		case "#":
			return "3";
		case "$":
			return "4";
		case "%":
			return "5";
		case "^":
			return "6";
		case "&":
			return "7";
		case "*":
			return "8";
		case "(":
			return "9";
		case ")":
			return "0";
		case "_":
			return "-";
		case "+":
			return "=";
		case "{":
			return "[";
		case "}":
			return "]";
		case "|":
			return "\\";
		case ":":
			return ";";
		case '"':
			return "'";
		case "~":
			return "`";
		case "<":
			return ",";
		case ">":
			return ".";
		case "?":
			return "/";
		default:
			return undefined;
	}
}

function keyInfoForCharacter(character: string): { keyCode: number; modifiers: number } | undefined {
	if (character.length !== 1) return undefined;

	let modifiers = 0;
	const shifted = shiftedCharacter(character);
	if (shifted !== undefined) {
		character = shifted;
		modifiers |= MODIFIER.LEFT_SHIFT;
	}

	let code = character.charCodeAt(0);
	if (code >= 0x41 && code <= 0x5a) {
		modifiers |= MODIFIER.LEFT_SHIFT;
		code += 0x20;
	}

	if (code >= 0x61 && code <= 0x7a) {
		return { keyCode: KEY_CODE.A + code - ASCII_A, modifiers };
	}
	if (code >= 0x31 && code <= 0x39) {
		return { keyCode: KEY_CODE.NUMBER_1 + code - ASCII_1, modifiers };
	}

	switch (code) {
		case 0x30:
			return { keyCode: KEY_CODE.NUMBER_0, modifiers };
		case 0x08:
			return { keyCode: KEY_CODE.BACKSPACE, modifiers };
		case 0x09:
			return { keyCode: KEY_CODE.TAB, modifiers };
		case 0x0a:
		case 0x0d:
			return { keyCode: KEY_CODE.ENTER, modifiers };
		case 0x20:
			return { keyCode: KEY_CODE.SPACE, modifiers };
		case 0x27:
			return { keyCode: KEY_CODE.SINGLE_QUOTE, modifiers };
		case 0x2c:
			return { keyCode: KEY_CODE.COMMA, modifiers };
		case 0x2d:
			return { keyCode: KEY_CODE.MINUS, modifiers };
		case 0x2e:
			return { keyCode: KEY_CODE.PERIOD, modifiers };
		case 0x2f:
			return { keyCode: KEY_CODE.FORWARD_SLASH, modifiers };
		case 0x3b:
			return { keyCode: KEY_CODE.SEMICOLON, modifiers };
		case 0x3d:
			return { keyCode: KEY_CODE.EQUAL, modifiers };
		case 0x5b:
			return { keyCode: KEY_CODE.LEFT_BRACKET, modifiers };
		case 0x5c:
			return { keyCode: KEY_CODE.BACKSLASH, modifiers };
		case 0x5d:
			return { keyCode: KEY_CODE.RIGHT_BRACKET, modifiers };
		case 0x60:
			return { keyCode: KEY_CODE.GRAVE_ACCENT, modifiers };
		default:
			return undefined;
	}
}

class BLEKeyboard {
	static KEY_CODE = KEY_CODE;
	static MODIFIER = MODIFIER;
	static INDICATOR = INDICATOR;
	static PROTOCOL_MODE = PROTOCOL_MODE;

	#connections: KeyboardConnection[] = [];
	#releaseDelayMs: number;
	#protocolMode = Uint8Array.of(PROTOCOL_MODE.REPORT);
	#outputReport = Uint8Array.of(0);
	#activeTextReport?: QueuedTextReport;
	#textQueue: QueuedTextReport[] = [];
	#textTimer?: ReturnType<typeof Timer.set>;
	onConnectionChanged: ConnectionHandler = null;
	onIndicatorsChanged: IndicatorHandler = null;
	onNotifyError: NotifyErrorHandler = null;

	constructor(options: BLEKeyboardOptions = {}) {
		const deviceName = options.deviceName ?? DEFAULT_DEVICE_NAME;
		const batteryLevel = options.batteryLevel ?? DEFAULT_BATTERY_LEVEL;
		this.#releaseDelayMs = options.releaseDelayMs ?? DEFAULT_RELEASE_DELAY_MS;

		const keyboard = this;
		const keyboardInputReport = this.#createKeyboardInputReport({
			uuid: "2a4d",
			logLabel: "[ble-keyboard/core] input report",
			protocolMode: PROTOCOL_MODE.REPORT,
			descriptors: [
				{
					// Report Reference: report ID 0, input report type.
					uuid: "2908",
					value: Uint8Array.of(0, 1),
				},
			],
		});
		const bootKeyboardInputReport = this.#createKeyboardInputReport({
			uuid: "2a22",
			logLabel: "[ble-keyboard/core] boot input report",
			protocolMode: PROTOCOL_MODE.BOOT,
		});

		new GATTServer({
			mtu: 128,
			security: {
				bond: true,
				ioCapabilities: "none",
			},
			services: [
				// Generic Access Service: exposes the GAP device name and HID keyboard appearance.
				{
					uuid: "1800",
					characteristics: [
						{
							// Device Name: name shown by scanners that read GAP 2A00.
							uuid: "2a00",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(deviceName),
						},
						{
							// Appearance: 0x03C1 identifies this peripheral as a keyboard.
							uuid: "2a01",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0xc1, 0x03),
						},
					],
				},
				// Device Information Service: static manufacturer/model/firmware metadata.
				{
					uuid: "180a",
					characteristics: [
						{
							// Manufacturer Name String.
							uuid: "2a29",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(MANUFACTURER_NAME),
						},
						{
							// Model Number String.
							uuid: "2a24",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(MODEL_NUMBER),
						},
						{
							// Firmware Revision String.
							uuid: "2a26",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString("1.0.0"),
						},
						{
							// PnP ID: vendor/product metadata for hosts that inspect Device Information.
							uuid: "2a50",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0x02, 0xff, 0xff, 0x01, 0x00, 0x01, 0x00),
						},
					],
				},
				// Battery Service: lets hosts read the current battery percentage.
				{
					uuid: "180f",
					characteristics: [
						{
							// Battery Level: single byte percentage, 0-100.
							uuid: "2a19",
							properties: GATTServer.properties.read,
							onRead() {
								return Uint8Array.of(batteryLevel);
							},
						},
					],
				},
				// HID Service: keyboard report map, input/output reports, boot protocol, and control point.
				{
					uuid: "1812",
					characteristics: [
						{
							// HID Information: HID version, country code, and flags.
							uuid: "2a4a",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0x11, 0x01, 0x00, 0x03),
						},
						{
							// Report Map: HID descriptor that defines the keyboard report layout.
							uuid: "2a4b",
							properties: GATTServer.properties.read,
							value: keyboardReportMap,
						},
						{
							// HID Control Point: host suspend/resume signal.
							uuid: "2a4c",
							properties: GATTServer.properties.writeWithOutResponse,
							onWrite() {
								// HID Control Point: host may suspend/resume the device. This example keeps no power state.
							},
						},
						{
							// Protocol Mode: switches between report protocol and boot protocol.
							uuid: "2a4e",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return keyboard.#protocolMode;
							},
							onWrite(buffer: ArrayBuffer) {
								keyboard.#setProtocolMode(new Uint8Array(buffer)[0] ? PROTOCOL_MODE.REPORT : PROTOCOL_MODE.BOOT);
							},
						},
						// Keyboard Input Report: encrypted notify/read characteristic for key presses.
						keyboardInputReport,
						{
							// Keyboard Output Report: receives LED state such as Caps Lock from the host.
							uuid: "2a4d",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return keyboard.#outputReport;
							},
							onWrite(buffer: ArrayBuffer) {
								keyboard.#setOutputReport(buffer);
							},
							descriptors: [
								{
									// Report Reference: report ID 0, output report type.
									uuid: "2908",
									value: Uint8Array.of(0, 2),
								},
							],
						},
						// Boot Keyboard Input Report: BIOS/boot-compatible keyboard input path.
						bootKeyboardInputReport,
						{
							// Boot Keyboard Output Report: boot-protocol LED state from the host.
							uuid: "2a32",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return keyboard.#outputReport;
							},
							onWrite(buffer: ArrayBuffer) {
								keyboard.#setOutputReport(buffer);
							},
						},
					],
				},
			],
			onReady() {
				trace("[ble-keyboard/core] ready\n");
				keyboard.#startAdvertising(this, deviceName);
			},
			onConnect(connection: KeyboardConnection) {
				trace("[ble-keyboard/core] connected\n");
				connection.subscribedReports = [];
				keyboard.#connections.push(connection);
				keyboard.#emitConnectionChanged();
			},
			onDisconnect(connection: KeyboardConnection) {
				trace("[ble-keyboard/core] disconnected\n");
				keyboard.#clearReleaseTimer(connection);
				keyboard.#connections = keyboard.#connections.filter((item) => item !== connection);
				if (!keyboard.hasSubscribedHost()) {
					keyboard.#clearTextQueue(false);
				}
				if (keyboard.#connections.length === 0) {
					keyboard.#startAdvertising(this, deviceName);
				}
				keyboard.#emitConnectionChanged();
			},
			onSecured(_connection, state) {
				trace(`[ble-keyboard/core] secured encrypted=${state.encrypted} bonded=${state.bonded}\n`);
			},
			onWarning(message) {
				trace(`[ble-keyboard/core] BLE warning: ${message}\n`);
			},
		});
	}

	#startAdvertising(server: KeyboardServer, deviceName: string) {
		server.startAdvertising({
			// Advertising payload: discoverable BLE-only keyboard with service UUIDs, appearance, and local name.
			flags: AD_FLAG_GENERAL_DISCOVERABLE | AD_FLAG_BLE_ONLY,
			services: ["1812", "180f", "180a"],
			[AD_TYPE_APPEARANCE]: KEYBOARD_APPEARANCE,
			name: deviceName,
		});
	}

	notifyKey(options: KeyOptions): boolean {
		if (options.character !== undefined) {
			return this.notifyCharacter(options.character, options.modifiers);
		}
		if (options.keyCodes !== undefined) {
			return this.notifyKeyCodes(options.keyCodes, options.modifiers);
		}
		if (options.keyCode === undefined) return false;
		return this.notifyKeyCode(options.keyCode, options.modifiers);
	}

	notifyCharacter(character: string, modifiers = 0): boolean {
		const info = keyInfoForCharacter(character);
		if (!info) return false;
		return this.notifyKeyCode(info.keyCode, info.modifiers | modifiers);
	}

	notifyKeyCode(keyCode: KeyCode | number, modifiers = 0): boolean {
		return this.notifyKeyCodes([keyCode], modifiers);
	}

	notifyKeyCodes(keyCodes: (KeyCode | number)[], modifiers = 0): boolean {
		const report = this.#createKeyReport(keyCodes, modifiers);
		const notified = this.#sendReport(report);
		if (!notified) return false;
		this.#releaseSubscribedConnections();
		return notified;
	}

	typeText(text: string, options: TypeTextOptions = {}): boolean {
		if (!this.hasSubscribedHost()) return false;

		const reports: QueuedTextReport[] = [];
		const modifiers = options.modifiers ?? 0;
		const intervalMs = options.intervalMs ?? this.#releaseDelayMs;
		if (intervalMs < 0) {
			throw new RangeError("intervalMs must be 0 or greater.");
		}
		for (let i = 0; i < text.length; i++) {
			const info = keyInfoForCharacter(text[i]);
			if (!info) return false;
			reports.push({
				intervalMs,
				report: this.#createKeyReport([info.keyCode], info.modifiers | modifiers),
			});
		}

		if (reports.length === 0) {
			options.onComplete?.(true);
			return true;
		}

		reports[reports.length - 1].onComplete = options.onComplete;
		this.#textQueue.push(...reports);
		if (!this.#textTimer) {
			this.#sendNextTextReport();
		}
		return true;
	}

	pressKeyCode(keyCode: KeyCode | number, modifiers = 0): boolean {
		return this.pressKeyCodes([keyCode], modifiers);
	}

	pressKeyCodes(keyCodes: (KeyCode | number)[], modifiers = 0): boolean {
		return this.#sendReport(this.#createKeyReport(keyCodes, modifiers));
	}

	releaseAll(): boolean {
		this.#clearTextQueue(false);
		return this.#sendReport(emptyKeyboardReport);
	}

	isConnected(): boolean {
		return this.#connections.length > 0;
	}

	hasSubscribedHost(): boolean {
		for (const connection of this.#connections) {
			if ((connection.subscribedReports?.length ?? 0) > 0) return true;
		}
		return false;
	}

	getConnectionState(): ConnectionState {
		let subscribedReportCount = 0;
		for (const connection of this.#connections) {
			subscribedReportCount += connection.subscribedReports?.length ?? 0;
		}
		return {
			connected: this.isConnected(),
			connectionCount: this.#connections.length,
			protocolMode: this.#protocolMode[0] as ProtocolMode,
			subscribed: subscribedReportCount > 0,
			subscribedReportCount,
		};
	}

	getIndicators(): Indicator {
		return this.#outputReport[0];
	}

	hasIndicator(indicator: Indicator): boolean {
		return (this.#outputReport[0] & indicator) !== 0;
	}

	#createKeyReport(keyCodes: (KeyCode | number)[], modifiers: number): Uint8Array {
		if (keyCodes.length > 6) {
			throw new RangeError("A keyboard HID report can contain at most 6 key codes.");
		}

		const report = Uint8Array.of(modifiers & 0xff, 0, 0, 0, 0, 0, 0, 0);
		for (let i = 0; i < keyCodes.length; i++) {
			report[i + 2] = keyCodes[i] & 0xff;
		}
		return report;
	}

	#sendReport(report: Uint8Array): boolean {
		let notified = false;
		for (const connection of this.#connections) {
			if (this.#sendReportToConnection(connection, report)) {
				notified = true;
			}
		}
		return notified;
	}

	#sendReportToConnection(connection: KeyboardConnection, report: Uint8Array, clearReleaseTimer = true): boolean {
		const reportBuffer = report.buffer as ArrayBuffer;
		const reports = this.#subscribedReportsForConnection(connection);
		if (reports.length === 0) return false;

		if (clearReleaseTimer) {
			this.#clearReleaseTimer(connection);
		}

		let notified = false;
		for (const subscribedReport of reports) {
			this.#notify(connection, subscribedReport, reportBuffer);
			notified = true;
		}

		return notified;
	}

	#scheduleRelease(connection: KeyboardConnection) {
		connection.releaseTimer = Timer.set(() => {
			this.#sendReportToConnection(connection, emptyKeyboardReport, false);
			delete connection.releaseTimer;
		}, this.#releaseDelayMs);
	}

	#sendNextTextReport() {
		const item = this.#textQueue.shift();
		if (!item) {
			this.#activeTextReport = undefined;
			this.#textTimer = undefined;
			return;
		}

		this.#activeTextReport = item;
		const sent = this.#sendReport(item.report);
		if (!sent) {
			this.#activeTextReport = undefined;
			this.#clearTextQueue(false);
			item.onComplete?.(false);
			return;
		}

		this.#textTimer = Timer.set(() => {
			this.#sendReport(emptyKeyboardReport);
			item.onComplete?.(true);
			this.#activeTextReport = undefined;
			this.#textTimer = Timer.set(() => {
				this.#sendNextTextReport();
			}, item.intervalMs);
		}, this.#releaseDelayMs);
	}

	#clearTextQueue(sent: boolean) {
		if (this.#textTimer) {
			Timer.clear(this.#textTimer);
			this.#textTimer = undefined;
		}
		this.#activeTextReport?.onComplete?.(sent);
		this.#activeTextReport = undefined;
		for (const item of this.#textQueue) {
			item.onComplete?.(sent);
		}
		this.#textQueue.length = 0;
	}

	#subscribedReportsForConnection(connection: KeyboardConnection): KeyboardInputReportCharacteristic[] {
		const reports = connection.subscribedReports ?? [];
		const protocolMode = this.#protocolMode[0] as ProtocolMode;
		return reports.filter((report: KeyboardInputReportCharacteristic) => report.protocolMode === protocolMode);
	}

	#notify(connection: KeyboardConnection, characteristic: KeyboardInputReportCharacteristic, value: ArrayBuffer) {
		connection.notify(characteristic, value, (error?: Error) => {
			if (!error) return;
			trace(`[ble-keyboard/core] notify failed: ${error.message}\n`);
			this.onNotifyError?.(error);
		});
	}

	#setProtocolMode(protocolMode: ProtocolMode) {
		if (this.#protocolMode[0] === protocolMode) return;
		this.releaseAll();
		this.#protocolMode[0] = protocolMode;
		this.#emitConnectionChanged();
	}

	#emitConnectionChanged() {
		this.onConnectionChanged?.(this.getConnectionState());
	}

	#releaseSubscribedConnections() {
		for (const connection of this.#connections) {
			if (this.#subscribedReportsForConnection(connection).length === 0) continue;
			this.#scheduleRelease(connection);
		}
	}

	#setOutputReport(buffer: ArrayBuffer) {
		const nextIndicators = new Uint8Array(buffer)[0] ?? 0;
		if (this.#outputReport[0] === nextIndicators) return;
		this.#outputReport[0] = nextIndicators;
		this.onIndicatorsChanged?.(nextIndicators);
	}

	#createKeyboardInputReport(options: {
		uuid: string;
		logLabel: string;
		protocolMode: ProtocolMode;
		descriptors?: KeyboardDescriptor[];
	}) {
		const keyboard = this;
		return {
			uuid: options.uuid,
			protocolMode: options.protocolMode,
			properties: GATTServer.properties.readEncrypted | GATTServer.properties.subscribeEncrypted,
			onRead() {
				return emptyKeyboardReport;
			},
			onSubscribe(connection: KeyboardConnection) {
				keyboard.#addSubscribedReport(connection, this);
				trace(`${options.logLabel} subscribed\n`);
				keyboard.#emitConnectionChanged();
			},
			onUnsubscribe(characteristicOrConnection: KeyboardCharacteristic, connection?: KeyboardConnection) {
				const targetConnection = connection ?? (characteristicOrConnection as KeyboardConnection);
				keyboard.#removeSubscribedReport(targetConnection, this);
				trace(`${options.logLabel} unsubscribed\n`);
				if (!keyboard.hasSubscribedHost()) {
					keyboard.#clearTextQueue(false);
				}
				keyboard.#emitConnectionChanged();
			},
			descriptors: options.descriptors,
		};
	}

	#addSubscribedReport(connection: KeyboardConnection, characteristic: KeyboardInputReportCharacteristic) {
		connection.subscribedReports ??= [];
		if (connection.subscribedReports.indexOf(characteristic) < 0) {
			connection.subscribedReports.push(characteristic);
		}
	}

	#removeSubscribedReport(connection: KeyboardConnection, characteristic: KeyboardCharacteristic) {
		if (!connection.subscribedReports) return;
		connection.subscribedReports = connection.subscribedReports.filter(
			(item: KeyboardInputReportCharacteristic) => item !== characteristic,
		);
	}

	#clearReleaseTimer(connection: KeyboardConnection) {
		if (!connection.releaseTimer) return;
		Timer.clear(connection.releaseTimer);
		delete connection.releaseTimer;
	}
}

export {
	BLEKeyboard,
	INDICATOR,
	KEY_CODE,
	MODIFIER,
	PROTOCOL_MODE,
	type BLEKeyboardOptions,
	type ConnectionState,
	type Indicator,
	type KeyCode,
	type KeyOptions,
	type Modifier,
	type ProtocolMode,
	type TypeTextOptions,
};
