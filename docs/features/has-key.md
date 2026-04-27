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
} from "hasKey";
```

| Export | Description |
| --- | --- |
| `HasKey` | Default mixin export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KEY_MODE` | Key mode constants: `PASSIVE`, `ACTIVE`. |
| `KEY_STATUS` | Key status constants: `RELEASED`, `PRESSED`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `KeyHandler` | `((keyEvent: KeyEvent) => void) \| null`. |

Key-capable device modules also re-export `KEY_EVENT` and `KeyEvent`:

```ts
import M5ChainKey, { KEY_EVENT, type KeyEvent } from "m5chainKey";
```

## Used By

- Encoder
- Key
- JoyStick

## Usage

```ts
import { KEY_EVENT } from "m5chain";

await device.setKeyMode(1);

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
| `await device.setKeyMode(mode)` | Sets key mode. `0`: passive, `1`: active report. |
| `await device.getKeyMode()` | Reads key mode. |
| `device.onPush = (keyEvent) => {}` | Handles active key reports. Set to `null` to clear the handler. |

## Event Notes

`onPush` receives a key event, not a pressed/released state. For current pressed state, use `isKeyPressed()`.

The bus dispatches key event packets to `onDispatchEvent(buffer)`, and `HasKey` converts `buffer[6]` into a `KeyEvent` before calling `onPush`.
