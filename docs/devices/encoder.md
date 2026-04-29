# Encoder API

M5Stack documentation: [Chain Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder)

## TypeScript Exports

```ts
import M5ChainEncoder, {
	KEY_EVENT,
	EncoderABDirection,
	SaveToFlash,
	type KeyEvent,
} from "m5chainEncoder";
```

These exports can also be used as TypeScript types.

| Export | Description |
| --- | --- |
| `M5ChainEncoder` | Default class export. |
| `KEY_EVENT` | Key event constants: `SINGLE_CLICK`, `DOUBLE_CLICK`, `LONG_PRESS`. |
| `KeyEvent` | Type of values passed to `onPush`. |
| `EncoderABDirection` | Encoder A/B direction values: `CLOCKWISE_INCREASE = 0`, `CLOCKWISE_DECREASE = 1`. |
| `SaveToFlash` | Persistence values: `DISABLE = 0`, `ENABLE = 1`. |

## Capabilities

- Common device API
- LED API
- Key API
- Poll API

## Usage

```ts
import M5ChainEncoder, { EncoderABDirection, KEY_EVENT, SaveToFlash } from "m5chainEncoder";

if (device.type === M5ChainEncoder.DEVICE_TYPE) {
	const encoder = device as M5ChainEncoder;

	await encoder.setLedColor(0, 40, 255);
	await encoder.resetEncoderValue();
	await encoder.setEncoderABDirect(EncoderABDirection.CLOCKWISE_INCREASE, SaveToFlash.DISABLE);

	encoder.onPush = async (keyEvent) => {
		if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
			await encoder.resetEncoderValue();
		}
	};

	encoder.onSample = function () {
		const delta = this.sample();
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
| `await device.setEncoderABDirect(direct, saveToFlash = 0)` | Sets encoder A/B direction. Use `EncoderABDirection.CLOCKWISE_INCREASE` (`0`) or `EncoderABDirection.CLOCKWISE_DECREASE` (`1`). Use `SaveToFlash.ENABLE` (`1`) to persist the setting. |
| `await device.getEncoderABDirect()` | Reads encoder A/B direction as an `EncoderABDirection` value. |

## Sample Value

`onSample` is dispatched when the encoder value changes. `sample()` returns the delta from the previous encoder value.
