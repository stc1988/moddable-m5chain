# Feature API Guides

This directory keeps feature mixin documentation separate from the main README and from device-specific guides.

Feature mixins are primarily for device class implementation. Application code usually interacts with the methods through concrete devices such as `M5ChainEncoder`, `M5ChainKey`, or `M5ChainToF`.

## Features

| Feature | Module | Adds | Used by |
| --- | --- | --- | --- |
| [HasLed](has-led.md) | `hasLed` | RGB LED color and brightness methods | Encoder, Angle, Key, JoyStick, ToF |
| [HasKey](has-key.md) | `hasKey` | Key state, key events, key mode methods | Encoder, Key, JoyStick |
| [CanSample](can-sample.md) | `canSample` | `onSample` callback, `sample()` accessor, and serial-bus sample reads | Encoder, Angle, JoyStick, ToF |

## Composition Pattern

Device classes compose features with `withDeviceFeatures(...)`.

```ts
import CanSample from "canSample";
import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainEncoder extends withDeviceFeatures(HasLed, HasKey, CanSample<number>) {
	// Device-specific implementation.
}
```

The order matters when a feature depends on commands from the composed class. Existing device classes should be used as the reference pattern.
