# JoyStick API

M5Stack documentation: [Chain Joystick](https://docs.m5stack.com/en/chain/Chain_Joystick)

## TypeScript Exports

```ts
import M5ChainJoyStick, {
	KEY_EVENT,
	type JoystickMappedRange,
	type JoystickValue,
	type KeyEvent,
} from "m5chainJoyStick";
```

| Export | Description |
| --- | --- |
| `M5ChainJoyStick` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `JoystickValue` | `{ x: number; y: number }`. |
| `JoystickMappedRange` | `{ xMin, xMax, yMin, yMax }`. |

## Capabilities

- Common device API
- LED API
- Key API
- Poll API

## Usage

```ts
import M5ChainJoyStick, { KEY_EVENT } from "m5chainJoyStick";

if (device.type === M5ChainJoyStick.DEVICE_TYPE) {
	const joystick = device as M5ChainJoyStick;

	await joystick.setLedColor(0, 180, 255);

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

`onPoll` receives `{ x, y }` from `getJoystickMappedInt8Value()`. It dispatches when either axis changes.
