# Mono API

M5Stack documentation: [Chain Mono](https://docs.m5stack.com/en/chain/Chain_Mono)

Protocol: [Chain Mono Communication Protocol](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1245/M5Stack-Chain-Mono-Protocol-EN.pdf)

## TypeScript Exports

```ts
import M5ChainMono, {
	MATRIX_ROTATION,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
	SCROLL_STATE,
	type MonoPixel,
	type MonoScrollOptions,
	type MonoScrollText,
} from "m5chainMono";
```

The display constants and types are re-exported from `m5chainMono`; the M5Chain core does not import display code.

Chain Mono is an output-only 8x8 white LED matrix. It does not provide `HasLed`, key, or sample APIs. Its device type is
`0x000D`, and `device.kind` is `"mono"`.

## Display Modes

Applications do not need to manage the protocol display mode. Pixel, frame, and character methods select pixel mode.
`scrollText()` and the scrolling controls select scrolling mode. Calls on the same display are serialized so a mode
change cannot split a multi-command display operation.

## Pixels and Frames

```ts
await mono.setPixel(0, 0, true);
await mono.setPixels([
	{ x: 1, y: 0, on: true },
	{ x: 2, y: 0, on: false },
]);

const on = await mono.getPixel(0, 0);
```

Coordinates are integers from `0` through `7`. Batch methods accept between 1 and 64 entries.

`writeFrame()` accepts exactly eight row bytes. Row 0 is `Y=0`; bit 7 maps to `X=0` and bit 0 maps to `X=7`.

```ts
await mono.writeFrame(
	new Uint8Array([
		0b00111100,
		0b01000010,
		0b10100101,
		0b10000001,
		0b10100101,
		0b10011001,
		0b01000010,
		0b00111100,
	]),
);

const rows = await mono.readFrame();
```

## Characters and Scrolling

The built-in font is 5x7 and supports one-byte ASCII codes from 32 through 127.

```ts
await mono.drawCharacter("A", { x: 1, y: 0 });

await mono.scrollText("M5STACK", {
	direction: SCROLL_DIRECTION.LEFT,
	behavior: SCROLL_BEHAVIOR.LOOP,
	intervalMs: 100,
});
```

Scrolling text must contain 1 through 32 ASCII characters. `intervalMs` is milliseconds per pixel and accepts integers
from `0` through `65535`. Defaults are left, loop, and 100 ms/pixel.

| Method | Description |
| --- | --- |
| `await device.pauseScrolling()` | Pauses and retains the current display. |
| `await device.resumeScrolling()` | Starts or resumes scrolling. |
| `await device.stopScrolling()` | Stops scrolling and clears the scrolling characters. |
| `await device.getScrollState()` | Returns `running`, `paused`, or `stopped`. |
| `await device.readScrollText()` | Reads the configured text, direction, behavior, and interval. |

## Rotation, Brightness, and Clear

```ts
await mono.setRotation(MATRIX_ROTATION.DEG_90);
await mono.setBrightness(0.5);
await mono.clear();
```

Brightness uses the library-wide normalized `0` through `1` range. Chain Mono has protocol levels `0` through `7`, so
values are rounded to the nearest level and `getBrightness()` returns that level divided by 7.

`setRotation()` and `setBrightness()` accept an optional second `saveToFlash` boolean. It defaults to `false`. Avoid
frequent Flash writes.

The settings can also be applied together:

```ts
await mono.configure({
	display: {
		rotation: MATRIX_ROTATION.DEG_90,
		brightness: 0.5,
		saveToFlash: false,
	},
});

const configuration = await mono.readConfiguration();
```
