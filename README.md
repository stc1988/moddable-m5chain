# moddable-m5chain

Control M5Chain devices from a Moddable SDK application over UART. Register the device classes you need,
then read sensors, handle events, and control LEDs, buzzers, or matrix displays.

## Quick start

This example uses an M5Atom Matrix with an Atom Chain Base and a Chain Encoder. Connect the Encoder to the
base and the M5Atom to your computer over USB. Set up the Moddable SDK and its ESP32 toolchain first;
`MODDABLE` must point to the SDK and its tools must be on `PATH`.

Create these two files in a new application directory.

**`manifest.json`**

```json
{
	"include": [
		"$(MODDABLE)/examples/manifest_base.json",
		{
			"git": "https://github.com/stc1988/moddable-m5chain.git",
			"branch": "main"
		}
	],
	"defines": { "main": { "async": 1 } },
	"modules": { "*": "./main" }
}
```

**`main.ts`**

```ts
import M5Chain from "m5chain";
import M5ChainEncoder from "m5chainEncoder";

const m5chain = new M5Chain({ deviceClasses: [M5ChainEncoder] });

m5chain.onError = (error, context) => {
	trace(`${context.source}: ${error}\n`);
};

m5chain.onDeviceListChanged = (devices) => {
	trace(`found ${devices.length} device(s)\n`);
	for (const device of devices) {
		trace(`id=${device.id} kind=${device.kind}\n`);
		if (device.kind === "encoder") {
			device.onSample = (delta) => trace(`encoder delta=${delta}\n`);
		}
	}
};

try {
	await m5chain.start();
} catch (error) {
	trace(`startup failed: ${error}\n`);
	await m5chain.close();
}
```

