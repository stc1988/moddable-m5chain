import { GATTServer } from "embedded:io/bluetoothle/peripheral";
import Timer from "timer";

const DEFAULT_DEVICE_NAME = "BLE Media Control";
const MANUFACTURER_NAME = "M5Stack";
const MODEL_NUMBER = "M5Chain Media Control";
const DEFAULT_RELEASE_DELAY_MS = 20;
const DEFAULT_BATTERY_LEVEL = 100;
const AD_FLAG_GENERAL_DISCOVERABLE = 0x02;
const AD_FLAG_BLE_ONLY = 0x04;
const AD_TYPE_APPEARANCE = 0x19;
const KEYBOARD_APPEARANCE = Uint8Array.of(0xc1, 0x03);

type MediaControlCharacteristic = object;

type MediaControlConnection = {
	close(): void;
	notify(characteristic: unknown, value: ArrayBuffer, callback?: (error?: Error) => void): void;
	replyToPasskey(action: "input" | "compareNumber" | "outOfBand", value: number | boolean | ArrayBuffer): void;
	readonly maxinumWrite: number;
	subscribedKeyboardReports?: MediaControlCharacteristic[];
	subscribedMediaReports?: MediaControlCharacteristic[];
	releaseTimer?: ReturnType<typeof Timer.set>;
};

type MediaControlServer = {
	startAdvertising(scan: object, response?: object): void;
};

type BLEMediaControlOptions = {
	deviceName?: string;
	releaseDelayMs?: number;
	batteryLevel?: number;
};

const USAGE = {
	PLAY_PAUSE: 0x00cd,
	SCAN_NEXT_TRACK: 0x00b5,
	SCAN_PREVIOUS_TRACK: 0x00b6,
	STOP: 0x00b7,
	VOLUME_UP: 0x00e9,
	VOLUME_DOWN: 0x00ea,
	MUTE: 0x00e2,
} as const;

type ConsumerControlUsage = (typeof USAGE)[keyof typeof USAGE] | number;

const mediaControlReportMap = Uint8Array.of(
	0x05,
	0x01, // Usage Page (Generic Desktop)
	0x09,
	0x06, // Usage (Keyboard)
	0xa1,
	0x01, // Collection (Application)
	0x85,
	0x01, // Report ID (1)
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
	0x05,
	0x0c, // Usage Page (Consumer)
	0x09,
	0x01, // Usage (Consumer Control)
	0xa1,
	0x01, // Collection (Application)
	0x85,
	0x02, // Report ID (2)
	0x05,
	0x0c, // Usage Page (Consumer)
	0x15,
	0x00, // Logical Minimum (0)
	0x25,
	0x01, // Logical Maximum (1)
	0x75,
	0x01, // Report Size (1)
	0x95,
	0x08, // Report Count (8)
	0x09,
	0xe9, // Usage (Volume Increment)
	0x09,
	0xea, // Usage (Volume Decrement)
	0x09,
	0xe2, // Usage (Mute)
	0x09,
	0xb6, // Usage (Scan Previous Track)
	0x09,
	0xb5, // Usage (Scan Next Track)
	0x09,
	0xb0, // Usage (Play)
	0x09,
	0xcd, // Usage (Play/Pause)
	0x09,
	0xb9, // Usage (Random Play)
	0x81,
	0x02, // Input (Data, Variable, Absolute)
	0xc0, // End Collection
);

const MEDIA_REPORT_MASK: Record<number, number> = {
	[USAGE.VOLUME_UP]: 0b00000001,
	[USAGE.VOLUME_DOWN]: 0b00000010,
	[USAGE.MUTE]: 0b00000100,
	[USAGE.SCAN_PREVIOUS_TRACK]: 0b00001000,
	[USAGE.SCAN_NEXT_TRACK]: 0b00010000,
	[USAGE.PLAY_PAUSE]: 0b01000000,
};

const emptyKeyboardReport = Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0);
const emptyMediaControlReport = Uint8Array.of(0);
const emptyMediaControlReportBuffer = emptyMediaControlReport.buffer as ArrayBuffer;

const emptyOutputReport = Uint8Array.of(0);

class BLEMediaControl {
	static USAGE = USAGE;

	#connections: MediaControlConnection[] = [];
	#releaseDelayMs: number;
	#protocolMode = Uint8Array.of(1);

