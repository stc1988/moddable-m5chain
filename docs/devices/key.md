# Key API

M5Stack documentation: [Chain Key](https://docs.m5stack.com/en/chain/Chain_Key)

## TypeScript Exports

```ts
import M5ChainKey, { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "m5chainKey";
```

`KEY_EVENT`, `KEY_MODE`, and `KEY_STATUS` values can also be used through their TypeScript types.

| Export | Description |
| --- | --- |
| `M5ChainKey` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KEY_MODE` | Key mode constants: `PASSIVE`, `ACTIVE`. |
| `KEY_STATUS` | Key status constants: `RELEASED`, `PRESSED`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `KeyMode` | Type of values accepted by `setKeyMode` and returned by `getKeyMode`. |
| `KeyStatus` | Type of key status values used internally by key state reads. |

## Capabilities

- Common device API
- LED API
- Key API

The Key device has no additional device-specific methods.

## Usage

```ts
import M5ChainKey, { KEY_EVENT, KEY_MODE } from "m5chainKey";

if (device.type === M5ChainKey.DEVICE_TYPE) {
	const key = device as M5ChainKey;

	await key.setLedColor(255, 255, 255);
	await key.setKeyMode(KEY_MODE.ACTIVE);

	key.onPush = async (keyEvent) => {
		if (keyEvent === KEY_EVENT.DOUBLE_CLICK) {
			await key.setLedColor(255, 0, 0);
		}
	};
}
```

## Key Methods

| Method | Description |
| --- | --- |
| `await device.isKeyPressed()` | Reads whether the key is currently pressed. |
| `await device.setKeyTriggerInterval(doubleClickMs, longPressMs)` | Sets double-click and long-press trigger intervals. |
| `await device.getKeyTriggerInterval()` | Reads `{ doubleClickMs, longPressMs }`. |
| `await device.setKeyMode(mode)` | Sets key mode. Use `KEY_MODE.PASSIVE` (`0`) or `KEY_MODE.ACTIVE` (`1`). |
| `await device.getKeyMode()` | Reads key mode as a `KeyMode` value. |
| `device.onPush = (keyEvent) => {}` | Handles key events when active reporting is enabled. |
