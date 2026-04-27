# HasKey API

`HasKey` adds key state, key mode, and active key event handling to a device class.

## TypeScript Exports

```ts
import HasKey, {
	KEY_EVENT,
	KEY_MODE,
	KEY_STATUS,
	type KeyEvent,
	type KeyHandler,
	type KeyMode,
	type KeyStatus,
} from "hasKey";
```

`KEY_EVENT`, `KEY_MODE`, and `KEY_STATUS` values can also be used through their TypeScript types.

| Export | Description |
| --- | --- |
| `HasKey` | Default mixin export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KEY_MODE` | Key mode constants: `PASSIVE`, `ACTIVE`. |
| `KEY_STATUS` | Key status constants: `RELEASED`, `PRESSED`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `KeyHandler` | `((keyEvent: KeyEvent) => void) \| null`. |
| `KeyMode` | Type of values accepted by `setKeyMode` and returned by `getKeyMode`. |
| `KeyStatus` | Type of key status values used internally by key state reads. |

Key-capable device modules also re-export `KEY_EVENT`, `KEY_MODE`, `KEY_STATUS`, and their related types:

```ts
import M5ChainKey, { KEY_EVENT, KEY_MODE, type KeyEvent, type KeyMode } from "m5chainKey";
```

## Used By

- Encoder
- Key
- JoyStick

## Usage

```ts
import { KEY_EVENT, KEY_MODE } from "m5chain";

await device.setKeyMode(KEY_MODE.ACTIVE);

device.onPush = (keyEvent) => {
	if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
		trace("single click\n");
	}
};
```

## Methods

| Method | Description |
| --- | --- |
| `await device.isKeyPressed()` | Reads whether the key is currently pressed. |
| `await device.setKeyTriggerInterval(doubleClickMs, longPressMs)` | Sets double-click and long-press trigger intervals. |
| `await device.getKeyTriggerInterval()` | Reads `{ doubleClickMs, longPressMs }`. |
| `await device.setKeyMode(mode)` | Sets key mode. Use `KEY_MODE.PASSIVE` (`0`) or `KEY_MODE.ACTIVE` (`1`). |
| `await device.getKeyMode()` | Reads key mode as a `KeyMode` value. |
| `device.onPush = (keyEvent) => {}` | Handles active key reports. Set to `null` to clear the handler. |

## Event Notes

`onPush` receives a key event, not a pressed/released state. For current pressed state, use `isKeyPressed()`.

The bus dispatches key event packets to `onDispatchEvent(buffer)`, and `HasKey` converts `buffer[6]` into a `KeyEvent` before calling `onPush`.
