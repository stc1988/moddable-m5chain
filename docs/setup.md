# Installation options

Start with the [quick start](../README.md#quick-start) for a standalone application. Choose a shared Mod
Host when adding a Mod to an existing host, or a stream transport for simulation. These are alternatives.

## Include the library from Git

The examples below are manifest fragments to merge into an application or Mod manifest.
For a complete standalone manifest and entry module, use the [quick start](../README.md#quick-start).

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

Available public device manifests are `angle.json`, `buzzer.json`, `chainbus.json`, `encoder.json`, `joystick.json`, `key.json`,
`mono.json`, `pir.json`, `rgb.json`, and `tof.json` under `manifests/devices/`. `manifests/devices/all.json` includes every device.
Device manifests automatically include their required LED, key, sample, or matrix features.

## Include the library in a shared Mod host

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

### Run a Mod example

From this repository, first build and flash the shared Host:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./examples/manifest.json
```

Keep the device connected, then run this in another terminal to install the basic Mod:

```sh
mcrun -d -m -p esp32/m5atom_matrix ./examples/basic/manifest.json
```

The Host calls the Mod's exported `main()` function. The debugger shows `[examples/basic] start` and
the discovered device list. A fresh Host without a Mod may show `No module found.` before this step.
Replace `basic` with `led`, `buzzer`, or `matrix` to run another top-level Mod. ChainBus checks are separated by I/O
type; for example, run `examples/chainbus/i2c/manifest.json` with a Gesture Unit or
`examples/chainbus/gpio-input/manifest.json` with a PIR Unit.

The examples use a shared Host. The shared host
contains the M5Chain transport, scan, polling, base-device, and UnknownDevice code; concrete device implementations
come from each Mod.
That host reserves 8192 XS heap slots so the all-device library and a loaded Mod fit in the fixed-size slot heap.
Applications using their own Mod host should make the equivalent adjustment in the host manifest, not the Mod
manifest. The larger allocation is required after adding the ChainBus remote-I/O classes to `mod-all`:

```json
"creation": {
	"heap": {
		"initial": 8192,
		"incremental": 0
	}
}
```

## Use a local checkout while developing

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

## Serial configuration

When no M5Chain pin configuration is present, the UART pins default to the target's Grove-compatible
`device.I2C.default.data` and `device.I2C.default.clock` pins.

The library supplies Atom Chain Base pin settings for M5Atom Matrix, Lite, S3, S3 Lite, and S3R targets. On the
M5Stack Chain DualKey target, the first Chain connector is the default, using UART1 with transmit pin 47 and receive
pin 48. Other targets use the Grove-compatible defaults unless you specify pins.

The UART port defaults to `1`. Pass `port` to select another hardware UART, allowing separate `M5Chain` instances to
use different ports concurrently:

```ts
const first = new M5Chain({ deviceClasses, port: 1 });
const second = new M5Chain({ deviceClasses, port: 2, transmit: 17, receive: 16 });
```

Chain DualKey has two independent Chain connectors. To use both at the same time, create one `M5Chain` instance for
each hardware UART. The first instance below uses the target defaults; the second selects UART2 and its pins:

```ts
const first = new M5Chain({ deviceClasses });
const second = new M5Chain({ deviceClasses, port: 2, transmit: 6, receive: 5 });
```

Target defaults, `mc/config`, `mod/config`, and constructor options are applied in that order of increasing priority.
`port`, `transmit`, and `receive` may override their configured values independently. Port and pin number `0` are
supported. Values in `mc/config` and `mod/config` must be non-negative integers; invalid values are ignored.
Constructor serial options are passed to the UART driver. For example, application configuration may contain
`{ "m5chain": { "port": 2, "transmit": 17, "receive": 16 } }`.

See the [quick start](../README.md#quick-start) for the concrete usage pattern.

## Inject a stream transport for simulation

`M5Chain` normally creates a UART-backed `ReadableStream<Uint8Array>` and `WritableStream<Uint8Array>` internally. For
the desktop simulator or protocol tests, pass a compatible stream pair instead:

```ts
import M5Chain, { type M5ChainTransport } from "m5chain";
import { M5CHAIN_DEVICE_CLASSES } from "m5chainDevices";

const transport: M5ChainTransport = {
	readable, // ReadableStream<Uint8Array>
	writable, // WritableStream<Uint8Array>
	close() {
		// release mock, socket, or other transport resources
	},
};

const m5chain = new M5Chain({
	deviceClasses: M5CHAIN_DEVICE_CLASSES,
	transport,
});
```

`transport` cannot be combined with `port`, `transmit`, or `receive`, and both streams must be unlocked. `M5Chain` locks both
streams for its lifetime. Its
`close()` method invokes the optional transport `close()` hook to release the underlying resource, then cancels or
aborts the streams and releases their locks. Readable chunks must be `Uint8Array` values. The injected transport
carries complete or partial UART byte chunks; the same framing, CRC, request matching, scan, and polling logic runs on
hardware and in the simulator.

See [examples/simulator](../examples/simulator) for a deterministic in-memory M5Chain device that deliberately splits response frames across
multiple stream chunks.

Run the in-memory example from this repository with:

```sh
mcconfig -d -m -p sim ./examples/simulator/manifest.json
```

The debugger should show `[examples/simulator] PASS id=1 uid=0102030405060708090A0B0C`.
No M5Chain hardware is needed for this example.
