import { GAPClient, GATTClient } from "embedded:io/bluetoothle/central";
import { GATTServer } from "embedded:io/bluetoothle/peripheral";

const AMS_SERVICE_UUID = "89d3502b-0f36-433a-8ef4-c502ad55f8dc";
const REMOTE_COMMAND_CHARACTERISTIC_UUID = "9b3c81d8-57b1-4a8a-b8df-0e56f7ca51c2";
const ENTITY_UPDATE_CHARACTERISTIC_UUID = "2f7cabce-808d-411f-9a0c-bb92ba96c102";
const ENTITY_ATTRIBUTE_CHARACTERISTIC_UUID = "c6b2f38c-23ab-46d8-a6ab-a3a870bbd5d7";

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

const ENTITY_ID = {
	PLAYER: 0,
	QUEUE: 1,
	TRACK: 2,
} as const;
Object.freeze(ENTITY_ID);

const ENTITY_UPDATE_FLAGS = {
	TRUNCATED: 1 << 0,
} as const;
Object.freeze(ENTITY_UPDATE_FLAGS);

const TRACK_ATTRIBUTE_ID = {
	ARTIST: 0,
	ALBUM: 1,
	TITLE: 2,
	DURATION: 3,
} as const;
Object.freeze(TRACK_ATTRIBUTE_ID);

const PLAYER_ATTRIBUTE_ID = {
	NAME: 0,
	PLAYBACK_INFO: 1,
	VOLUME: 2,
} as const;
Object.freeze(PLAYER_ATTRIBUTE_ID);

const REMOTE_COMMAND_ID = {
	PLAY: 0,
	PAUSE: 1,
	TOGGLE_PLAY_PAUSE: 2,
	NEXT_TRACK: 3,
	PREVIOUS_TRACK: 4,
	VOLUME_UP: 5,
	VOLUME_DOWN: 6,
	ADVANCE_REPEAT_MODE: 7,
	ADVANCE_SHUFFLE_MODE: 8,
	SKIP_FORWARD: 9,
	SKIP_BACKWARD: 10,
	LIKE_TRACK: 11,
	DISLIKE_TRACK: 12,
	BOOKMARK_TRACK: 13,
} as const;
Object.freeze(REMOTE_COMMAND_ID);

const PLAYBACK_STATE = {
	PAUSED: 0,
	PLAYING: 1,
	REWINDING: 2,
	FAST_FORWARDING: 3,
} as const;
Object.freeze(PLAYBACK_STATE);

const QUEUE_ATTRIBUTE_ID = {
	INDEX: 0,
	COUNT: 1,
	SHUFFLE_MODE: 2,
	REPEAT_MODE: 3,
} as const;
Object.freeze(QUEUE_ATTRIBUTE_ID);

const SHUFFLE_MODE = {
	OFF: 0,
	ONE: 1,
	ALL: 2,
} as const;
Object.freeze(SHUFFLE_MODE);

const REPEAT_MODE = {
	OFF: 0,
	ONE: 1,
	ALL: 2,
} as const;
Object.freeze(REPEAT_MODE);

type EntityID = (typeof ENTITY_ID)[keyof typeof ENTITY_ID];
type EntityUpdateFlags = (typeof ENTITY_UPDATE_FLAGS)[keyof typeof ENTITY_UPDATE_FLAGS] | number;
type TrackAttributeID = (typeof TRACK_ATTRIBUTE_ID)[keyof typeof TRACK_ATTRIBUTE_ID];
type PlayerAttributeID = (typeof PLAYER_ATTRIBUTE_ID)[keyof typeof PLAYER_ATTRIBUTE_ID];
type RemoteCommandID = (typeof REMOTE_COMMAND_ID)[keyof typeof REMOTE_COMMAND_ID] | number;
type PlaybackState = (typeof PLAYBACK_STATE)[keyof typeof PLAYBACK_STATE];
type QueueAttributeID = (typeof QUEUE_ATTRIBUTE_ID)[keyof typeof QUEUE_ATTRIBUTE_ID];
type ShuffleMode = (typeof SHUFFLE_MODE)[keyof typeof SHUFFLE_MODE];
type RepeatMode = (typeof REPEAT_MODE)[keyof typeof REPEAT_MODE];

type ByteArray = Uint8Array<ArrayBufferLike>;

