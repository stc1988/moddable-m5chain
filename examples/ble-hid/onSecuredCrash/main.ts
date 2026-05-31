import { GATTServer } from "embedded:io/bluetoothle/peripheral";

const BATTERY_SERVICE_UUID = "180f";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2a19";

function startAdvertising(server: GATTServer) {
	server.startAdvertising({
		flags: 6,
		name: "SecCrash",
		services: [BATTERY_SERVICE_UUID],
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
		],
		onReady() {
			trace("[on-secured-crash] ready; advertising Battery Service\n");
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
