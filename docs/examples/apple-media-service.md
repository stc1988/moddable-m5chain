# Apple Media Service Example

`examples/ble-hid/appleMediaService` ports Moddable's `amsclient.js` flow to this repository's TypeScript examples using the ECMA-419 BLE modules:

- `embedded:io/bluetoothle/peripheral` advertises the AMS service solicitation.
- `embedded:io/bluetoothle/central` scans for the AMS service, connects, subscribes to notifications, and writes remote commands.

Unlike the BLE HID media-control example, this example uses Apple's Apple Media Service (AMS) to read playback and track metadata from an iOS host.

## Files

| File | Purpose |
| --- | --- |
| `examples/ble-hid/appleMediaService/appleMediaService.ts` | AMS authenticator, AMS client, constants, and `AppleMediaService` wrapper. |
| `examples/ble-hid/appleMediaService/main.ts` | Wires `M5Chain`, `M5ChainKey`, and `AppleMediaService` together. |
| `examples/ble-hid/appleMediaService/manifest.json` | Includes Moddable's ECMA-419 BLE central and peripheral manifests. |

## Controls

The example maps M5Chain Key events to AMS remote commands:

| Key event | AMS command |
| --- | --- |
| Single click | Toggle Play/Pause |
| Double click | Next Track |
| Long press | Previous Track |

`remoteCommand()` returns `false` when no AMS client is connected or the iOS host did not advertise support for the requested command.

## Callbacks

```ts
appleMediaService.onClientAuthenticated = () => {
	trace("authenticated\n");
};

appleMediaService.onPlaybackInfoChanged = (info) => {
	trace(`state=${info.state} elapsed=${info.elapsed}\n`);
};

appleMediaService.onTrackChanged = (track) => {
	trace(`${track.title} by ${track.artist}\n`);
};
```

## Build

```sh
mcconfig -d -m -p esp32/m5atom_matrix -t build ./examples/ble-hid/appleMediaService/manifest.json
```
