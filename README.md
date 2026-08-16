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
| [PIR](https://docs.m5stack.com/en/chain/Chain_PIR) | `0x0009` | Yes | No | Yes | Yes (presence status) | [PIR API](docs/devices/pir.md) |
| [Buzzer](https://docs.m5stack.com/en/chain/Chain_Buzzer) | `0x000B` | Yes | No | No | No | [Buzzer API](docs/devices/buzzer.md) |
| [Mono](https://docs.m5stack.com/en/chain/Chain_Mono) | `0x000D` | No | No | No | No | [Mono API](docs/devices/mono.md) |
| [RGB](https://docs.m5stack.com/en/chain/Chain_RGB) | `0x000E` | No | No | No | No | [RGB API](docs/devices/rgb.md) |

## Features

- Packet transport and matching (`sendPacket` / `sendAndWait`)
- Application-selected device classes keep unused device modules out of Mods
- Automatic scan on startup
- Automatic re-scan when `ENUM_PLEASE (0xFC)` is received (debounced)
- Connection monitoring detects topology changes even without sample polling, including devices attached after startup
- Feature composition with mixins ([LED](docs/features/has-led.md), [Key](docs/features/has-key.md), [Sample](docs/features/can-sample.md))
- Poll loop runs only when at least one device has `onSample` set

## Setup

### 1) Include the library from Git

The repository root manifest is the standalone, all-device entry point. Until the first release tag is available, use
the `main` branch:

```json
{
	"include": [
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"branch": "main"
		}
	]
}
```

For reproducible builds, replace `branch` with a published release tag when one is available:

```json
{
	"include": [
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"tag": "v1.0.0"
		}
	]
}
```

Release tags are intended to be immutable. Branch builds follow ongoing development and may include breaking changes.
If a cached branch build does not update, clean the application build before rebuilding; Moddable stores cloned
repositories with the project's temporary build files.

The root manifest includes every supported device. To reduce the application size, select only the required device
manifests in an inline Git manifest. This example includes Encoder and ToF:

```json
{
	"include": [
		"$(MODDABLE)/examples/manifest_base.json",
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"branch": "main",
			"manifest": {
				"include": [
					"./manifests/host.json",
					"./manifests/devices/encoder.json",
					"./manifests/devices/tof.json"
				]
			}
		}
	]
}
```

Available public device manifests are `angle.json`, `buzzer.json`, `encoder.json`, `joystick.json`, `key.json`,
`mono.json`, `pir.json`, `rgb.json`, and `tof.json` under `manifests/devices/`. `manifests/devices/all.json` includes every device.
Device manifests automatically include their required LED, key, sample, or matrix features.

### 2) Include the library in a shared Mod host

The Host owns the M5Chain transport, scan, polling, base-device, and UnknownDevice implementation. Include only the
core Host manifest:

```json
{
	"include": [
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"branch": "main",
			"manifest": "./manifests/host.json"
		}
	]
}
```

Each Mod includes the declaration-only core surface plus only the device implementations it uses. For an Encoder and
ToF Mod:

```json
{
	"include": [
		"$(MODDABLE)/examples/manifest_mod.json",
		"$(MODDABLE)/examples/manifest_typings.json",
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"branch": "main",
			"manifest": {
				"include": [
					"./manifests/mod-base.json",
					"./manifests/devices/encoder.json",
					"./manifests/devices/tof.json"
				]
			}
		}
	],
	"modules": {
		"*": "./mod"
	}
}
```

`manifests/mod-all.json` is the all-device convenience entry point for a Mod. It also includes the Moddable TypeScript
declarations, so an all-device Mod only needs `$(MODDABLE)/examples/manifest_mod.json` plus that Git manifest.

### 3) Use a local checkout while developing

Do not edit the temporary clone created by Git include because a clean build deletes it. This repository's examples
use local relative paths to the same public manifests, for example:

```json
{
	"include": [
		"path/to/moddable-m5chain/manifests/host.json",
		"path/to/moddable-m5chain/manifests/devices/encoder.json"
	]
}
```

The files under `manifests/` are the stable public manifest entry points. Files under `src/m5chain/` are internal and
may move as the implementation evolves.

### 4) Pin configuration

For M5Stack products, the default UART pins are set to the Grove port.

If you use an M5Atom series device with  [Atom Chain Base](https://docs.m5stack.com/ja/accessory/Atomic_ToChain_Base), automatically provides a `config.m5chain` pin configuration.

`transmit` and `receive` may override either configured pin independently. Pin number `0` is supported.

See [Minimal Usage](#minimal-usage) for the concrete usage pattern.

## Minimal Usage

```js
import M5Chain from "m5chain";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainToF from "m5chainToF";
import config from "mc/config";

const m5chain = new M5Chain({
	deviceClasses: [M5ChainEncoder, M5ChainToF],
	transmit: config.m5chain.transmit,
	receive: config.m5chain.receive,
	debug: false,
	pollingInterval: 30, // ms
	connectionCheckInterval: 1000, // ms; set to 0 to disable
});

m5chain.onDeviceListChanged = (devices) => {
	for (const device of devices) {
		trace(`id=${device.id} kind=${device.kind} uid=${device.uuid}\n`);
	}
};

await m5chain.start();
```

`deviceClasses` is required and copied when the `M5Chain` instance is created. The array may be empty. A connected
device whose type is not registered remains visible as an `UnknownDevice`; this allows one Mod to use its supported
devices even when other device types are present on the same chain. Duplicate `DEVICE_TYPE` values are rejected.

An all-device application can use the explicit aggregate registry:

```js
import M5Chain from "m5chain";
import { M5CHAIN_DEVICE_CLASSES } from "m5chainDevices";

const m5chain = new M5Chain({
	deviceClasses: M5CHAIN_DEVICE_CLASSES,
});
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
- Set to `null` to remove the handler

### `m5chain.onError = (error, context) => {}`

Reports synchronous exceptions and rejected promises from application callbacks without treating them as UART or device
failures. `context.source` identifies the callback kind; device-specific callbacks also provide `context.device`.

### `device.onPush = (status) => {}`

Available on devices with `HasKey` (Encoder / Key / JoyStick).

- `status` is a key event, not the pressed/released state
- Use `KEY_EVENT.SINGLE_CLICK`, `KEY_EVENT.DOUBLE_CLICK`, or `KEY_EVENT.LONG_PRESS`

```js
import { KEY_EVENT } from "m5chainEncoder";

device.onPush = async (keyEvent) => {
	if (keyEvent === KEY_EVENT.SINGLE_CLICK) {
		await device.setLedColor(255, 0, 0);
	}
};
```

`KEY_EVENT`, `KEY_MODE`, `KEY_STATUS`, and their TypeScript types are exported from the key-capable device modules:
`m5chainEncoder`, `m5chainKey`, and `m5chainJoyStick`.

### `device.onSample = (sample) => {}`

Available on devices with `CanSample` (Encoder / Angle / JoyStick / ToF / PIR).

If any device has `onSample` set, bus polling starts. It stops when all `onSample` handlers are `null`.

The callback receives the newly acquired sample:

```js
device.onSample = (sample) => {
	trace(`sample=${sample}\n`);
};
```

`device.sample()` remains available as a synchronous accessor for the latest cached sample.

Angle, JoyStick, ToF, and PIR dispatch `onSample` with the newly acquired value on every poll. Encoder dispatches `onSample` with the delta from the previous encoder value and skips dispatch while the value is unchanged.

### `pir.onPresenceChanged = (status) => {}`

Available on Chain PIR. When PIR report mode is enabled, the device sends a change-driven event with
`PIR_STATUS.NO_PERSON` or `PIR_STATUS.PERSON_DETECTED`. See the [PIR API](docs/devices/pir.md).

Polling failures are tracked per device. A device is removed from the current list after three consecutive sample-read
failures without disconnecting other responsive devices.

UART requests are serialized. An uncontended request starts immediately; overlapping requests are queued with their
payload copied so later changes to the shared command buffer cannot affect them.
Packets larger than the UART transmit FIFO are written in chunks as output space becomes available.

## API

### M5Chain

- `new M5Chain({ deviceClasses, transmit, receive, debug = false, pollingInterval = 30, connectionCheckInterval = 1000 })`
  - `pollingInterval` and `connectionCheckInterval` must be non-negative finite numbers.
- `await m5chain.start()`
- `await m5chain.stop()` stops polling, disconnects current device instances, and allows a later `start()`
- `await m5chain.close()` stops the chain and closes UART permanently
- `m5chain.closed`
- `m5chain.devices` read-only snapshot of the current device array

### Common Device API (`M5ChainDevice`)

- `device.id`
- `device.kind` human-readable device type (`encoder`, `angle`, `key`, `joystick`, `tof`, `pir`, `buzzer`, `mono`, `rgb`, or `unknown`)
- `device.type` numeric device type ID used by the M5Chain protocol
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

`M5Chain` derives its connected-device union from the classes passed in `deviceClasses`, plus `UnknownDevice`. The
`RegisteredM5ChainDevice`, `M5ChainDeviceClass`, `M5ChainDeviceLike`, and generic `M5ChainOptions` types are exported from
`m5chain`. The `m5chainDevices` all-device aggregate also exports its inferred `M5ChainDevice` union.

### LED Features (`HasLed`)

Available on: Encoder / Angle / Key / JoyStick / ToF / PIR / Buzzer

See [HasLed API](docs/features/has-led.md).

### Key Features (`HasKey`)

Available on: Encoder / Key / JoyStick

See [HasKey API](docs/features/has-key.md).

### Sample Features (`CanSample`)

Available on: Encoder / Angle / JoyStick / ToF / PIR

See [CanSample API](docs/features/can-sample.md).

### Device-specific APIs

Device-specific usage, TypeScript exports, and method details are split into focused pages:

- [Device API index](docs/devices/README.md)
- [Encoder API](docs/devices/encoder.md)
- [Angle API](docs/devices/angle.md)
- [Key API](docs/devices/key.md)
- [JoyStick API](docs/devices/joystick.md)
- [ToF API](docs/devices/tof.md)
- [PIR API](docs/devices/pir.md)
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

- `examples/host`: standalone all-device application that includes the repository's root `manifest.json`
- `examples/basic`: device discovery, info read, disconnect handling, and type-safe event subscription with `device.kind`
- `examples/led`: Mod containing only Encoder/Angle/Key/JoyStick/ToF/PIR and their shared features
- `examples/buzzer`: Mod containing only Buzzer, with RGB indication, timed tones, and notes
- `examples/matrix`: Mod containing only Mono/RGB and their shared matrix protocol

Build and run the standalone host application:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./examples/host/manifest.json
```

The other examples are device-selective Mods loaded by the shared `examples/manifest.json` host. The shared host
contains the M5Chain transport, scan, polling, base-device, and UnknownDevice code; concrete device implementations
come from each Mod.
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
