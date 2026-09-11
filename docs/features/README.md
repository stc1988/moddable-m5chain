# Feature API Guides

These APIs are available on the concrete device instances returned by M5Chain.

Import and register the device class you use; you do not need to import its mixins.

## Features

| Feature | Module | Adds | Used by |
| --- | --- | --- | --- |
| [HasLed](has-led.md) | `hasLed` | RGB LED color and brightness methods | Encoder, Angle, Key, JoyStick, ToF, PIR, Buzzer |
| [HasKey](has-key.md) | `hasKey` | Key state, key events, key mode methods | Encoder, Key, JoyStick |
| [CanSample](can-sample.md) | `canSample` | `onSample` callback, `sample()` accessor, and serial-bus sample reads | Encoder, Angle, JoyStick, ToF, PIR |

For custom device implementation, see [feature composition](../development.md#feature-composition).
