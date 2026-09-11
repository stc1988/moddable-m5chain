# M5Chain API and lifecycle

[Quick start](../README.md#quick-start) · [Device guides](devices/README.md) · [Shared features](features/README.md)

## M5Chain

- `new M5Chain({ deviceClasses, transmit, receive, transport, debug = false, pollingInterval = 30, connectionCheckInterval = 1000 })`
  - `pollingInterval` and `connectionCheckInterval` must be non-negative finite numbers.
  - `transport` is an optional `M5ChainTransport` stream pair for simulation or custom I/O; it is mutually exclusive
    with `transmit` and `receive`.
- `await m5chain.start()` scans the chain and rejects if enumeration fails; no connected chain is a successful empty scan
- `await m5chain.stop()` stops polling, disconnects current device instances, and allows a later `start()`
- `await m5chain.close()` stops the chain and closes UART permanently
- `m5chain.closed`
- `m5chain.devices` read-only snapshot of the current device array

## Common Device API (`M5ChainDevice`)

- `device.id`
- `device.kind` human-readable device type (`encoder`, `angle`, `key`, `joystick`, `tof`, `pir`, `buzzer`, `mono`, `rgb`, or `unknown`)
- `device.type` numeric device type ID used by the M5Chain protocol
- `device.known` (`false` for device types not registered in this instance's `deviceClasses`, including unsupported types)
- `device.connected`
- `device.uuid` (`undefined` until `init()` completes)
- `await device.configure(options)` applies device and feature settings
- `await device.readConfiguration()` reads current device and feature settings from the chain device
- `await device.getUID(uidType = 1)` (`uidType: 0 | 1`)
- `await device.getBootloaderVersion()`
- `await device.getFirmwareVersion()`

Unknown device types remain in the device list as `M5ChainUnknownDevice`. They expose the common device API, allowing
applications to keep using recognized devices on the same chain and to report unsupported type IDs.

`M5Chain` derives its connected-device union from the classes passed in `deviceClasses`, plus `UnknownDevice`. The
`RegisteredM5ChainDevice`, `M5ChainDeviceClass`, `M5ChainDeviceLike`, and generic `M5ChainOptions` types are exported from
`m5chain`. These application-facing types omit bus transport, initialization, event dispatch, and polling hooks used by
device implementations. The `m5chainDevices` all-device aggregate also exports its inferred `M5ChainDevice` union.

## LED Features (`HasLed`)

Available on: Encoder / Angle / Key / JoyStick / ToF / PIR / Buzzer

RGB channels and LED brightness use integers from `0` to `255`; operations remain asynchronous.
Brightness previously used `0` to `1`: migrate `0.5` to `128` and `1` to `255`, including matrix brightness settings.
See [HasLed API](features/has-led.md).

## Key Features (`HasKey`)

Available on: Encoder / Key / JoyStick

See [HasKey API](features/has-key.md).

## Sample Features (`CanSample`)

Available on: Encoder / Angle / JoyStick / ToF / PIR

See [CanSample API](features/can-sample.md).

## Events

### `m5chain.onDeviceListChanged = (devices) => {}`

- Called after the initial scan completes in `start()`
- Called again after re-scan when the chain sends `ENUM_PLEASE` or connection monitoring detects a topology change
- Also called when polling removes a failed device, and with an empty list when an active chain stops
- `devices` is the current connected device list

### `device.onDisconnected = () => {}`

- Called before a disconnected device instance is removed or replaced during re-scan
- Works for devices without `onSample`, such as Key, through connection monitoring
- The disconnected instance has `device.connected === false` and can no longer access the bus
- Set to `null` to remove the handler

### `m5chain.onError = (error, context) => {}`

Reports scan failures, device initialization failures, transport failures, synchronous exceptions, and rejected
promises from application callbacks. `context.source` identifies the failure kind; device-specific failures also
provide `context.device`.

An initial scan protocol failure also rejects `start()` so application startup can fail explicitly. A heartbeat timeout
with no connected chain remains a successful scan with an empty device list. Background re-scan failures are reported
through `onError` without stopping connection monitoring.

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

The handler may return a promise. Rejections are reported through `m5chain.onError` with
`context.source === "sample"`.

`device.sample()` remains available as a synchronous accessor for the latest cached sample.

Angle, JoyStick, ToF, and PIR dispatch `onSample` with the newly acquired value on every poll. Encoder dispatches `onSample` with the delta from the previous encoder value and skips dispatch while the value is unchanged.

### `pir.onChanged = (status) => {}`

Available on Chain PIR. When PIR report mode is enabled, the device sends a change-driven event with
`PIR_STATUS.NO_PERSON` or `PIR_STATUS.PERSON_DETECTED`. See the [PIR API](devices/pir.md).

### Sample-read failures

Polling failures are tracked per device. A device is removed from the current list after three consecutive sample-read
failures without disconnecting other responsive devices.

## Register all supported devices

When using the all-device manifest, import `M5CHAIN_DEVICE_CLASSES` from `m5chainDevices` and pass it as
`deviceClasses`. The registry is copied at construction; duplicate type IDs are rejected.