type GATTClientService = ReturnType<GATTClient["getPrimaryServices"]> extends void ? { uuid: string } : never;
type GATTClientCharacteristic = {
	readonly uuid: string;
	readonly handle: number;
	readonly properties: number;
};

type TrackInfo = {
	album?: string;
	artist?: string;
	duration?: number;
	title?: string;
};

type PlaybackInfo = {
	elapsed: number;
	rate: number;
	state: PlaybackState | number;
};

type AppleMediaServiceOptions = {
	deviceName?: string;
};

type AMSAuthenticatorDelegate = {
	onAuthenticated(): void;
};

class AMSAuthenticator {
	#delegate: AMSAuthenticatorDelegate;
	#deviceName: string;
	#server: GATTServer;

	constructor(delegate: AMSAuthenticatorDelegate, options: AppleMediaServiceOptions = {}) {
		this.#delegate = delegate;
		this.#deviceName = options.deviceName ?? "M5Chain AMS";

		const authenticator = this;
		this.#server = new GATTServer({
			security: {
				bond: true,
				ioCapabilities: "none",
			},
			services: [],
			onReady() {
				authenticator.#startAdvertising(this);
			},
			onConnect() {
				trace("[apple-media-service/auth] connected\n");
				this.stopAdvertising();
			},
			onDisconnect() {
				trace("[apple-media-service/auth] disconnected\n");
				authenticator.#startAdvertising(this);
			},
			onSecured(_connection, state) {
				trace(
					`[apple-media-service/auth] secured encrypted=${state.encrypted} authenticated=${state.authenticated} bonded=${state.bonded}\n`,
				);
				authenticator.#delegate.onAuthenticated();
			},
			onWarning(message) {
				trace(`[apple-media-service/auth] BLE warning: ${message}\n`);
			},
		});
	}

	close() {
		this.#server.close?.();
	}

	#startAdvertising(server: GATTServer) {
		server.startAdvertising(
			{
				flags: 6,
				[AD_TYPE_SOLICIT_UUID128]: AMS_SOLICIT_UUID128,
			},
			{
				name: this.#deviceName,
			},
		);
	}
}
Object.freeze(AMSAuthenticator.prototype);

class AMSClient {
	#address: string;
	#gatt?: GATTClient;
	#remoteCommandCharacteristic?: GATTClientCharacteristic;
	#entityUpdateCharacteristic?: GATTClientCharacteristic;
	#supportedRemoteCommands: ByteArray = new Uint8Array();
	#nextTrack: TrackInfo = {};

	constructor(address: string) {
		this.#address = address;
		this.#connect();
	}

	close() {
		this.#gatt?.close();
		this.#gatt = undefined;
	}

