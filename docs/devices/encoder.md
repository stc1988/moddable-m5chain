# Encoder API

M5Stack documentation: [Chain Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder)

## TypeScript Exports

```ts
import M5ChainEncoder, {
	KEY_EVENT,
	EncoderABDirection,
	SaveToFlash,
	type EncoderConfiguration,
	type EncoderConfigurationSnapshot,
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
| `EncoderConfiguration` | Type accepted by `configure()`. |
| `EncoderConfigurationSnapshot` | Type returned by `readConfiguration()`. |

## Capabilities

- Common device API
- LED API
- Key API
- Sample API

## Usage

```ts
import M5ChainEncoder, { EncoderABDirection, KEY_EVENT, SaveToFlash } from "m5chainEncoder";

if (device.type === M5ChainEncoder.DEVICE_TYPE) {
	const encoder = device as M5ChainEncoder;

	await encoder.setLedColor(0, 40, 255);
	await encoder.configure({
		encoder: {
			abDirection: EncoderABDirection.CLOCKWISE_INCREASE,
			saveToFlash: SaveToFlash.DISABLE,
		},
	});
	await encoder.resetEncoderValue();

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
| `await device.configure({ encoder })` | Applies encoder configuration. |
| `await device.readConfiguration()` | Reads key and encoder configuration from the device. |
| `await device.getEncoderValue()` | Reads the signed encoder value. Range: `-32768` to `32767`. |
| `await device.getEncoderIncValue()` | Reads the signed increment value. Range: `-32768` to `32767`. |
| `await device.resetEncoderValue()` | Resets the encoder value. |
| `await device.resetEncoderIncValue()` | Resets the encoder increment value. |

## Configuration

| Option | Description |
| --- | --- |
| `encoder.abDirection` | Sets encoder A/B direction. Use `EncoderABDirection.CLOCKWISE_INCREASE` (`0`) or `EncoderABDirection.CLOCKWISE_DECREASE` (`1`). |
| `encoder.saveToFlash` | Persists `encoder.abDirection` when set to `SaveToFlash.ENABLE` (`1`). |

## Sample Value

`onSample` is dispatched when the encoder value changes. `sample()` returns the delta from the previous encoder value.
