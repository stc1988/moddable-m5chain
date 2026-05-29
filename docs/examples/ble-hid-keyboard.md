# BLE HID Keyboard Example

`examples/ble-hid/keyboard` turns an M5Chain Key device into a BLE HID keyboard peripheral. The host sees the device as a Bluetooth keyboard, and key events from the M5Chain Key can send keyboard reports.

## Files

| File | Purpose |
| --- | --- |
| `examples/ble-hid/keyboard/main.ts` | Wires `M5Chain`, `M5ChainKey`, and `BLEKeyboard` together. |
| `examples/ble-hid/keyboard/bleKeyboard.ts` | BLE HID keyboard peripheral helper. |
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

Import `BLEKeyboard` from `bleKeyboard` inside the keyboard example manifest:

```ts
import { BLEKeyboard } from "bleKeyboard";
```

Create a keyboard peripheral:

```ts
const keyboard = new BLEKeyboard({
	deviceName: "M5Chain Keyboard",
});
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
| `deviceName` | `"BLE Keyboard"` | Bluetooth device name shown to hosts. |
| `releaseDelayMs` | `20` | Delay before automatic release reports from `notify*` methods. |
| `batteryLevel` | `100` | Battery Service percentage reported to hosts. |

## API Summary

| API | Description |
| --- | --- |
| `notifyKey(options)` | Sends a character, one key code, or multiple key codes based on `options`. |
| `notifyCharacter(character, modifiers?)` | Sends one printable/control character and automatically releases it. |
| `notifyKeyCode(keyCode, modifiers?)` | Sends one key code and automatically releases it. |
| `notifyKeyCodes(keyCodes, modifiers?)` | Sends up to six key codes and automatically releases them. |
| `pressKeyCode(keyCode, modifiers?)` | Sends one key code without automatic release. |
| `pressKeyCodes(keyCodes, modifiers?)` | Sends up to six key codes without automatic release. |
| `releaseAll()` | Sends an empty keyboard report. |
| `getIndicators()` | Returns the latest host LED indicator bit mask. |
| `hasIndicator(indicator)` | Returns whether an indicator bit is set. |
| `onIndicatorsChanged = (indicators) => {}` | Handles host LED indicator changes. |