	remoteCommand(command: RemoteCommandID): boolean {
		if (!this.#gatt || !this.#remoteCommandCharacteristic) return false;
		if (!this.#supportedRemoteCommands.includes(command)) return false;

		this.#gatt.write(this.#remoteCommandCharacteristic, Uint8Array.of(command), { response: false });
		return true;
	}

	onDisconnected() {}

	onEntityUpdated(
		_entityID: EntityID,
		_attributeID: TrackAttributeID | PlayerAttributeID,
		_flags: EntityUpdateFlags,
		_value: string,
	) {}

	onPlaybackInfoChanged(_info: PlaybackInfo) {}

	onSupportedRemoteCommandsChanged(_commands: ByteArray) {}

	onTrackChanged(_track: Required<TrackInfo>) {}

	#connect() {
		const client = this;

		this.#gatt = new GATTClient({
			address: this.#address,
			security: {
				bond: true,
				ioCapabilities: "none",
				immediate: true,
			},
			onReady() {
				trace(`[apple-media-service/client] connected ${client.#address}\n`);
			},
			onSecured(state) {
				trace(
					`[apple-media-service/client] secured encrypted=${state.encrypted} authenticated=${state.authenticated} bonded=${state.bonded}\n`,
				);
				client.#discover(this);
			},
			onReadable(count) {
				while (count--) {
					const value = this.read();
					if (!value) continue;
					client.#handleNotification(value);
				}
			},
			onError(error) {
				trace(`[apple-media-service/client] error: ${error}\n`);
				client.onDisconnected();
			},
		});
	}

	#discover(gatt: GATTClient) {
		gatt.getPrimaryServices([AMS_SERVICE_UUID], (serviceError, services) => {
			if (serviceError || services.length === 0) {
				trace(`[apple-media-service/client] AMS service not found: ${serviceError ?? "empty"}\n`);
				return;
			}

			gatt.getCharacteristics(
				services[0] as GATTClientService,
				[REMOTE_COMMAND_CHARACTERISTIC_UUID, ENTITY_UPDATE_CHARACTERISTIC_UUID, ENTITY_ATTRIBUTE_CHARACTERISTIC_UUID],
				(characteristicError, characteristics) => {
					if (characteristicError) {
						trace(`[apple-media-service/client] characteristic discovery failed: ${characteristicError}\n`);
						return;
					}

					for (const characteristic of characteristics as GATTClientCharacteristic[]) {
						if (sameUUID(characteristic.uuid, REMOTE_COMMAND_CHARACTERISTIC_UUID)) {
							this.#remoteCommandCharacteristic = characteristic;
						} else if (sameUUID(characteristic.uuid, ENTITY_UPDATE_CHARACTERISTIC_UUID)) {
							this.#entityUpdateCharacteristic = characteristic;
						}
					}

					this.#subscribeRemoteCommands(gatt);
				},
			);
		});
	}

	#subscribeRemoteCommands(gatt: GATTClient) {
		if (!this.#remoteCommandCharacteristic) {
			trace("[apple-media-service/client] remote command characteristic not found\n");
			return;
		}

		gatt.subscribe(this.#remoteCommandCharacteristic, (error) => {
			if (error) {
				trace(`[apple-media-service/client] remote command subscribe failed: ${error}\n`);
				return;
			}
			this.#subscribeEntityUpdates(gatt);
		});
	}

	#subscribeEntityUpdates(gatt: GATTClient) {
		const entityUpdateCharacteristic = this.#entityUpdateCharacteristic;
		if (!entityUpdateCharacteristic) {
			trace("[apple-media-service/client] entity update characteristic not found\n");
			return;
		}

		gatt.subscribe(entityUpdateCharacteristic, (error) => {
			if (error) {
				trace(`[apple-media-service/client] entity update subscribe failed: ${error}\n`);
				return;
			}

			gatt.write(
				entityUpdateCharacteristic,
				Uint8Array.of(
					ENTITY_ID.TRACK,
					TRACK_ATTRIBUTE_ID.ARTIST,
					TRACK_ATTRIBUTE_ID.ALBUM,
					TRACK_ATTRIBUTE_ID.TITLE,
					TRACK_ATTRIBUTE_ID.DURATION,
				),
				{ response: false },
			);
			gatt.write(entityUpdateCharacteristic, Uint8Array.of(ENTITY_ID.PLAYER, PLAYER_ATTRIBUTE_ID.PLAYBACK_INFO), {
				response: false,
			});
		});
	}

	#handleNotification(value: ArrayBuffer & { handle?: number }) {
		if (value.handle === this.#remoteCommandCharacteristic?.handle) {
			this.#supportedRemoteCommands = new Uint8Array(value);
			this.onSupportedRemoteCommandsChanged(this.#supportedRemoteCommands);
			return;
		}

		if (value.handle !== this.#entityUpdateCharacteristic?.handle) return;

		const entityUpdate = new Uint8Array(value);
		const entityID = entityUpdate[0] as EntityID;
		const attributeID = entityUpdate[1] as TrackAttributeID | PlayerAttributeID;
		const flags = entityUpdate[2] as EntityUpdateFlags;
		const updateValue = String.fromArrayBuffer(value.slice(3));

		this.onEntityUpdated(entityID, attributeID, flags, updateValue);

		if (ENTITY_ID.TRACK === entityID) {
			this.#updateTrack(attributeID as TrackAttributeID, updateValue, flags);
		} else if (ENTITY_ID.PLAYER === entityID && PLAYER_ATTRIBUTE_ID.PLAYBACK_INFO === attributeID) {
			this.#updatePlaybackInfo(updateValue);
		}
	}

	#updateTrack(attributeID: TrackAttributeID, value: string, flags: EntityUpdateFlags) {
		if (flags & ENTITY_UPDATE_FLAGS.TRUNCATED) return;

		if (TRACK_ATTRIBUTE_ID.ARTIST === attributeID) this.#nextTrack.artist = value;
		else if (TRACK_ATTRIBUTE_ID.ALBUM === attributeID) this.#nextTrack.album = value;
		else if (TRACK_ATTRIBUTE_ID.TITLE === attributeID) this.#nextTrack.title = value;
		else if (TRACK_ATTRIBUTE_ID.DURATION === attributeID) this.#nextTrack.duration = parseFloat(value);

		const track = this.#nextTrack;
		if (
			track.artist !== undefined &&
			track.album !== undefined &&
			track.title !== undefined &&
			track.duration !== undefined
		) {
			this.onTrackChanged(track as Required<TrackInfo>);
			this.#nextTrack = {};
		}
	}

	#updatePlaybackInfo(value: string) {
		const parts = value.split(",");
		this.onPlaybackInfoChanged({
			state: parseInt(parts[0], 10),
			rate: parseFloat(parts[1]),
			elapsed: parseFloat(parts[2]),
		});
	}
}
Object.freeze(AMSClient.prototype);

