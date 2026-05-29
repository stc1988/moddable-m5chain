# BLE HID Media Control Example

`examples/ble-hid/mediaControl` turns an M5Chain Key device into a BLE HID media control peripheral. The host sees the device as a Bluetooth HID device, and key events from the M5Chain Key can send Consumer Control reports such as Play/Pause, Next Track, and Previous Track.

Use this example for media keys. Volume, play/pause, next track, previous track, and similar controls are HID Consumer Control usages, not keyboard key codes.

## Files

| File | Purpose |
| --- | --- |
| `examples/ble-hid/mediaControl/main.ts` | Wires `M5Chain`, `M5ChainKey`, and `BLEMediaControl` together. |
| `examples/ble-hid/mediaControl/bleMediaControl.ts` | BLE HID media control peripheral helper. |
| `examples/ble-hid/mediaControl/manifest.json` | Moddable build manifest for the media control example. |

## Build

Build the example for M5Atom Matrix:

```sh
mcconfig -d -m -p esp32/m5atom_matrix -t build ./examples/ble-hid/mediaControl/manifest.json
```

Flash and debug on hardware:

```sh
mcconfig -dl -m -p esp32/m5atom_matrix ./examples/ble-hid/mediaControl/manifest.json
```

## Basic Usage

Import `BLEMediaControl` from `bleMediaControl` inside the media control example manifest:

```ts
import { BLEMediaControl } from "bleMediaControl";
```

Create a media control peripheral:

```ts
const mediaControl = new BLEMediaControl({
	deviceName: "M5Chain Media",
});
```

The current example maps M5Chain Key events to media actions:

```ts
function mediaActionForKeyEvent(keyEvent: KeyEvent): { usage: ConsumerControlUsage; label: string } | undefined {
	switch (keyEvent) {
		case KEY_EVENT.SINGLE_CLICK:
			return { usage: BLEMediaControl.USAGE.PLAY_PAUSE, label: "Play/Pause" };
		case KEY_EVENT.DOUBLE_CLICK:
			return { usage: BLEMediaControl.USAGE.SCAN_NEXT_TRACK, label: "Next Track" };
		case KEY_EVENT.LONG_PRESS:
			return { usage: BLEMediaControl.USAGE.SCAN_PREVIOUS_TRACK, label: "Previous Track" };
		default:
			return undefined;
	}
}
```

Send the selected usage from the key callback:

```ts
device.onPush = (keyEvent) => {
	const action = mediaActionForKeyEvent(keyEvent);
	if (!action) return;

	if (mediaControl.notifyUsage(action.usage)) {
		trace(`[ble-media-control/main] key event ${keyEvent}; sent ${action.label}\n`);
	}
};
```

`notifyUsage()` returns `false` when no BLE host has subscribed to the media input report, or when the usage is not mapped by this helper.

## Sending Media Controls

Send a Consumer Control usage:

```ts
mediaControl.notifyUsage(BLEMediaControl.USAGE.PLAY_PAUSE);
mediaControl.notifyUsage(BLEMediaControl.USAGE.SCAN_NEXT_TRACK);
mediaControl.notifyUsage(BLEMediaControl.USAGE.SCAN_PREVIOUS_TRACK);
```

Volume and mute controls are also available:

```ts
mediaControl.notifyUsage(BLEMediaControl.USAGE.VOLUME_UP);
mediaControl.notifyUsage(BLEMediaControl.USAGE.VOLUME_DOWN);
mediaControl.notifyUsage(BLEMediaControl.USAGE.MUTE);
```

Each `notifyUsage()` call sends a press report, then automatically sends an empty release report after `releaseDelayMs`.

## Supported Usages

`BLEMediaControl.USAGE` provides named Consumer Control usage values for common media actions.

| Usage | HID usage | Description |
| --- | --- | --- |
| `PLAY_PAUSE` | `0x00CD` | Toggle play/pause. |
| `SCAN_NEXT_TRACK` | `0x00B5` | Move to the next track. |
| `SCAN_PREVIOUS_TRACK` | `0x00B6` | Move to the previous track. |
| `VOLUME_UP` | `0x00E9` | Increase volume. |
| `VOLUME_DOWN` | `0x00EA` | Decrease volume. |
| `MUTE` | `0x00E2` | Toggle mute. |

The exported `ConsumerControlUsage` type also allows raw numeric usages, but `notifyUsage()` only sends usages that are mapped into the one-byte media report.

## Pairing and Bonding

The example starts the BLE peripheral with bonding enabled and `ioCapabilities: "none"`, so hosts can pair without a passkey. For development, if a host stops reconnecting cleanly after firmware or HID descriptor changes, remove or forget the Bluetooth device from the host OS and pair it again.

## Report Behavior

The HID service exposes a Report Protocol device with two input reports:

| Report ID | Report | Purpose |
| --- | --- | --- |
| `1` | Keyboard input report | Present for HID compatibility with the descriptor. This helper does not expose keyboard send APIs. |
| `2` | Media input report | Sends Consumer Control media usages. |

Hosts must subscribe to the media input report before `notifyUsage()` can send a report. A connected host is not enough.

## Constructor Options

| Option | Default | Description |
| --- | --- | --- |
| `deviceName` | `"BLE Media Control"` | Bluetooth device name shown to hosts. |
| `releaseDelayMs` | `20` | Delay before the automatic release report from `notifyUsage()`. |
| `batteryLevel` | `100` | Battery Service percentage reported to hosts. |

## API Summary

| API | Description |
| --- | --- |
| `notifyUsage(usage)` | Sends a mapped Consumer Control usage and automatically releases it. Returns whether a notify call was attempted. |
| `BLEMediaControl.USAGE` | Named Consumer Control usage constants. |
| `USAGE` | Named Consumer Control usage constants exported separately from the module. |
| `ConsumerControlUsage` | Type for named or raw numeric Consumer Control usages. |
| `BLEMediaControlOptions` | Constructor options type. |
