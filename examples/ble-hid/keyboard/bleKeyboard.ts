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

type KeyboardConnection = {
	close(): void;
	notify(characteristic: unknown, value: ArrayBuffer, callback?: (error?: Error) => void): void;
	replyToPasskey(action: "input" | "compareNumber" | "outOfBand", value: number | boolean | ArrayBuffer): void;
	readonly maxinumWrite: number;
	subscribedReports?: KeyboardCharacteristic[];
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
	character?: string;
	modifiers?: Modifier;
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
} as const;

type KeyCode = (typeof KEY_CODE)[keyof typeof KEY_CODE];

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
const emptyKeyboardReportBuffer = emptyKeyboardReport.buffer as ArrayBuffer;
const outputReport = Uint8Array.of(0);

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

	#connections: KeyboardConnection[] = [];
	#releaseDelayMs: number;
	#protocolMode = Uint8Array.of(1);

	constructor(options: BLEKeyboardOptions = {}) {
		const deviceName = options.deviceName ?? DEFAULT_DEVICE_NAME;
		const batteryLevel = options.batteryLevel ?? DEFAULT_BATTERY_LEVEL;
		this.#releaseDelayMs = options.releaseDelayMs ?? DEFAULT_RELEASE_DELAY_MS;

		const keyboard = this;
		const keyboardInputReport = this.#createKeyboardInputReport({
			uuid: "2a4d",
			logLabel: "[ble-keyboard/core] input report",
			descriptors: [
				{
					uuid: "2908",
					value: Uint8Array.of(0, 1),
				},
			],
		});
		const bootKeyboardInputReport = this.#createKeyboardInputReport({
			uuid: "2a22",
			logLabel: "[ble-keyboard/core] boot input report",
		});

		new GATTServer({
			mtu: 128,
			security: {
				bond: true,
				ioCapabilities: "none",
			},
			services: [
				{
					uuid: "1800",
					characteristics: [
						{
							uuid: "2a00",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(deviceName),
						},
						{
							uuid: "2a01",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0xc1, 0x03),
						},
					],
				},
				{
					uuid: "180a",
					characteristics: [
						{
							uuid: "2a29",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(MANUFACTURER_NAME),
						},
						{
							uuid: "2a24",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString(MODEL_NUMBER),
						},
						{
							uuid: "2a26",
							properties: GATTServer.properties.read,
							value: ArrayBuffer.fromString("1.0.0"),
						},
						{
							uuid: "2a50",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0x02, 0xff, 0xff, 0x01, 0x00, 0x01, 0x00),
						},
					],
				},
				{
					uuid: "180f",
					characteristics: [
						{
							uuid: "2a19",
							properties: GATTServer.properties.read,
							onRead() {
								return Uint8Array.of(batteryLevel);
							},
						},
					],
				},
				{
					uuid: "1812",
					characteristics: [
						{
							uuid: "2a4a",
							properties: GATTServer.properties.read,
							value: Uint8Array.of(0x11, 0x01, 0x00, 0x03),
						},
						{
							uuid: "2a4b",
							properties: GATTServer.properties.read,
							value: keyboardReportMap,
						},
						{
							uuid: "2a4c",
							properties: GATTServer.properties.writeWithOutResponse,
							onWrite() {
								// HID Control Point: host may suspend/resume the device. This example keeps no power state.
							},
						},
						{
							uuid: "2a4e",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return keyboard.#protocolMode;
							},
							onWrite(buffer: ArrayBuffer) {
								keyboard.#protocolMode[0] = new Uint8Array(buffer)[0] ? 1 : 0;
							},
						},
						keyboardInputReport,
						{
							uuid: "2a4d",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return outputReport;
							},
							onWrite(buffer: ArrayBuffer) {
								outputReport[0] = new Uint8Array(buffer)[0] ?? 0;
							},
							descriptors: [
								{
									uuid: "2908",
									value: Uint8Array.of(0, 2),
								},
							],
						},
						bootKeyboardInputReport,
						{
							uuid: "2a32",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return outputReport;
							},
							onWrite(buffer: ArrayBuffer) {
								outputReport[0] = new Uint8Array(buffer)[0] ?? 0;
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
			},
			onDisconnect(connection: KeyboardConnection) {
				trace("[ble-keyboard/core] disconnected\n");
				keyboard.#clearReleaseTimer(connection);
				keyboard.#connections = keyboard.#connections.filter((item) => item !== connection);
				if (keyboard.#connections.length === 0) {
					keyboard.#startAdvertising(this, deviceName);
				}
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
		if (options.keyCode === undefined) return false;
		return this.notifyKeyCode(options.keyCode, options.modifiers);
	}

	notifyCharacter(character: string, modifiers = 0): boolean {
		const info = keyInfoForCharacter(character);
		if (!info) return false;
		return this.notifyKeyCode(info.keyCode, info.modifiers | modifiers);
	}

	notifyKeyCode(keyCode: KeyCode | number, modifiers = 0): boolean {
		const report = Uint8Array.of(modifiers & 0xff, 0, keyCode, 0, 0, 0, 0, 0);
		const reportBuffer = report.buffer as ArrayBuffer;
		let notified = false;

		for (const connection of this.#connections) {
			const reports = connection.subscribedReports ?? [];
			if (reports.length === 0) continue;

			this.#clearReleaseTimer(connection);

			for (const subscribedReport of reports) {
				connection.notify(subscribedReport, reportBuffer);
				notified = true;
			}

			connection.releaseTimer = Timer.set(() => {
				for (const subscribedReport of reports) {
					connection.notify(subscribedReport, emptyKeyboardReportBuffer);
				}
				delete connection.releaseTimer;
			}, this.#releaseDelayMs);
		}

		return notified;
	}

	#createKeyboardInputReport(options: { uuid: string; logLabel: string; descriptors?: KeyboardDescriptor[] }) {
		const keyboard = this;
		return {
			uuid: options.uuid,
			properties: GATTServer.properties.readEncrypted | GATTServer.properties.subscribeEncrypted,
			onRead() {
				return emptyKeyboardReport;
			},
			onSubscribe(connection: KeyboardConnection) {
				keyboard.#addSubscribedReport(connection, this);
				trace(`${options.logLabel} subscribed\n`);
			},
			onUnsubscribe(characteristicOrConnection: KeyboardCharacteristic, connection?: KeyboardConnection) {
				const targetConnection = connection ?? (characteristicOrConnection as KeyboardConnection);
				keyboard.#removeSubscribedReport(targetConnection, this);
				trace(`${options.logLabel} unsubscribed\n`);
			},
			descriptors: options.descriptors,
		};
	}

	#addSubscribedReport(connection: KeyboardConnection, characteristic: KeyboardCharacteristic) {
		connection.subscribedReports ??= [];
		if (connection.subscribedReports.indexOf(characteristic) < 0) {
			connection.subscribedReports.push(characteristic);
		}
	}

	#removeSubscribedReport(connection: KeyboardConnection, characteristic: KeyboardCharacteristic) {
		if (!connection.subscribedReports) return;
		connection.subscribedReports = connection.subscribedReports.filter(
			(item: KeyboardCharacteristic) => item !== characteristic,
		);
	}

	#clearReleaseTimer(connection: KeyboardConnection) {
		if (!connection.releaseTimer) return;
		Timer.clear(connection.releaseTimer);
		delete connection.releaseTimer;
	}
}

export { BLEKeyboard, KEY_CODE, MODIFIER, type BLEKeyboardOptions, type KeyCode, type KeyOptions, type Modifier };