class AppleMediaService implements AMSAuthenticatorDelegate {
	static REMOTE_COMMAND_ID = REMOTE_COMMAND_ID;
	static PLAYBACK_STATE = PLAYBACK_STATE;

	#authenticator?: AMSAuthenticator;
	#client?: AMSClient;
	#scanner?: GAPClient;
	#options: AppleMediaServiceOptions;

	onClientAuthenticated: ((client: AMSClient) => void) | null = null;
	onPlaybackInfoChanged: ((info: PlaybackInfo) => void) | null = null;
	onSupportedRemoteCommandsChanged: ((commands: ByteArray) => void) | null = null;
	onTrackChanged: ((track: Required<TrackInfo>) => void) | null = null;

	constructor(options: AppleMediaServiceOptions = {}) {
		this.#options = options;
	}

	start() {
		if (this.#authenticator) return;
		this.#authenticator = new AMSAuthenticator(this, this.#options);
	}

	isStarted(): boolean {
		return this.#authenticator !== undefined;
	}

	remoteCommand(command: RemoteCommandID): boolean {
		return this.#client?.remoteCommand(command) ?? false;
	}

	onAuthenticated() {
		this.#startScanning();
	}

	#startScanning() {
		if (this.#client || this.#scanner) return;

		const service = this;
		this.#scanner = new GAPClient({
			services: [AMS_SERVICE_UUID],
			onReadable() {
				const advertisement = this.read();
				this.close();
				service.#scanner = undefined;
				service.#client = service.#createClient(advertisement.address);
				service.onClientAuthenticated?.(service.#client);
			},
			onError(error) {
				trace(`[apple-media-service/scan] failed: ${error}\n`);
				service.#scanner = undefined;
			},
		});
	}

	#createClient(address: string) {
		const service = this;

		return new (class extends AMSClient {
			onDisconnected() {
				service.#client = undefined;
			}

			onPlaybackInfoChanged(info: PlaybackInfo) {
				service.onPlaybackInfoChanged?.(info);
			}

			onSupportedRemoteCommandsChanged(commands: ByteArray) {
				service.onSupportedRemoteCommandsChanged?.(commands);
			}

			onTrackChanged(track: Required<TrackInfo>) {
				service.onTrackChanged?.(track);
			}
		})(address);
	}
}
Object.freeze(AppleMediaService.prototype);

function sameUUID(a: string, b: string): boolean {
	return a.toLowerCase() === b;
}

export {
	AMSAuthenticator,
	AMSClient,
	AppleMediaService,
	ENTITY_ID,
	ENTITY_UPDATE_FLAGS,
	PLAYBACK_STATE,
	PLAYER_ATTRIBUTE_ID,
	QUEUE_ATTRIBUTE_ID,
	REMOTE_COMMAND_ID,
	REPEAT_MODE,
	SHUFFLE_MODE,
	TRACK_ATTRIBUTE_ID,
	type AppleMediaServiceOptions,
	type EntityID,
	type EntityUpdateFlags,
	type PlaybackInfo,
	type PlaybackState,
	type PlayerAttributeID,
	type QueueAttributeID,
	type RemoteCommandID,
	type RepeatMode,
	type ShuffleMode,
	type TrackAttributeID,
	type TrackInfo,
};
