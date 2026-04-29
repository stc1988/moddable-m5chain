# JoyStick API

M5Stack documentation: [Chain Joystick](https://docs.m5stack.com/en/chain/Chain_Joystick)

## TypeScript Exports

```ts
import M5ChainJoyStick, {
	KEY_EVENT,
	KEY_MODE,
	KEY_STATUS,
	type JoystickMappedRange,
	type JoystickValue,
	type KeyEvent,
	type KeyMode,
	type KeyStatus,
} from "m5chainJoyStick";
```

`KEY_EVENT`, `KEY_MODE`, and `KEY_STATUS` values can also be used through their TypeScript types.

| Export | Description |
| --- | --- |
| `M5ChainJoyStick` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KEY_MODE` | Key mode constants: `PASSIVE`, `ACTIVE`. |
| `KEY_STATUS` | Key status constants: `RELEASED`, `PRESSED`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `KeyMode` | Type of values accepted by `setKeyMode` and returned by `getKeyMode`. |
| `KeyStatus` | Type of key status values used internally by key state reads. |
| `JoystickValue` | `{ x: number; y: number }`. |
| `JoystickMappedRange` | `{ xMin, xMax, yMin, yMax }`. |

## Capabilities

- Common device API
- LED API
- Key API
- Poll API

## Usage

```ts
import M5ChainJoyStick, { KEY_EVENT, KEY_MODE } from "m5chainJoyStick";

if (device.type === M5ChainJoyStick.DEVICE_TYPE) {
	const joystick = device as M5ChainJoyStick;

	await joystick.setLedColor(0, 180, 255);
	await joystick.setKeyMode(KEY_MODE.ACTIVE);

	joystick.onPush = (keyEvent) => {
		if (keyEvent === KEY_EVENT.LONG_PRESS) {
			trace("joystick long press\n");
		}
	};

	joystick.onPoll = ({ x, y }) => {
		trace(`joystick x=${x} y=${y}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getJoystick16Adc()` | Reads raw 16-bit ADC values. Range: `0` to `65535`. |
| `await device.getJoystick8Adc()` | Reads raw 8-bit ADC values. Range: `0` to `255`. |
| `await device.getJoystickMappedRange()` | Reads `{ xMin, xMax, yMin, yMax }`. |
| `await device.setJoystickMappedRange(xMin, xMax, yMin, yMax)` | Sets mapped output ranges. |
| `await device.getJoystickMappedInt16Value()` | Reads signed mapped 16-bit values. Range: `-4095` to `4095`. |
| `await device.getJoystickMappedInt8Value()` | Reads signed mapped 8-bit values. Range: `-128` to `127`. |

## Poll Value

`onPoll` receives `{ x, y }` from `getJoystickMappedInt8Value()` on every poll.
