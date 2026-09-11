# Library development

For application usage, start with the [README](../README.md). This page covers library changes and custom devices.
Run the commands below from the repository root.

Format and lint:

```sh
npm run format
npm run lint
npm run typecheck
```

Type checking runs the same type tests against the Host implementation and the Mod declarations using
`tsconfig.mod.json`. It enables `noImplicitOverride` and `noUncheckedIndexedAccess`; packet and collection indexing must either validate the requested
entry or handle the possibility that it is absent.

Verify that the preloaded library does not retain mutable objects in RAM:

```sh
mcconfig -d -m -p esp32/m5atom_matrix -t build ./manifest.json
```

The XS linker output should contain no `not frozen` warnings for `m5chain`. Module-level lookup tables, exported
constant objects, and class command tables must remain frozen so preloaded instances can stay in flash. See
[Using XS Preload to Optimize Applications](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/preload.md).

## Type-safe device APIs

TypeScript rejects combining a custom `transport` with UART pins. Key settings belong to
`KeyDeviceConfiguration` and `KeyDeviceConfigurationSnapshot`, used only by key-capable devices.
Device-specific configuration types expose the settings accepted by that device. Fixed `DEVICE_TYPE` fields
are `static readonly`.

`withDeviceFeatures(...)` preserves the methods and sample types of the supplied mixins, so device classes
do not need a matching interface declaration to advertise those methods. Overrides must use `override`.

## Custom devices

In TypeScript, every registered class must implement the complete M5Chain runtime device contract in addition to its
static `DEVICE_TYPE`. Custom device implementations should extend `M5ChainDevice` from `m5chainDevice`; this provides
the required lifecycle, connection state, and common device API. A constructor that only declares `DEVICE_TYPE` is no
longer accepted as an `M5ChainDeviceClass`.

## Feature composition

Device classes compose features with `withDeviceFeatures(...)`.

```ts
import CanSample from "canSample";
import HasKey from "hasKey";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainEncoder extends withDeviceFeatures(HasLed, HasKey, CanSample<number>()) {
	// Device-specific implementation.
}
```

The order matters when a feature depends on commands from the composed class. Existing device classes should be used as the reference pattern.

## Transport internals

UART requests are serialized. An uncontended request starts immediately; overlapping requests are queued with their
payload copied so later changes to the shared command buffer cannot affect them. The writable stream supplies
backpressure, and the UART adapter writes packets in chunks as output space becomes available.

## Sample implementation hooks

Pass the sample value type when composing a device class.

```ts
import CanSample from "canSample";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainAngle extends withDeviceFeatures(HasLed, CanSample<number>()) {
	override async readSample(): Promise<number> {
		// Replace with this device's UART sample read.
		throw new Error("Implement the device sample read");
	}
}
```

The sample type belongs to the composed feature and its runtime hooks. Callers invoke `readSample()` without a type
argument, so its result and the value accepted by `dispatchOnSample()` cannot drift apart.

| Hook | Description |
| --- | --- |
| `device.hasOnSample()` | Returns whether a sample callback is registered. |
| `await device.readSample()` | Device implementation hook. Reads from the bus and returns a value to store as the latest sample, or `undefined` to skip dispatch. |
| `device.dispatchOnSample(value)` | Stores `value` as the latest sample and passes it to the registered `onSample` handler. Object samples are passed as shallow copies. |

## LED implementation

`HasLed` contributes RGB command IDs under `CMD.RGB`. It expects the composed device class to provide `id`, `bus`, and the base command contract from `M5ChainDevice`.

The implementation validates LED indexes, LED counts, RGB channel values, brightness, and `saveToFlash` before sending commands to the bus.

