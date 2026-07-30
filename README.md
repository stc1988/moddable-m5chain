# moddable-m5chain

`moddable-m5chain` is a Moddable SDK module for controlling M5Chain devices over UART.  
It handles device enumeration, initialization, event dispatch, and polling.

## Device Capability Matrix

| Device | Type ID | `HasLed` | `HasKey` | `CanSample` | Sample Event (`onSample`) | API Guide |
| --- | --- | --- | --- | --- | --- | --- |
| [Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder) | `0x0001` | Yes | Yes | Yes | Yes (delta value) | [Encoder API](docs/devices/encoder.md) |
| [Angle](https://docs.m5stack.com/en/chain/Chain_Angle) | `0x0002` | Yes | No | Yes | Yes (normalized `0.00`-`1.00`) | [Angle API](docs/devices/angle.md) |
| [Key](https://docs.m5stack.com/en/chain/Chain_Key) | `0x0003` | Yes | Yes | No | No | [Key API](docs/devices/key.md) |
| [JoyStick](https://docs.m5stack.com/en/chain/Chain_Joystick) | `0x0004` | Yes | Yes | Yes | Yes (`{ x, y }` in `-128` to `127`) | [JoyStick API](docs/devices/joystick.md) |
| [ToF](https://docs.m5stack.com/en/chain/Chain_ToF) | `0x0005` | Yes | No | Yes | Yes (distance in mm) | [ToF API](docs/devices/tof.md) |
| [Buzzer](https://docs.m5stack.com/en/chain/Chain_Buzzer) | `0x000B` | Yes | No | No | No | [Buzzer API](docs/devices/buzzer.md) |
| [Mono](https://docs.m5stack.com/en/chain/Chain_Mono) | `0x000D` | No | No | No | No | [Mono API](docs/devices/mono.md) |
| [RGB](https://docs.m5stack.com/en/chain/Chain_RGB) | `0x000E` | No | No | No | No | [RGB API](docs/devices/rgb.md) |

## Features

- Packet transport and matching (`sendPacket` / `sendAndWait`)
- Automatic scan on startup
- Automatic re-scan when `ENUM_PLEASE (0xFC)` is received (debounced)
- Connection monitoring detects topology changes even without sample polling, including devices attached after startup
- Feature composition with mixins ([LED](docs/features/has-led.md), [Key](docs/features/has-key.md), [Sample](docs/features/can-sample.md))
- Poll loop runs only when at least one device has `onSample` set

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
	connectionCheckInterval: 1000, // ms; set to 0 to disable
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
- Called again after re-scan when the chain sends `ENUM_PLEASE` or connection monitoring detects a topology change
- `devices` is the current connected device list

### `device.onDisconnected = () => {}`

- Called before a disconnected device instance is removed or replaced during re-scan
- Works for devices without `onSample`, such as Key, through connection monitoring
- The disconnected instance has `device.connected === false` and can no longer access the bus

### `m5chain.onError = (error, context) => {}`

Reports synchronous exceptions and rejected promises from application callbacks without treating them as UART or device
failures. `context.source` identifies the callback kind; device-specific callbacks also provide `context.device`.

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

### `device.onSample = (sample) => {}`

Available on devices with `CanSample` (Encoder / Angle / JoyStick / ToF).

If any device has `onSample` set, bus polling starts. It stops when all `onSample` handlers are `null`.

The callback receives the newly acquired sample:

```js
device.onSample = (sample) => {
	trace(`sample=${sample}\n`);
};
```

`device.sample()` remains available as a synchronous accessor for the latest cached sample.

Angle, JoyStick, and ToF dispatch `onSample` with the newly acquired value on every poll. Encoder dispatches `onSample` with the delta from the previous encoder value and skips dispatch while the value is unchanged.

Polling failures are tracked per device. A device is removed from the current list after three consecutive sample-read
failures without disconnecting other responsive devices.

UART requests are serialized. An uncontended request starts immediately; overlapping requests are queued with their
payload copied so later changes to the shared command buffer cannot affect them.

## API

### M5Chain

- `new M5Chain({ transmit, receive, debug = false, pollingInterval = 30, connectionCheckInterval = 1000 })`
- `await m5chain.start()`
- `await m5chain.stop()` stops polling, disconnects current device instances, and allows a later `start()`
- `await m5chain.close()` stops the chain and closes UART permanently
- `m5chain.closed`
- `m5chain.devices` read-only snapshot of the current device array

### Common Device API (`M5ChainDevice`)

- `device.id`
- `device.type`
- `device.kind` (`encoder`, `angle`, `key`, `joystick`, `tof`, `buzzer`, `mono`, `rgb`, or `unknown`)
- `device.known` (`false` for device types not yet supported by this library)
- `device.connected`
- `device.uuid` (after `init()`)
- `await device.configure(options)` applies device and feature settings
- `await device.readConfiguration()` reads current device and feature settings from the chain device
- `await device.getUID(uidType = 1)` (`uidType: 0 | 1`)
- `await device.getBootloaderVersion()`
- `await device.getFirmwareVersion()`

Unknown device types remain in the device list as `M5ChainUnknownDevice`. They expose the common device API, allowing
applications to keep using recognized devices on the same chain and to report unsupported type IDs.

The `M5ChainDevice` union and `M5ChainOptions` types are exported from `m5chain`. TypeScript applications can switch on
`device.kind` to access device-specific APIs without a type assertion.

### LED Features (`HasLed`)

Available on: Encoder / Angle / Key / JoyStick / ToF / Buzzer

See [HasLed API](docs/features/has-led.md).

### Key Features (`HasKey`)

Available on: Encoder / Key / JoyStick

See [HasKey API](docs/features/has-key.md).

### Sample Features (`CanSample`)

Available on: Encoder / Angle / JoyStick / ToF

See [CanSample API](docs/features/can-sample.md).

### Device-specific APIs

Device-specific usage, TypeScript exports, and method details are split into focused pages:

- [Device API index](docs/devices/README.md)
- [Encoder API](docs/devices/encoder.md)
- [Angle API](docs/devices/angle.md)
- [Key API](docs/devices/key.md)
- [JoyStick API](docs/devices/joystick.md)
- [ToF API](docs/devices/tof.md)
- [Buzzer API](docs/devices/buzzer.md)
- [Mono API](docs/devices/mono.md)
- [RGB API](docs/devices/rgb.md)

Feature mixin details are also split into focused pages:

- [Feature API index](docs/features/README.md)
- [HasLed API](docs/features/has-led.md)
- [HasKey API](docs/features/has-key.md)
- [CanSample API](docs/features/can-sample.md)

README intentionally keeps only the setup, event model, and shared API surface so device and feature pages can grow without making the first-read path hard to scan.

## Examples

- `examples/host`: standalone host application that includes the repository's root `manifest.json`
- `examples/basic`: device discovery, info read, disconnect handling, and type-safe event subscription with `device.kind`
- `examples/led`: type-safe, sample-driven LED control for Encoder/Angle/Key/JoyStick/ToF
- `examples/buzzer`: RGB indication, timed tone playback, and note playback
- `examples/matrix`: frame drawing and scrolling text on Chain Mono and Chain RGB

Build and run the standalone host application:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./examples/host/manifest.json
```

The other examples are Mods loaded by the shared `examples/manifest.json` host.
That host reserves 6144 XS heap slots so the library and a loaded Mod fit in the fixed-size slot heap. Applications
using their own Mod host should make the equivalent adjustment in the host manifest, not the Mod manifest:

```json
"creation": {
	"heap": {
		"initial": 6144,
		"incremental": 0
	}
}
```

## Development

Format and lint:

```sh
npm run format
npm run lint
```

Verify that the preloaded library does not retain mutable objects in RAM:

```sh
mcconfig -d -m -p esp32/m5atom_matrix -t build ./manifest.json
```

The XS linker output should contain no `not frozen` warnings for `m5chain`. Module-level lookup tables, exported
constant objects, and class command tables must remain frozen so preloaded instances can stay in flash. See
[Using XS Preload to Optimize Applications](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/preload.md).

## License

MIT
