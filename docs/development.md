# Library development

For application usage, start with the [README](../README.md). This page covers library changes and custom devices.
Run the commands below from the repository root.

## Contribution policy

- Optimize the public API for application developers while keeping the implementation maintainable.
- Do not make a breaking public API change unless it is explicitly requested or clearly justified by the task.
  Update affected documentation and examples and describe the migration.
- Update public documentation and examples when a public API or observable behavior changes. Internal-only changes do
  not require unrelated documentation edits.
- Preserve the stable public manifest entry points under `manifests/`; files under `src/m5chain/` are internal.
- Keep changes focused and organize commits into clean, sensible units.

## Validation

For library implementation, type, or manifest changes, run:

```sh
npm run format
npm run lint
npm test
npm run typecheck
mcconfig -dn -m -p esp32/m5atom_matrix -t build ./examples/manifest.json
mcrun -dn -m -p esp32/m5atom_matrix -t build ./examples/basic/manifest.json
```

Type checking runs the same type tests against the Host implementation and the Mod declarations using
`tsconfig.mod.json`. It enables `noImplicitOverride` and `noUncheckedIndexedAccess`; packet and collection indexing must either validate the requested
entry or handle the possibility that it is absent.

The Host build's XS linker output should contain no `not frozen` warnings for `m5chain`. Module-level lookup tables, exported
constant objects, and class command tables must remain frozen so preloaded instances can stay in flash. See
[Using XS Preload to Optimize Applications](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/preload.md).

Documentation-only and web-only changes do not require unrelated device builds. Run the formatter, linter, tests, and
builds relevant to the affected files, and report hardware behavior that remains unverified.

## Host and Mod type boundary

The stable public entry points are `manifests/host.json`, `manifests/mod-base.json`, `manifests/mod-all.json`, and the
files under `manifests/devices/`. They include internal manifests under `src/m5chain/`, which may move as the
implementation evolves.

The Host owns the core runtime. `src/m5chain/manifest_host.json` maps `m5chain`, `m5chainDevice`, and `types` to the
implementation sources. Mods compile against the Host-owned runtime through declaration-only mappings in
`src/m5chain/manifest_mod_base.json` and `src/m5chain/typings/`.

Keep these two type surfaces synchronized:

- Changes to `src/m5chain/types.ts` must be reflected in `src/m5chain/typings/types.d.ts`.
- Public API changes to `src/m5chain/m5chain.ts` or `src/m5chain/m5chainDevices/m5chainDevice.ts` must be reflected in
  the corresponding declaration under `src/m5chain/typings/`.
- Do not add runtime behavior under `src/m5chain/typings/`.
- Validate both the Host application and a Mod after changing either surface.

## Bus and transport architecture

`M5Chain` consumes an `M5ChainTransport` containing a `ReadableStream<Uint8Array>` and a
`WritableStream<Uint8Array>`. Without an injected transport, `serialTransport.ts` adapts ECMA-419 Serial callbacks to
that stream pair. The writable stream provides UART FIFO backpressure.

Keep frame buffering, validation, request matching, and device-event dispatch in `M5Chain`. A readable transport may
split a frame across arbitrary chunks or combine multiple frames in one chunk. Each chunk must be a `Uint8Array`;
`M5Chain` reconstructs frames from the byte stream. `M5Chain.close()` invokes the optional transport close hook,
cancels or aborts the streams, and releases their locks.

Packets use an `AA 55` header, a two-byte little-endian length, `id`, `cmd`, payload data, CRC8, and a `55 AA` footer.
A pending request is completed only by a response matching both its device ID and command, plus any request-specific
matcher. UART requests are serialized; queued request payloads are copied before later writes can reuse the shared
command buffer.

## Device creation and sampling

Applications select supported device classes with the required `deviceClasses` option. The registry is copied during
construction, and unregistered device types become `UnknownDevice`. LED, key, and sampling behavior is composed with
`withDeviceFeatures(...)`; Mono and RGB share the matrix-display base class.

Public sample-capable APIs use `onSample` and synchronous `sample()` terminology. UART sampling remains internal to
the poll loop through `readSample()`. Angle, JoyStick, ToF, and PIR dispatch every successfully read value. Encoder
dispatches only when its value changes and exposes the delta from the previous value. Internal scheduling may retain
poll terminology such as `pollingInterval`.

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
