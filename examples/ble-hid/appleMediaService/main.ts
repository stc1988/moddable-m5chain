import { AppleMediaService, type PlaybackInfo, type TrackInfo } from "appleMediaService";
import M5ChainKey, { KEY_EVENT, KEY_MODE, type KeyEvent } from "m5chainKey";
import M5Chain from "m5chain";

import config from "mc/config";

const appleMediaService = new AppleMediaService({
	deviceName: "M5Chain AMS",
});

appleMediaService.onClientAuthenticated = () => {
	trace("[apple-media-service/main] authenticated with iOS host\n");
};

appleMediaService.onSupportedRemoteCommandsChanged = (commands: Uint8Array) => {
	trace(`[apple-media-service/main] supported commands: ${commands.toHex()}\n`);
};

appleMediaService.onPlaybackInfoChanged = (info: PlaybackInfo) => {
	trace(
		`[apple-media-service/main] playback state=${info.state} rate=${info.rate.toFixed(2)} elapsed=${info.elapsed.toFixed(1)}\n`,
	);
};

appleMediaService.onTrackChanged = (track: Required<TrackInfo>) => {
	trace(
		`[apple-media-service/main] track "${track.title}" by ${track.artist} from ${track.album}; duration=${track.duration.toFixed(1)}\n`,
	);
};

export async function main() {
	trace("[m5chain example] apple-media-service\n");

	appleMediaService.start();

	const m5chain = new M5Chain({
		transmit: config.m5chain.transmit,
		receive: config.m5chain.receive,
		debug: false,
	});

	m5chain.onDeviceListChanged = async (devices) => {
		trace(`[apple-media-service/main] device list changed: ${devices.length}\n`);

		for (const device of devices) {
			if (!(device instanceof M5ChainKey)) continue;

			await device.configure({ key: { mode: KEY_MODE.ACTIVE } });
			device.onPush = (keyEvent: KeyEvent) => {
				const action = mediaActionForKeyEvent(keyEvent);
				if (!action) return;

				if (appleMediaService.remoteCommand(action.command)) {
					trace(`[apple-media-service/main] key event ${keyEvent}; sent ${action.label}\n`);
				} else {
					trace(
						`[apple-media-service/main] key event ${keyEvent}; skipped ${action.label}: command unsupported or not connected\n`,
					);
				}
			};
			trace(`[apple-media-service/main] M5ChainKey ready: id=${device.id}\n`);
		}
	};

	await m5chain.start();
}

function mediaActionForKeyEvent(keyEvent: KeyEvent): { command: number; label: string } | undefined {
	switch (keyEvent) {
		case KEY_EVENT.SINGLE_CLICK:
			return { command: AppleMediaService.REMOTE_COMMAND_ID.TOGGLE_PLAY_PAUSE, label: "Toggle Play/Pause" };
		case KEY_EVENT.DOUBLE_CLICK:
			return { command: AppleMediaService.REMOTE_COMMAND_ID.NEXT_TRACK, label: "Next Track" };
		case KEY_EVENT.LONG_PRESS:
			return { command: AppleMediaService.REMOTE_COMMAND_ID.PREVIOUS_TRACK, label: "Previous Track" };
		default:
			return undefined;
	}
}

await main();