	constructor(options: BLEMediaControlOptions = {}) {
		const deviceName = options.deviceName ?? DEFAULT_DEVICE_NAME;
		const batteryLevel = options.batteryLevel ?? DEFAULT_BATTERY_LEVEL;
		this.#releaseDelayMs = options.releaseDelayMs ?? DEFAULT_RELEASE_DELAY_MS;

		const mediaControl = this;
		const keyboardInputReport = this.#createInputReport({
			reportId: 1,
			logLabel: "[ble-media-control/core] keyboard input report",
			emptyReport: emptyKeyboardReport,
			subscriptionProperty: "subscribedKeyboardReports",
		});
		const mediaInputReport = this.#createInputReport({
			reportId: 2,
			logLabel: "[ble-media-control/core] media input report",
			emptyReport: emptyMediaControlReport,
			subscriptionProperty: "subscribedMediaReports",
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
							value: KEYBOARD_APPEARANCE,
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
							value: Uint8Array.of(0x0b, 0x01, 0x00, 0x15),
						},
						{
							uuid: "2a4b",
							properties: GATTServer.properties.read,
							value: mediaControlReportMap,
						},
						{
							uuid: "2a4c",
							properties: GATTServer.properties.readEncrypted | GATTServer.properties.writeEncrypted,
							onRead() {
								return Uint8Array.of(0, 0);
							},
							onWrite() {
								// HID Control Point: host may suspend/resume the device. This example keeps no power state.
							},
						},
						{
							uuid: "2a4e",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return mediaControl.#protocolMode;
							},
							onWrite(buffer: ArrayBuffer) {
								mediaControl.#protocolMode[0] = new Uint8Array(buffer)[0] ? 1 : 0;
							},
						},
						keyboardInputReport,
						{
							uuid: "2a4d",
							properties: GATTServer.properties.read | GATTServer.properties.writeWithOutResponse,
							onRead() {
								return emptyOutputReport;
							},
							onWrite(buffer: ArrayBuffer) {
								emptyOutputReport[0] = new Uint8Array(buffer)[0] ?? 0;
							},
							descriptors: [
								{
									uuid: "2908",
									value: Uint8Array.of(1, 2),
								},
							],
						},
						mediaInputReport,
					],
				},
			],
			onReady() {
				trace("[ble-media-control/core] ready\n");
				mediaControl.#startAdvertising(this, deviceName);
			},
			onConnect(connection: MediaControlConnection) {
				trace("[ble-media-control/core] connected\n");
				connection.subscribedKeyboardReports = [];
				connection.subscribedMediaReports = [];
				mediaControl.#connections.push(connection);
			},
			onDisconnect(connection: MediaControlConnection) {
				trace("[ble-media-control/core] disconnected\n");
				mediaControl.#clearReleaseTimer(connection);
				mediaControl.#connections = mediaControl.#connections.filter((item) => item !== connection);
				if (mediaControl.#connections.length === 0) {
					mediaControl.#startAdvertising(this, deviceName);
				}
			},
			onSecured(_connection, state) {
				trace(`[ble-media-control/core] secured encrypted=${state.encrypted} bonded=${state.bonded}\n`);
			},
			onWarning(message) {
				trace(`[ble-media-control/core] BLE warning: ${message}\n`);
			},
		});
	}

	#startAdvertising(server: MediaControlServer, deviceName: string) {
		server.startAdvertising(
			{
				flags: AD_FLAG_GENERAL_DISCOVERABLE | AD_FLAG_BLE_ONLY,
				services: ["1812"],
				[AD_TYPE_APPEARANCE]: KEYBOARD_APPEARANCE,
			},
			{
				name: deviceName,
			},
		);
	}

	notifyUsage(usage: ConsumerControlUsage): boolean {
		const mask = MEDIA_REPORT_MASK[usage];
		if (mask === undefined) return false;
		const report = Uint8Array.of(mask);
		const reportBuffer = report.buffer as ArrayBuffer;
		let notified = false;

		for (const connection of this.#connections) {
			const reports = connection.subscribedMediaReports ?? [];
			if (reports.length === 0) continue;

			this.#clearReleaseTimer(connection);

			for (const subscribedReport of reports) {
				connection.notify(subscribedReport, reportBuffer);
				notified = true;
			}

			connection.releaseTimer = Timer.set(() => {
				for (const subscribedReport of reports) {
					connection.notify(subscribedReport, emptyMediaControlReportBuffer);
				}
				delete connection.releaseTimer;
			}, this.#releaseDelayMs);
		}

		return notified;
	}

	#createInputReport(options: {
		reportId: number;
		logLabel: string;
		emptyReport: Uint8Array;
		subscriptionProperty: "subscribedKeyboardReports" | "subscribedMediaReports";
	}) {
		const mediaControl = this;
		return {
			uuid: "2a4d",
			properties: GATTServer.properties.readEncrypted | GATTServer.properties.subscribeEncrypted,
			onRead() {
				return options.emptyReport;
			},
			onSubscribe(connection: MediaControlConnection) {
				mediaControl.#addSubscribedReport(connection, this, options.subscriptionProperty);
				trace(`${options.logLabel} subscribed\n`);
			},
			onUnsubscribe(characteristicOrConnection: MediaControlCharacteristic, connection?: MediaControlConnection) {
				const targetConnection = connection ?? (characteristicOrConnection as MediaControlConnection);
				mediaControl.#removeSubscribedReport(targetConnection, this, options.subscriptionProperty);
				trace(`${options.logLabel} unsubscribed\n`);
			},
			descriptors: [
				{
					uuid: "2908",
					value: Uint8Array.of(options.reportId, 1),
				},
			],
		};
	}

	#addSubscribedReport(
		connection: MediaControlConnection,
		characteristic: MediaControlCharacteristic,
		property: "subscribedKeyboardReports" | "subscribedMediaReports",
	) {
		connection[property] ??= [];
		if (connection[property].indexOf(characteristic) < 0) {
			connection[property].push(characteristic);
		}
	}

	#removeSubscribedReport(
		connection: MediaControlConnection,
		characteristic: MediaControlCharacteristic,
		property: "subscribedKeyboardReports" | "subscribedMediaReports",
	) {
		if (!connection[property]) return;
		connection[property] = connection[property].filter((item: MediaControlCharacteristic) => item !== characteristic);
	}

	#clearReleaseTimer(connection: MediaControlConnection) {
		if (!connection.releaseTimer) return;
		Timer.clear(connection.releaseTimer);
		delete connection.releaseTimer;
	}
}

export { BLEMediaControl, USAGE, type BLEMediaControlOptions, type ConsumerControlUsage };
