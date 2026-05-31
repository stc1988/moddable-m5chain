import { GATTServer } from "embedded:io/bluetoothle/peripheral";

const BATTERY_SERVICE_UUID = "180f";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2a19";
const DEVICE_NAME = "SecCrashHRM";
const HEART_RATE_SERVICE_UUID = "180d";
const HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID = "2a37";

function startAdvertising(server: GATTServer) {
	server.startAdvertising({
		flags: 6,
		name: DEVICE_NAME,
		manufacturerData: {
			manufacturer: 1,
			data: Uint8Array.of(0xff, 0x00, 0x01),
		},
		services: [HEART_RATE_SERVICE_UUID, BATTERY_SERVICE_UUID],
	});
}

export async function main() {
	trace("[on-secured-crash] start\n");

	new GATTServer({
		security: {
			bond: true,
			ioCapabilities: "none",
			immediate: true,
		},
		services: [
			{
				uuid: "1800",
				characteristics: [
					{
						uuid: "2a00",
						properties: GATTServer.properties.read,
						value: ArrayBuffer.fromString(DEVICE_NAME),
					},
					{
						uuid: "2a01",
						properties: GATTServer.properties.read,
						value: Uint8Array.of(0x40, 0x03),
					},
				],
			},
			{
				uuid: BATTERY_SERVICE_UUID,
				characteristics: [
					{
						uuid: BATTERY_LEVEL_CHARACTERISTIC_UUID,
						properties: GATTServer.properties.readEncrypted,
						onRead() {
							trace("[on-secured-crash] battery level read\n");
							return Uint8Array.of(100);
						},
					},
				],
			},
			{
				uuid: HEART_RATE_SERVICE_UUID,
				characteristics: [
					{
						uuid: HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
						properties: GATTServer.properties.read,
						onRead() {
							return Uint8Array.of(0, 65);
						},
					},
				],
			},
		],
		onReady() {
			trace("[on-secured-crash] ready; advertising Heart Rate and Battery services\n");
			startAdvertising(this);
		},
		onConnect() {
			trace("[on-secured-crash] connected\n");
			this.stopAdvertising();
		},
		onDisconnect() {
			trace("[on-secured-crash] disconnected\n");
			startAdvertising(this);
		},
		onSecured(_connection, state) {
			trace(
				`[on-secured-crash] secured encrypted=${state.encrypted} authenticated=${state.authenticated} bonded=${state.bonded}\n`,
			);
		},
		onWarning(message) {
			trace(`[on-secured-crash] BLE warning: ${message}\n`);
		},
	});
}

await main();
