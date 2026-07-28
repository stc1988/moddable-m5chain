# Device API Guides

This directory keeps device-specific API documentation separate from the main README.

The main README should stay focused on installation, startup, the event model, and shared APIs. Add or expand per-device examples here when a device needs method-level details, TypeScript import notes, or usage patterns that would make the README harder to scan.

Shared mixin APIs are documented separately in [Feature API Guides](../features/README.md).

## Devices

| Device | Class | Module | Capabilities |
| --- | --- | --- | --- |
| [Encoder](encoder.md) | `M5ChainEncoder` | `m5chainEncoder` | LED, key, sampling |
| [Angle](angle.md) | `M5ChainAngle` | `m5chainAngle` | LED, sampling |
| [Key](key.md) | `M5ChainKey` | `m5chainKey` | LED, key |
| [JoyStick](joystick.md) | `M5ChainJoyStick` | `m5chainJoyStick` | LED, key, sampling |
| [ToF](tof.md) | `M5ChainToF` | `m5chainToF` | LED, sampling |
| Unknown | `M5ChainUnknownDevice` | `m5chainUnknownDevice` | Common device information |

## Import Pattern

Most applications discover devices through `M5Chain` and narrow the exported device union with `device.kind`.

```ts
import M5Chain from "m5chain";

m5chain.onDeviceListChanged = (devices) => {
	for (const device of devices) {
		if (device.kind === "encoder") {
			device.onSample = (delta) => {
				trace(`encoder delta=${delta}\n`);
			};
		}
	}
};
```

Key-capable devices also export `KEY_EVENT`, `KEY_MODE`, `KEY_STATUS`, and their related types from their device modules.

```ts
import M5ChainKey, { KEY_EVENT, KEY_MODE, type KeyEvent, type KeyMode } from "m5chainKey";
```
