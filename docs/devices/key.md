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
| `KeyMode` | Type of values accepted by `configure({ key: { mode } })` and returned by `readConfiguration()`. |
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
	await key.configure({ key: { mode: KEY_MODE.ACTIVE } });

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
| `await device.configure({ key })` | Applies key configuration. |
| `await device.readConfiguration()` | Reads key configuration from the device. |
| `await device.isKeyPressed()` | Reads whether the key is currently pressed. |
| `device.onPush = (keyEvent) => {}` | Handles key events when active reporting is enabled. |

## Configuration

| Option | Description |
| --- | --- |
| `key.mode` | Sets key mode. Use `KEY_MODE.PASSIVE` (`0`) or `KEY_MODE.ACTIVE` (`1`). |
| `key.triggerInterval.doubleClickMs` | Sets double-click trigger interval in milliseconds. Must be `100` to `1000` in `100` ms steps. |
| `key.triggerInterval.longPressMs` | Sets long-press trigger interval in milliseconds. Must be `3000` to `10000` in `1000` ms steps. |
