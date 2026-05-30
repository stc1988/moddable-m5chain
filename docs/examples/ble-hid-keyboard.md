# BLE HID Keyboard Example

`examples/ble-hid/keyboard` turns an M5Chain Key device into a BLE HID keyboard peripheral. The host sees the device as a Bluetooth keyboard, and key events from the M5Chain Key can send keyboard reports.

## Files

| File | Purpose |
| --- | --- |
| `examples/ble-hid/keyboard/main.ts` | Wires `M5Chain`, `M5ChainKey`, and `BLEKeyboard` together. |
| `examples/ble-hid/keyboard/keyboard.ts` | BLE HID keyboard peripheral helper. |
| `examples/ble-hid/keyboard/manifest.json` | Moddable build manifest for the keyboard example. |

## Build

Build the example for M5Atom Matrix:

```sh
mcconfig -d -m -p esp32/m5atom_matrix -t build ./examples/ble-hid/keyboard/manifest.json
```

Flash and debug on hardware:

```sh
mcconfig -dl -m -p esp32/m5atom_matrix ./examples/ble-hid/keyboard/manifest.json
```

## Basic Usage

Import `BLEKeyboard` from `keyboard` inside the keyboard example manifest:

```ts
import { BLEKeyboard } from "keyboard";
```

Create a keyboard peripheral:

```ts
const keyboard = new BLEKeyboard({
	deviceName: "M5Chain Keyboard",
});
```

By default, `BLEKeyboard` starts advertising when its BLE server becomes ready and restarts advertising after the last host disconnects. Set `autoAdvertise: false` when the app should decide when the keyboard is discoverable:

```ts
const keyboard = new BLEKeyboard({
	deviceName: "M5Chain Keyboard",
	autoAdvertise: false,
});

keyboard.startAdvertising();
keyboard.stopAdvertising();
```

The current example sends Enter whenever the M5Chain Key reports an active key event:

```ts
device.onPush = (keyEvent) => {
	if (keyboard.notifyKey({ keyCode: BLEKeyboard.KEY_CODE.ENTER })) {
		trace(`[ble-keyboard/main] key event ${keyEvent}; sent Enter\n`);
	}
};
```

`notifyKey()` returns `false` when no BLE host has subscribed to the keyboard input report.

You can also watch connection and subscription state directly:

```ts
keyboard.onConnectionChanged = (state) => {
	trace(`connected=${state.connected} subscribed=${state.subscribed}\n`);
};

if (keyboard.hasSubscribedHost()) {
	keyboard.notifyKeyCode(BLEKeyboard.KEY_CODE.ENTER);
}
```

## Sending Keys

Send a single HID key code:

```ts
keyboard.notifyKeyCode(BLEKeyboard.KEY_CODE.ENTER);
```

Send a character. Printable US keyboard characters are converted to HID key codes. Uppercase letters and shifted symbols automatically include `LEFT_SHIFT`.

```ts
keyboard.notifyCharacter("A");
keyboard.notifyCharacter("!");
```

Use the object form when the call site chooses between a character, one key code, or several key codes:

```ts
keyboard.notifyKey({ character: "A" });
keyboard.notifyKey({ keyCode: BLEKeyboard.KEY_CODE.ENTER });
keyboard.notifyKey({ keyCodes: [BLEKeyboard.KEY_CODE.A, BLEKeyboard.KEY_CODE.B] });
```

Send a string with an internal queue:

```ts
keyboard.typeText("hello\n", {
	intervalMs: 30,
	onComplete(sent) {
		trace(`typeText complete=${sent}\n`);
	},
});
```

`typeText()` returns `false` if no host has subscribed or if any character cannot be mapped. It uses the same US keyboard character mapping as `notifyCharacter()`.

## Keyboard Layout

Character conversion uses a US keyboard layout. Letters, number row keys, common punctuation, newline, tab, backspace, and space are mapped to HID key codes. On hosts configured for a different physical layout, especially Japanese layouts, punctuation sent with `notifyCharacter()` or `typeText()` may appear as a different symbol.

For layout-independent behavior, send explicit HID key codes with `notifyKeyCode()`, `notifyKeyCodes()`, `pressKeyCode()`, or `pressKeyCodes()`.

## Modifiers

Pass modifiers as bit flags. Multiple modifiers can be combined with `|`.

