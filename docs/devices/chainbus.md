# ChainBus Unit Design Proposal

This document defines the requirements and proposed public API for supporting the
[M5Stack ChainBus Unit](https://docs.m5stack.com/ja/arduino/projects/chain/chain_bus). It is a design proposal, not
documentation for an implemented device class.

The protocol reference used by this proposal is
[M5Stack Unit ChainBus Protocol V1](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1201/M5Stack-Unit-ChainBus-Protocol-EN.pdf),
dated November 13, 2025.

## Role in M5Chain

Despite its name, a ChainBus Unit does not create another M5Chain UART transport. It is one node on the existing
M5Chain and is enumerated with device type `0x0006`. The unit provides remote access to an I2C bus, two GPIO pins,
12-bit ADC input, GPIO edge events, and one RGB LED.

The implementation should therefore add a regular device class:

| Property | Proposed value |
| --- | --- |
| Class | `M5ChainChainBus` |
| Module | `m5chainChainBus` |
| `DEVICE_TYPE` | `0x0006` |
| `kind` | `"chainbus"` |
| Shared feature | `HasLed` |

The existing `M5Chain` instance continues to own the UART, framing, CRC validation, request serialization,
enumeration, connection monitoring, and error reporting. No raw UART or second transport is exposed for this device.

## Proposed Public API

The API groups operations by the remote resource they control. Applications do not pass protocol pin identifiers;
`gpio1` and `gpio2` bind those identifiers when the device is constructed.

```ts
import M5ChainChainBus, {
	type ChainBusGPIOConfiguration,
	type ChainBusGPIOEdge,
	type ChainBusGPIOMode,
	type ChainBusGPIOPull,
	type ChainBusI2CFrequency,
} from "m5chainChainBus";

if (device.kind === "chainbus") {
	const chainBus = device;

	await chainBus.i2c.configure({ frequency: 400_000 });
	const addresses = await chainBus.i2c.scan();
	const id = await chainBus.i2c.readRegister(0x44, 0x89, 1, 6);

	await chainBus.gpio1.configure({ mode: "output", drive: "push-pull", pull: "none" });
	await chainBus.gpio1.write(true);

	chainBus.gpio2.onInterrupt = (edge) => trace(`gpio2 ${edge}\n`);
	await chainBus.gpio2.configure({ mode: "interrupt", pull: "up", edge: "falling" });
}
```

All hardware operations are asynchronous. A successful setter resolves with `void`; a read resolves with its value.
Protocol operation status bytes are not part of the public API.

### I2C

```ts
type ChainBusI2CFrequency = 100_000 | 400_000;

interface ChainBusI2C {
	configure(options: { frequency: ChainBusI2CFrequency }): Promise<void>;
	read(address: number, length: number): Promise<Uint8Array>;
	write(address: number, data: Uint8Array): Promise<void>;
	readRegister(address: number, register: number, registerAddressSize: 1 | 2, length: number): Promise<Uint8Array>;
	writeRegister(address: number, register: number, registerAddressSize: 1 | 2, data: Uint8Array): Promise<void>;
	scan(): Promise<readonly number[]>;
}
```

- `configure()` must be called before the other I2C operations. Reconfiguration replaces the current I2C frequency.
- `address` is a 7-bit I2C address from `0x00` through `0x7F`.
- Read and write data lengths are integers from 1 through 64 bytes. The protocol uses a one-byte length field but
  explicitly limits I2C transfers to 64 bytes.
- `registerAddressSize` selects the protocol's 8-bit or 16-bit register-address form. A one-byte register must be in
  `0x00` through `0xFF`; a two-byte register must be in `0x0000` through `0xFFFF`. The register is encoded low byte
  first as required by the protocol.
- `scan()` returns the reported addresses in wire order as a new read-only array.
- The library does not emulate repeated starts, SMBus operations, or an ECMA-419 `I2C` instance. Those semantics are
  not described by the ChainBus Unit protocol.

### GPIO and ADC

```ts
type ChainBusGPIOMode = "none" | "output" | "input" | "interrupt" | "analog" | "i2c";
type ChainBusGPIOPull = "up" | "down" | "none";
type ChainBusGPIODrive = "push-pull" | "open-drain";
type ChainBusGPIOEdge = "rising" | "falling";

type ChainBusGPIOConfiguration =
	| { mode: "output"; drive?: ChainBusGPIODrive; pull?: ChainBusGPIOPull }
	| { mode: "input"; pull?: ChainBusGPIOPull }
	| { mode: "interrupt"; pull?: ChainBusGPIOPull; edge: ChainBusGPIOEdge | "both" }
	| { mode: "analog" };

interface ChainBusGPIO {
	readonly number: 1 | 2;
	onInterrupt: ((edge: ChainBusGPIOEdge) => void | Promise<void>) | null;
	configure(options: ChainBusGPIOConfiguration): Promise<void>;
	readMode(): Promise<ChainBusGPIOMode>;
	write(value: boolean): Promise<void>;
	readOutput(): Promise<boolean>;
	read(): Promise<boolean>;
	readAnalog(): Promise<number>;
}
```

- Each GPIO has one active mode. Configuring it for output, input, interrupt, or analog replaces its previous mode.
- `drive` defaults to `"push-pull"` and `pull` defaults to `"none"`.
- `write()` and `readOutput()` require output mode. `read()` requires input mode. `readAnalog()` requires analog mode.
  A device operation-status value indicating a mode mismatch rejects the promise.
- `readAnalog()` returns the raw 12-bit ADC value from 0 through 4095. The documented reference voltage is 3.3 V;
  voltage conversion is left to the application because the protocol does not provide calibration data.
- `readMode()` maps the work-status response to `"none"`, `"output"`, `"input"`, `"interrupt"`, `"analog"`, or
  `"i2c"`. It reads the device and does not return a locally cached assumption.
- Command `0xE0` reports the GPIO and actual edge. The implementation dispatches it only to that GPIO's
  `onInterrupt` handler. A handler may return a promise; rejection is reported through `m5chain.onError` with
  `context.source === "deviceEvent"`.
- `onInterrupt` does not itself change the hardware mode. Set the handler before configuring interrupt mode to avoid
  missing an event. Setting it to `null` stops application delivery but does not reconfigure the remote pin.

The unit has one RGB LED and should compose the existing `HasLed` feature. Public color and brightness values remain
integers from 0 through 255. Brightness conversion to and from the protocol's 0-through-100 scale follows the existing
[HasLed API](../features/has-led.md); LED state is not part of device configuration.

## Device Configuration and State

The resource objects are the primary API. `configure()` provides an optional startup convenience without introducing
another behavior:

```ts
type ChainBusConfiguration = {
	i2c?: { frequency: ChainBusI2CFrequency };
	gpio1?: ChainBusGPIOConfiguration;
	gpio2?: ChainBusGPIOConfiguration;
};

type ChainBusConfigurationSnapshot = {
	gpio1: { mode: ChainBusGPIOMode };
	gpio2: { mode: ChainBusGPIOMode };
};
```

`device.configure(options)` applies `i2c`, `gpio1`, then `gpio2` in that order and stops at the first failure. It is
not transactional and does not roll back earlier successful operations. Unknown keys are rejected consistently with
the other device classes.

`device.readConfiguration()` uses command `0x70` and returns the two observable working modes. It does not return the
I2C frequency, GPIO pull, output drive, interrupt edge, output level, or LED state because the protocol cannot query
all of those settings. An `"i2c"` mode reports that a pin is owned by the shared I2C function; it does not prove which
frequency is active.

The library must not restore modes, output values, interrupt settings, or I2C initialization after a disconnect.
Re-enumeration replaces the device instance, as it does for every other M5Chain device. Applications reattach handlers
and reapply configuration in `onDeviceListChanged`. Events received for an old or disconnected instance are not
delivered to that instance.

## Protocol Mapping

| Command | Protocol operation | Proposed API |
| --- | --- | --- |
| `0x10` | Initialize I2C | `i2c.configure()` |
| `0x11` | Raw I2C read | `i2c.read()` |
| `0x12` | Raw I2C write | `i2c.write()` |
| `0x13` | I2C register read | `i2c.readRegister()` |
| `0x14` | I2C register write | `i2c.writeRegister()` |
| `0x15` | List connected I2C addresses | `i2c.scan()` |
| `0x20` / `0x21` | Set/get RGB values | `HasLed` color methods |
| `0x22` / `0x23` | Set/get RGB brightness | `HasLed` brightness methods |
| `0x30` | Configure GPIO output | `gpioN.configure({ mode: "output" })` |
| `0x31` | Set GPIO output level | `gpioN.write()` |
| `0x32` | Get GPIO output level | `gpioN.readOutput()` |
| `0x40` | Configure GPIO input | `gpioN.configure({ mode: "input" })` |
| `0x41` | Read GPIO input level | `gpioN.read()` |
| `0x50` | Configure GPIO interrupt | `gpioN.configure({ mode: "interrupt" })` |
| `0x60` | Configure ADC | `gpioN.configure({ mode: "analog" })` |
| `0x61` | Read ADC | `gpioN.readAnalog()` |
| `0x70` | Read both GPIO working modes | `readConfiguration()` / `gpioN.readMode()` |
| `0xE0` | Unsolicited GPIO edge event | `gpioN.onInterrupt` |

The common commands for UID, bootloader version, firmware version, device type, enumeration, heartbeat, and reset are
already handled by the base device and `M5Chain`; they are not reimplemented by `M5ChainChainBus`.

## Implementation Requirements

- The device implementation uses the existing `ChainBus.sendAndWait()` request path. It must not read from or write
  to `embedded:io/serial` directly.
- Numeric inputs, enum-like string values, buffer types, buffer lengths, and incompatible configuration fields are
  validated before a packet is queued. Request payloads must fit the existing `maxPayloadSize` limit.
- Responses are validated before any payload byte is read. Validation covers device ID and command matching through
  the core request path, expected minimum or exact length, operation status where present, count-dependent length,
  GPIO number, edge value, work-status values, and 12-bit ADC range.
- Multi-byte register addresses and ADC values follow the protocol's little-endian representation.
- Operation status `1` means success. Status `0` rejects as an operation failure and status `2` rejects as a mode
  mismatch. Missing, undocumented, or otherwise invalid status values reject as malformed responses.
- Variable-length I2C responses return newly allocated `Uint8Array` values rather than a view into the shared receive
  or command buffers.
- Commands remain serialized with all other M5Chain traffic. I2C and GPIO objects do not add independent queues or
  permit concurrent wire operations.
- The implementation should keep protocol conversion and validation in a device-specific protocol module, following
  the existing Buzzer, matrix, and PIR patterns.

## Protocol Ambiguities

The source documents contain details that an implementation must resolve conservatively:

- Several response-length cells show alternatives such as `(0x04 + length) / 0x04`. The implementation should derive
  the exact length from the successful response shape and reject both truncated data and unexplained trailing data.
- Most commands return an operation status, while RGB brightness read (`0x23`) and work-status read (`0x70`) do not.
  Status parsing must therefore be defined per command rather than assumed globally.
- Interrupt configuration supports `"both"`, but an interrupt event reports only `"rising"` or `"falling"`.
- The work-status command reports only the active function, not its detailed configuration. The library must not fill
  missing fields from stale local state.
- The protocol describes a maximum packet length of 256 bytes and maximum I2C transfer length of 64 bytes. The lower
  I2C limit governs the public I2C methods even when the transport has room for a larger payload.

## Integration Requirements for a Future Implementation

A complete implementation must add the device runtime module and declaration-only Host/Mod surface, a public device
manifest, the all-device manifest entry, and the inferred `m5chainDevices` union. It must also update the supported
device tables in the main README and [Device API Guides](README.md). Preloaded constants and command tables must remain
frozen.

The API deliberately does not copy the Arduino library's pointer-based status/result interface. Promise resolution,
typed values, resource-specific objects, and exceptions match this library's existing TypeScript-facing conventions
while preserving every operation exposed by the device protocol.

## Validation and Acceptance Criteria

Protocol tests using an injected stream transport must cover:

- Every command in the mapping table with a valid response.
- Operation failure, mode mismatch, unknown status, truncated response, excess response data, and invalid returned
  enum values.
- I2C transfer lengths 1 and 64, rejection of 0 and 65, 8-bit and 16-bit register addresses, address scan results,
  and copied return buffers.
- Each GPIO mode transition and rejection of operations in the wrong mode.
- Digital low/high values, ADC values 0 and 4095, invalid ADC values, and little-endian decoding.
- Rising, falling, and both-edge configuration; event routing to GPIO 1 versus GPIO 2; async handler rejection; and
  suppression after disconnect.
- Disconnect and re-enumeration, including creation of a new instance without retained handlers or assumed hardware
  configuration.
- Interaction with polling and connection checks to confirm all requests still use the shared serialized queue.

Type tests must cover `kind` narrowing, the resource interfaces, configuration discriminated unions, callback types,
and Host/Mod declaration parity. Manifest validation must cover both standalone Host and Mod builds and inspect the
flattened manifests for the new runtime and preload entries.

The simulator can verify framing, validation, request ordering, state-independent behavior, and event dispatch. Real
hardware validation is still required for 100/400 kHz I2C operation, electrical pull and drive behavior, actual ADC
accuracy and reference voltage, interrupt timing, hot swapping, and mixed-device chains.

Implementation is acceptable only when all protocol operations are reachable through the proposed API, malformed or
failed responses cannot be mistaken for valid values, existing M5Chain devices remain unaffected, and the hardware-
only gaps above are explicitly reported with the test results.
