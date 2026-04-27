# Device API Guides

This directory keeps device-specific API documentation separate from the main README.

The main README should stay focused on installation, startup, the event model, and shared APIs. Add or expand per-device examples here when a device needs method-level details, TypeScript import notes, or usage patterns that would make the README harder to scan.

Shared mixin APIs are documented separately in [Feature API Guides](../features/README.md).

## Devices

| Device | Class | Module | Capabilities |
| --- | --- | --- | --- |
| [Encoder](encoder.md) | `M5ChainEncoder` | `m5chainEncoder` | LED, key, polling |
| [Angle](angle.md) | `M5ChainAngle` | `m5chainAngle` | LED, polling |
| [Key](key.md) | `M5ChainKey` | `m5chainKey` | LED, key |
| [JoyStick](joystick.md) | `M5ChainJoyStick` | `m5chainJoyStick` | LED, key, polling |
| [ToF](tof.md) | `M5ChainToF` | `m5chainToF` | LED, polling |

## Import Pattern

Most applications discover devices through `M5Chain` and use runtime checks by `device.type`.

```ts
import M5Chain from "m5chain";
import M5ChainEncoder from "m5chainEncoder";

m5chain.onDeviceListChanged = (devices) => {
	for (const device of devices) {
		if (device.type === M5ChainEncoder.DEVICE_TYPE) {
			const encoder = device as M5ChainEncoder;
			encoder.onPoll = (delta) => {
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