```ts
keyboard.notifyKey({
	keyCode: BLEKeyboard.KEY_CODE.A,
	modifiers: BLEKeyboard.MODIFIER.LEFT_SHIFT,
});

keyboard.notifyKey({
	keyCode: BLEKeyboard.KEY_CODE.DELETE,
	modifiers: BLEKeyboard.MODIFIER.LEFT_CONTROL | BLEKeyboard.MODIFIER.LEFT_ALT,
});
```

Available modifiers:

| Modifier | HID bit |
| --- | --- |
| `LEFT_CONTROL` | `0x01` |
| `LEFT_SHIFT` | `0x02` |
| `LEFT_ALT` | `0x04` |
| `LEFT_GUI` | `0x08` |
| `RIGHT_CONTROL` | `0x10` |
| `RIGHT_SHIFT` | `0x20` |
| `RIGHT_ALT` | `0x40` |
| `RIGHT_GUI` | `0x80` |

## Multiple Simultaneous Keys

The keyboard report supports up to six normal key codes plus the modifier byte. Use `notifyKeyCodes()` for a press-and-auto-release report:

```ts
keyboard.notifyKeyCodes([BLEKeyboard.KEY_CODE.A, BLEKeyboard.KEY_CODE.B], BLEKeyboard.MODIFIER.LEFT_SHIFT);
```

Calling `notifyKeyCodes()` with more than six key codes throws `RangeError`.

## Manual Press and Release

`notifyKeyCode()`, `notifyKeyCodes()`, `notifyCharacter()`, and `notifyKey()` send a press report, then automatically send an empty release report after `releaseDelayMs`.

Use manual press/release methods when the key must remain held:

```ts
keyboard.pressKeyCodes(
	[BLEKeyboard.KEY_CODE.DELETE],
	BLEKeyboard.MODIFIER.LEFT_CONTROL | BLEKeyboard.MODIFIER.LEFT_ALT,
);

// Later:
keyboard.releaseAll();
```

Manual press methods do not schedule an automatic release.

## Connection State

`BLEKeyboard` tracks connected hosts and subscribed input reports:

```ts
keyboard.onConnectionChanged = (state) => {
	if (state.subscribed) {
		trace(`keyboard ready, protocol=${state.protocolMode}\n`);
	}
};

const connected = keyboard.isConnected();
const ready = keyboard.hasSubscribedHost();
const state = keyboard.getConnectionState();
```

`notify*()`, `press*()`, `releaseAll()`, and `typeText()` only send reports to subscribed hosts. A connected host is not enough; the host must subscribe to the input report.

## Pairing and Bonding

The example starts the BLE peripheral with bonding enabled, immediate security initiation, and `ioCapabilities: "none"`, so hosts can pair without a passkey. Immediate security initiation helps hosts such as macOS proceed from a raw BLE connection into HID pairing before they subscribe to keyboard reports. For development, if a host stops reconnecting cleanly after firmware or HID descriptor changes, remove or forget the Bluetooth keyboard from the host OS and pair it again.

## Host LED Indicators

BLE hosts can write keyboard LED state through the output report. `BLEKeyboard` exposes that state as indicators:

```ts
keyboard.onIndicatorsChanged = (indicators) => {
	const capsLock = (indicators & BLEKeyboard.INDICATOR.CAPS_LOCK) !== 0;
	trace(`caps lock=${capsLock}\n`);
};
```

You can also query the current state:

```ts
const indicators = keyboard.getIndicators();
const capsLock = keyboard.hasIndicator(BLEKeyboard.INDICATOR.CAPS_LOCK);
```

Available indicators:

| Indicator | HID bit |
| --- | --- |
| `NUM_LOCK` | `0x01` |
| `CAPS_LOCK` | `0x02` |
| `SCROLL_LOCK` | `0x04` |
| `COMPOSE` | `0x08` |
| `KANA` | `0x10` |

## Protocol Mode

The HID service exposes both Report Protocol and Boot Protocol input reports. Hosts can switch protocol mode through the Protocol Mode characteristic.

`BLEKeyboard` sends keyboard input only through reports that match the current protocol mode:

| Protocol mode | Value | Report |
| --- | --- | --- |
| `BLEKeyboard.PROTOCOL_MODE.BOOT` | `0` | Boot Keyboard Input Report (`2a22`) |
| `BLEKeyboard.PROTOCOL_MODE.REPORT` | `1` | Keyboard Input Report (`2a4d`, Report ID `1`) |

Changing protocol mode sends a release report for the old mode and clears any queued `typeText()` work.