From that application directory, build, flash, and open the debugger:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./manifest.json
```

The **xsbug debugger** shows `found 1 device(s)` and `id=1 kind=encoder`. Turn the Encoder to see
`encoder delta=...` messages. The initial encoder reading establishes the baseline; later changes produce deltas.
`trace()` output appears in the debugger, not the shell. The application keeps running after `start()` completes.

The manifest uses the moving `main` branch. For repeatable builds, use a published release tag when available;
see [installation options](docs/setup.md). This example includes all device modules for convenience, while
`deviceClasses` selects which connected devices this application recognizes.

## Choose an installation

| Use case | Start here |
| --- | --- |
| Standalone application | [Quick start](#quick-start) |
| Include only selected device modules | [Selective Git manifests](docs/setup.md#include-the-library-from-git) |
| Install a Mod into a shared Host | [Host and Mod setup](docs/setup.md#include-the-library-in-a-shared-mod-host) |
| Develop using a local checkout | [Local manifests](docs/setup.md#use-a-local-checkout-while-developing) |
| Run without M5Chain hardware | [Stream transport and simulator](docs/setup.md#inject-a-stream-transport-for-simulation) |

Atom Chain Base pins are supplied for supported M5Atom targets. Other targets default to their Grove-compatible
pins. Override `transmit` and `receive` in the constructor when needed; see [pin configuration](docs/setup.md#pin-configuration).

## Using devices

Include each required device manifest and register its class in `deviceClasses`. The array is required and may be
empty. A connected type that you did not register appears as `kind === "unknown"` and `known === false`.
Use `device.kind` to select the device API without a TypeScript cast.

- **Sampling:** set the target device's `onSample` handler to start reading it. `sample()` returns its latest cached
  value, or `undefined` before a sample is available; calling it does not communicate with the device. Clear the
  handler with `null` to stop sampling that device. See [sampling](docs/features/can-sample.md).
- **Key events:** use `onKeyEvent` for click/long-press events and `isKeyPressed()` for the current pressed state.
  Configure active key reporting when using events. See [key settings](docs/features/has-key.md).
- **LED output:** color channels and brightness are integers from `0` to `255`. Await operations such as
  `setLedColor()`; see [LED methods](docs/features/has-led.md).
- **Reconnection:** a re-scan replaces device instances. Attach handlers to the new instances inside
  `onDeviceListChanged`, as in the quick start. Old instances have `connected === false` and cannot access the bus.

Connection monitoring runs even when no device is being sampled. No connected chain is a successful empty scan;
check wiring, pins, and `deviceClasses` if the list is empty or contains only unknown devices.

## Errors and cleanup

Set `onError` before starting, and catch a rejected `start()` as shown above. Await and handle failures from
operations your application calls directly, such as `configure()` or `setLedColor()`.

| Method | Effect |
| --- | --- |
| `await m5chain.start()` | Scan and start monitoring; attach handlers to the returned device list through `onDeviceListChanged`. |
| `await m5chain.stop()` | Stop monitoring and sampling, disconnect current instances; a later `start()` creates new instances. |
| `await m5chain.close()` | Release the transport permanently; create another M5Chain instance to use the bus again. |

Call `await m5chain.close()` from your application's shutdown path. Do not close immediately after a successful
`start()` if you want to continue receiving events. Use `device.onDisconnected` to release resources associated
with a particular instance. See the [API and lifecycle reference](docs/api.md) for options, defaults, and events.

## Supported devices

| Device | Type ID | `HasLed` | `HasKey` | `CanSample` | Polled Sample (`onSample`) | Device Event Callback | API Guide |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder) | `0x0001` | Yes | Yes | Yes | Delta value | `onKeyEvent` | [Encoder API](docs/devices/encoder.md) |
| [Angle](https://docs.m5stack.com/en/chain/Chain_Angle) | `0x0002` | Yes | No | Yes | Normalized `0.00`-`1.00` | — | [Angle API](docs/devices/angle.md) |
| [Key](https://docs.m5stack.com/en/chain/Chain_Key) | `0x0003` | Yes | Yes | No | — | `onKeyEvent` | [Key API](docs/devices/key.md) |
| [JoyStick](https://docs.m5stack.com/en/chain/Chain_Joystick) | `0x0004` | Yes | Yes | Yes | `{ x, y }` in `-128` to `127` | `onKeyEvent` | [JoyStick API](docs/devices/joystick.md) |
| [ToF](https://docs.m5stack.com/en/chain/Chain_ToF) | `0x0005` | Yes | No | Yes | Distance in mm | — | [ToF API](docs/devices/tof.md) |
| [ChainBus](https://docs.m5stack.com/ja/arduino/projects/chain/chain_bus) | `0x0006` | Yes | No | No | — | `gpioN.onInterrupt` | [ChainBus API](docs/devices/chainbus.md) |
| [PIR](https://docs.m5stack.com/en/chain/Chain_PIR) | `0x0009` | Yes | No | Yes | Presence status | `onPresenceChanged` | [PIR API](docs/devices/pir.md) |
| [Buzzer](https://docs.m5stack.com/en/chain/Chain_Buzzer) | `0x000B` | Yes | No | No | — | — | [Buzzer API](docs/devices/buzzer.md) |
| [Mono](https://docs.m5stack.com/en/chain/Chain_Mono) | `0x000D` | No | No | No | — | — | [Mono API](docs/devices/mono.md) |
| [RGB](https://docs.m5stack.com/en/chain/Chain_RGB) | `0x000E` | No | No | No | — | — | [RGB API](docs/devices/rgb.md) |


## Examples and reference

From a checkout of this repository:

- [Standalone Host](examples/host): discover all supported devices.
- [Basic Mod](examples/basic): discovery, device information, and event handlers.
- [LED Mod](examples/led), [Buzzer Mod](examples/buzzer), [Matrix Mod](examples/matrix): output examples.
- [Simulator](examples/simulator): scan an in-memory device without hardware.

See [Host/Mod run commands](docs/setup.md#run-a-mod-example) and [simulator run commands](docs/setup.md#inject-a-stream-transport-for-simulation).

- [M5Chain API and lifecycle](docs/api.md)
- [Device API guides](docs/devices/README.md)
- [Shared LED, key, and sample APIs](docs/features/README.md)
- [Library development and custom devices](docs/development.md)

## License

MIT
