# Encoder API

M5Stack documentation: [Chain Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder)

## TypeScript Exports

```ts
import M5ChainEncoder, {
	KEY_EVENT,
	type EncoderABDirection,
	type KeyEvent,
	type SaveToFlash,
} from "m5chainEncoder";
```

| Export | Description |
| --- | --- |
| `M5ChainEncoder` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `EncoderABDirection` | `0 \| 1`; clockwise increase or clockwise decrease. |
| `SaveToFlash` | `0 \| 1`; whether to persist a setting. |

## Capabilities

- Common device API
- LED API
- Key API
- Poll API

## Usage

```ts
import M5ChainEncoder, { KEY_EVENT } from "m5chainEncoder";

if (device.type === M5ChainEncoder.DEVICE_TYPE) {
	const encoder = device as M5ChainEncoder;

	await encoder.setLedColor(0, 40, 255);
	await encoder.resetEncoderValue();

	encoder.onPush = async (keyEvent) => {
		if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
			await encoder.resetEncoderValue();
		}
	};

	encoder.onPoll = (delta) => {
		trace(`encoder moved by ${delta}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getEncoderValue()` | Reads the signed encoder value. Range: `-32768` to `32767`. |
| `await device.getEncoderIncValue()` | Reads the signed increment value. Range: `-32768` to `32767`. |
| `await device.resetEncoderValue()` | Resets the encoder value. |
| `await device.resetEncoderIncValue()` | Resets the encoder increment value. |
| `await device.setEncoderABDirect(direct, saveToFlash = 0)` | Sets encoder A/B direction. `0`: clockwise increase, `1`: clockwise decrease. |
| `await device.getEncoderABDirect()` | Reads encoder A/B direction. |

## Poll Value

`onPoll` receives the delta from the previous encoder value. No event is dispatched while the value is unchanged.
