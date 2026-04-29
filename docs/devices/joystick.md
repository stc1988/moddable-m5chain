# JoyStick API

M5Stack documentation: [Chain Joystick](https://docs.m5stack.com/en/chain/Chain_Joystick)

## TypeScript Exports

```ts
import M5ChainJoyStick, {
	KEY_EVENT,
	KEY_MODE,
	KEY_STATUS,
	type JoystickConfiguration,
	type JoystickConfigurationSnapshot,
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
| `KeyMode` | Type of values accepted by `configure({ key: { mode } })` and returned by `readConfiguration()`. |
| `KeyStatus` | Type of key status values used internally by key state reads. |
| `JoystickConfiguration` | Type accepted by `configure()`. |
| `JoystickConfigurationSnapshot` | Type returned by `readConfiguration()`. |
| `JoystickValue` | `{ x: number; y: number }`. |
| `JoystickMappedRange` | `{ xMin, xMax, yMin, yMax }`. |

## Capabilities

- Common device API
- LED API
- Key API
- Sample API

## Usage

```ts
import M5ChainJoyStick, { KEY_EVENT, KEY_MODE } from "m5chainJoyStick";

if (device.type === M5ChainJoyStick.DEVICE_TYPE) {
	const joystick = device as M5ChainJoyStick;

	await joystick.configure({
		led: { color: { r: 0, g: 180, b: 255 } },
		key: { mode: KEY_MODE.ACTIVE },
	});

	joystick.onPush = (keyEvent) => {
		if (keyEvent === KEY_EVENT.LONG_PRESS) {
			trace("joystick long press\n");
		}
	};

	joystick.onSample = function () {
		const sample = this.sample();
		trace(`joystick x=${sample.x} y=${sample.y}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getJoystick16Adc()` | Reads raw 16-bit ADC values. Range: `0` to `65535`. |
| `await device.getJoystick8Adc()` | Reads raw 8-bit ADC values. Range: `0` to `255`. |
| `await device.configure({ joystick })` | Applies joystick configuration. |
| `await device.readConfiguration()` | Reads LED, key, and joystick configuration from the device. |
| `await device.getJoystickMappedInt16Value()` | Reads signed mapped 16-bit values. Range: `-4095` to `4095`. |
| `await device.getJoystickMappedInt8Value()` | Reads signed mapped 8-bit values. Range: `-128` to `127`. |

## Configuration

| Option | Description |
| --- | --- |
| `joystick.mappedRange` | Sets mapped output ranges with `{ xMin, xMax, yMin, yMax }`. |

## Sample Value

`onSample` is dispatched on every poll. `sample()` returns `{ x, y }` from `getJoystickMappedInt8Value()`.
