# RGB API

M5Stack documentation: [Chain RGB](https://docs.m5stack.com/en/chain/Chain_RGB)

Protocol: [Chain RGB Communication Protocol](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1252/M5Stack-Chain-RGB-Protocol-EN.pdf)

## TypeScript Exports

```ts
import M5ChainRGB, {
	type RgbMatrixPixel,
	type RgbScrollColor,
	type RgbScrollOptions,
	type RgbScrollText,
} from "m5chainRGB";
import {
	MATRIX_ROTATION,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
	SCROLL_STATE,
	type LedColor,
} from "m5chain";
```

The matrix constants and device types are also exported from `m5chain`. `LedColor` is exported from `types`.

Chain RGB is an output-only 8x8 full-color LED matrix. It does not provide `HasLed`, key, or sample APIs. Its device type
is `0x000E`, and `device.kind` is `"rgb"`.

## Display Modes

Applications do not need to manage the protocol display mode. Pixel, frame, and character methods select pixel mode.
`scrollText()` and the scrolling controls select scrolling mode. Calls on the same display are serialized so a mode
change cannot split a multi-command display operation.

## Pixels and Frames

Colors use the existing `{ r, g, b }` API with integer channels from `0` through `255`.

```ts
await rgb.setPixel(0, 0, { r: 255, g: 0, b: 0 });
await rgb.setPixels([
	{ x: 1, y: 0, color: { r: 0, g: 255, b: 0 } },
	{ x: 2, y: 0, color: { r: 0, g: 0, b: 255 } },
]);

const color = await rgb.getPixel(0, 0);
```

Coordinates are integers from `0` through `7`. Batch methods accept between 1 and 64 entries.

`writeFrame()` accepts exactly 64 colors in row-major order: left to right, then top to bottom.

```ts
const frame = Array.from({ length: 64 }, (_, index) => ({
	r: (index % 8) * 32,
	g: Math.floor(index / 8) * 32,
	b: 64,
}));

await rgb.writeFrame(frame);
const colors = await rgb.readFrame();
```

The library converts colors to the device's RGB565 representation. Values returned by read methods are expanded back to
8-bit channels and may differ slightly from the originally supplied values.

## Characters and Scrolling

The built-in font is 5x7 and supports one-byte ASCII codes from 32 through 127.

```ts
await rgb.drawCharacter("A", {
	x: 1,
	y: 0,
	color: { r: 255, g: 120, b: 0 },
});

await rgb.scrollText("READY", {
	direction: SCROLL_DIRECTION.LEFT,
	behavior: SCROLL_BEHAVIOR.LOOP,
	intervalMs: 80,
	color: { r: 0, g: 255, b: 80 },
});
```

Scrolling text must contain 1 through 32 ASCII characters. `intervalMs` is milliseconds per pixel and accepts integers
from `0` through `65535`. Defaults are left, loop, 100 ms/pixel, and the built-in gradient.

Use `color: "gradient"` to request the firmware gradient. RGB565 value zero is reserved for that effect, so a fixed
black scrolling color is not representable by the protocol.

| Method | Description |
| --- | --- |
| `await device.pauseScrolling()` | Pauses and retains the current display. |
| `await device.resumeScrolling()` | Starts or resumes scrolling. |
| `await device.stopScrolling()` | Stops scrolling and clears the scrolling characters. |
| `await device.getScrollState()` | Returns `running`, `paused`, or `stopped`. |
| `await device.readScrollText()` | Reads the configured text, direction, behavior, interval, and color. |

## Rotation, Brightness, and Clear

```ts
await rgb.setRotation(MATRIX_ROTATION.DEG_90);
await rgb.setBrightness(0.5);
await rgb.clear();
```

Brightness uses a normalized `0` through `1` value and maps to the protocol's `0` through `100` percent range. M5Stack
recommends approximately 50% brightness to limit heat and power consumption.

`setRotation()` and `setBrightness()` accept an optional second `saveToFlash` boolean. It defaults to `false`. Avoid
frequent Flash writes.

The settings can also be applied together:

```ts
await rgb.configure({
	display: {
		rotation: MATRIX_ROTATION.DEG_90,
		brightness: 0.5,
		saveToFlash: false,
	},
});

const configuration = await rgb.readConfiguration();
```
