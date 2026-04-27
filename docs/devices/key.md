# Key API

M5Stack documentation: [Chain Key](https://docs.m5stack.com/en/chain/Chain_Key)

## TypeScript Exports

```ts
import M5ChainKey, { KEY_EVENT, type KeyEvent } from "m5chainKey";
```

| Export | Description |
| --- | --- |
| `M5ChainKey` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KeyEvent` | Type of values passed to `onPush`. |

## Capabilities

- Common device API
- LED API
- Key API

The Key device has no additional device-specific methods.

## Usage

```ts
import M5ChainKey, { KEY_EVENT } from "m5chainKey";

if (device.type === M5ChainKey.DEVICE_TYPE) {
	const key = device as M5ChainKey;

	await key.setLedColor(255, 255, 255);
	await key.setKeyMode(1);

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
| `await device.setKeyMode(mode)` | Sets key mode. `0`: passive, `1`: active report. |
| `await device.getKeyMode()` | Reads key mode. |
| `device.onPush = (keyEvent) => {}` | Handles key events when active reporting is enabled. |