## Notify Errors

Set `onNotifyError` to observe asynchronous BLE notify failures:

```ts
keyboard.onNotifyError = (error) => {
	trace(`keyboard notify failed: ${error.message}\n`);
};
```

The boolean return value from send methods only indicates whether a matching subscribed report was found and a notify call was attempted.

## Media Keys

Volume, play/pause, next track, previous track, and similar keys are Consumer Control usages, not keyboard usages. Use `examples/ble-hid/mediaControl` for those controls instead of extending `BLEKeyboard.KEY_CODE`.

## Key Codes

`BLEKeyboard.KEY_CODE` includes letters, number row keys, basic punctuation, function keys, arrows, navigation keys, lock keys, application key, and keypad keys.

Common values:

| Key code | Description |
| --- | --- |
| `A` to `Z` | Letter keys. |
| `NUMBER_1` to `NUMBER_0` | Number row keys. |
| `ENTER`, `ESCAPE`, `BACKSPACE`, `TAB`, `SPACE` | Common control keys. |
| `MINUS`, `EQUAL`, `LEFT_BRACKET`, `RIGHT_BRACKET`, `BACKSLASH`, `SEMICOLON`, `SINGLE_QUOTE`, `GRAVE_ACCENT`, `COMMA`, `PERIOD`, `FORWARD_SLASH` | US keyboard punctuation keys. |
| `F1` to `F12` | Function keys. |
| `INSERT`, `HOME`, `PAGE_UP`, `DELETE`, `END`, `PAGE_DOWN` | Navigation cluster keys. |
| `RIGHT_ARROW`, `LEFT_ARROW`, `DOWN_ARROW`, `UP_ARROW` | Arrow keys. |
| `NUM_LOCK`, `KEYPAD_FORWARD_SLASH`, `KEYPAD_ASTERISK`, `KEYPAD_MINUS`, `KEYPAD_PLUS`, `KEYPAD_ENTER`, `KEYPAD_1` to `KEYPAD_0`, `KEYPAD_PERIOD` | Keypad keys. |

## Constructor Options

| Option | Default | Description |
| --- | --- | --- |
| `autoAdvertise` | `true` | Starts advertising automatically when the BLE server is ready and restarts after the last disconnect. Set to `false` to advertise only when `startAdvertising()` is called. |
| `deviceName` | `"BLE Keyboard"` | Bluetooth device name shown to hosts. |
| `releaseDelayMs` | `20` | Delay before automatic release reports from `notify*` methods. |
| `batteryLevel` | `100` | Battery Service percentage reported to hosts. |

## API Summary

| API | Description |
| --- | --- |
| `startAdvertising()` | Starts BLE advertising, or records that advertising should begin once the BLE server is ready. Returns whether advertising started immediately. |
| `stopAdvertising()` | Stops BLE advertising and disables automatic restart after disconnect. Returns whether advertising stopped immediately. |
| `isAdvertising()` | Returns whether this helper currently expects the BLE server to be advertising. |
| `notifyKey(options)` | Sends a character, one key code, or multiple key codes based on `options`. |
| `notifyCharacter(character, modifiers?)` | Sends one printable/control character and automatically releases it. |
| `notifyKeyCode(keyCode, modifiers?)` | Sends one key code and automatically releases it. |
| `notifyKeyCodes(keyCodes, modifiers?)` | Sends up to six key codes and automatically releases them. |
| `typeText(text, options?)` | Queues a string and sends each character with press/release timing. |
| `pressKeyCode(keyCode, modifiers?)` | Sends one key code without automatic release. |
| `pressKeyCodes(keyCodes, modifiers?)` | Sends up to six key codes without automatic release. |
| `releaseAll()` | Sends an empty keyboard report. |
| `isConnected()` | Returns whether at least one host is connected. |
| `hasSubscribedHost()` | Returns whether at least one host subscribed to a keyboard input report. |
| `getConnectionState()` | Returns connection count, subscription count, and current protocol mode. |
| `getIndicators()` | Returns the latest host LED indicator bit mask. |
| `hasIndicator(indicator)` | Returns whether an indicator bit is set. |
| `onConnectionChanged = (state) => {}` | Handles connect, disconnect, subscribe, unsubscribe, and protocol mode changes. |
| `onIndicatorsChanged = (indicators) => {}` | Handles host LED indicator changes. |
| `onNotifyError = (error) => {}` | Handles asynchronous BLE notify errors. |
