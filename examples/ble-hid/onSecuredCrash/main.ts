import { GATTServer } from "embedded:io/bluetoothle/peripheral";

const AD_TYPE_SOLICIT_UUID128 = 0x15;
const AMS_SOLICIT_UUID128 = Uint8Array.of(
	0xdc,
	0xf8,
	0x55,
	0xad,
	0x02,
	0xc5,
	0xf4,
	0x8e,
	0x3a,
	0x43,
	0x36,
	0x0f,
	0x2b,
	0x50,
	0xd3,
	0x89,
);

function startAdvertising(server: GATTServer) {
	server.startAdvertising({
		flags: 6,
		name: "SecCrash",
		[AD_TYPE_SOLICIT_UUID128]: AMS_SOLICIT_UUID128,
	});
}

export async function main() {
	trace("[on-secured-crash] start\n");

	new GATTServer({
		security: {
			bond: true,
			ioCapabilities: "none",
		},
		services: [],
		onReady() {
			trace("[on-secured-crash] ready; advertising AMS solicitation\n");
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
