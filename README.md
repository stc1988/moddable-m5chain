# moddable-m5chain

`moddable-m5chain` is a Moddable SDK module for controlling M5Chain devices over UART.  
It handles device enumeration, initialization, event dispatch, and polling.

## Device Capability Matrix

| Device | Type ID | `HasLed` | `HasKey` | `CanPoll` | Poll Event (`onPoll`) | API Guide |
| --- | --- | --- | --- | --- | --- | --- |
| [Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder) | `0x0001` | Yes | Yes | Yes | Yes (delta value) | [Encoder API](docs/devices/encoder.md) |
| [Angle](https://docs.m5stack.com/en/chain/Chain_Angle) | `0x0002` | Yes | No | Yes | Yes (normalized `0.00`-`1.00`) | [Angle API](docs/devices/angle.md) |
| [Key](https://docs.m5stack.com/en/chain/Chain_Key) | `0x0003` | Yes | Yes | No | No | [Key API](docs/devices/key.md) |
| [JoyStick](https://docs.m5stack.com/en/chain/Chain_Joystick) | `0x0004` | Yes | Yes | Yes | Yes (`{ x, y }` in `-128` to `127`) | [JoyStick API](docs/devices/joystick.md) |
| [ToF](https://docs.m5stack.com/en/chain/Chain_ToF) | `0x0005` | Yes | No | Yes | Yes (distance in mm) | [ToF API](docs/devices/tof.md) |

## Features

- Packet transport and matching (`sendPacket` / `sendAndWait`)
- Automatic scan on startup
- Automatic re-scan when `ENUM_PLEASE (0xFC)` is received (debounced)
- Feature composition with mixins ([LED](docs/features/has-led.md), [Key](docs/features/has-key.md), [Poll](docs/features/can-poll.md))
- Poll loop runs only when at least one device has `onPoll` set

## Setup

### 1) Include this module in your manifest

In your app's `manifest.json`, include this module's manifest.

```json
{
	"include": [
		{
			"git":"https://github.com/stc1988/moddable-m5chain.git"
		}
	]
}
```

### 2) Pin configuration

For M5Stack products, the default UART pins are set to the Grove port.

If you use an M5Atom series device with  [Atom Chain Base](https://docs.m5stack.com/ja/accessory/Atomic_ToChain_Base), automatically provides a `config.m5chain` pin configuration.

See [Minimal Usage](#minimal-usage) for the concrete usage pattern.

## Minimal Usage

```js
import M5Chain from "m5chain";
import config from "mc/config";

const m5chain = new M5Chain({
	transmit: config.m5chain.transmit,
	receive: config.m5chain.receive,
	debug: false,
	pollingInterval: 30, // ms
});

m5chain.onDeviceListChanged = (devices) => {
	for (const device of devices) {
		trace(`id=${device.id} type=0x${device.type.toString(16)} uid=${device.uuid}\n`);
	}
};

await m5chain.start();
```

## Event Model

### `m5chain.onDeviceListChanged = (devices) => {}`

- Called after the initial scan completes in `start()`
- Called again after re-scan when the chain sends `ENUM_PLEASE`
- `devices` is the current connected device list

### `device.onPush = (status) => {}`

Available on devices with `HasKey` (Encoder / Key / JoyStick).

- `status` is a key event, not the pressed/released state
- Use `KEY_EVENT.SINGLE_CLICK`, `KEY_EVENT.DOUBLE_CLICK`, or `KEY_EVENT.LONG_PRESS`

```js
import M5Chain, { KEY_EVENT } from "m5chain";

device.onPush = async (keyEvent) => {
	if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
		await device.setLedColor(255, 0, 0);
	}
};
```

`KEY_EVENT`, `KEY_MODE`, `KEY_STATUS`, and their TypeScript types are also exported from the key-capable device modules:
`m5chainEncoder`, `m5chainKey`, and `m5chainJoyStick`.

### `device.onPoll = (value) => {}`

Available on devices with `CanPoll` (Encoder / Angle / JoyStick / ToF).  
If any device has `onPoll` set, bus polling starts. It stops when all `onPoll` handlers are `null`.

Angle, JoyStick, and ToF dispatch the latest sampled value on every poll. Encoder dispatches the delta from the previous encoder value and skips dispatch while the value is unchanged.

## API

### M5Chain

- `new M5Chain({ transmit, receive, debug = false, pollingInterval = 30 })`
- `await m5chain.start()`
- `m5chain.devices` current device array

### Common Device API (`M5ChainDevice`)

- `device.id`
- `device.type`
- `device.uuid` (after `init()`)
- `await device.getUID(uidType = 1)` (`uidType: 0 | 1`)
- `await device.getBootloaderVersion()`
- `await device.getFirmwareVersion()`

### LED Features (`HasLed`)

Available on: Encoder / Angle / Key / JoyStick / ToF

See [HasLed API](docs/features/has-led.md).

### Key Features (`HasKey`)

Available on: Encoder / Key / JoyStick

See [HasKey API](docs/features/has-key.md).

### Poll Features (`CanPoll`)

Available on: Encoder / Angle / JoyStick / ToF

See [CanPoll API](docs/features/can-poll.md).

### Device-specific APIs

Device-specific usage, TypeScript exports, and method details are split into focused pages:

- [Device API index](docs/devices/README.md)
- [Encoder API](docs/devices/encoder.md)
- [Angle API](docs/devices/angle.md)
- [Key API](docs/devices/key.md)
- [JoyStick API](docs/devices/joystick.md)
- [ToF API](docs/devices/tof.md)

Feature mixin details are also split into focused pages:

- [Feature API index](docs/features/README.md)
- [HasLed API](docs/features/has-led.md)
- [HasKey API](docs/features/has-key.md)
- [CanPoll API](docs/features/can-poll.md)

README intentionally keeps only the setup, event model, and shared API surface so device and feature pages can grow without making the first-read path hard to scan.

## Examples

- `examples/basic`: device discovery, info read, and event subscription
- `examples/led`: LED control for Encoder/Angle/Key/JoyStick/ToF

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
