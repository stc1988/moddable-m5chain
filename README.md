# moddable-m5chain

`moddable-m5chain` is a Moddable SDK module for controlling M5Chain devices over UART.  
It handles device enumeration, initialization, event dispatch, and polling.

## Device Capability Matrix

| Device | Type ID | `HasLed` | `HasKey` | `CanPoll` | Key Event (`onKeyPressed`) | Poll Event (`onPoll`) | Device-specific API |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder) | `0x0001` | Yes | Yes | Yes | Yes | Yes (delta value) | See [Encoder](#encoder-m5chainencoder) |
| [Angle](https://docs.m5stack.com/en/chain/Chain_Angle) | `0x0002` | Yes | No | Yes | No | Yes (normalized `0.00`-`1.00`) | See [Angle](#angle-m5chainangle) |
| [Key](https://docs.m5stack.com/en/chain/Chain_Key) | `0x0003` | Yes | Yes | No | Yes | No | See [Key](#key-m5chainkey) |
| [JoyStick](https://docs.m5stack.com/en/chain/Chain_Joystick) | `0x0004` | Yes | Yes | Yes | Yes | Yes (`{ x, y }` in `-128` to `127`) | See [JoyStick](#joystick-m5chainjoystick) |
| [ToF](https://docs.m5stack.com/en/chain/Chain_ToF) | `0x0005` | No | No | No | No | No | See [ToF](#tof-m5chaintof) |

## Features

- Packet transport and matching (`sendPacket` / `sendAndWait`)
- Automatic scan on startup
- Automatic re-scan when `ENUM_PLEASE (0xFC)` is received (debounced)
- Feature composition with mixins (LED, Key, Poll)
- Poll loop runs only when at least one device has `onPoll` set

## Setup

### 1) Include this module in your manifest

In your app's `manifest.json`, include this module's manifest.

```json
{
	"include": [
		{
			"git":"https://github.com/stc1988/moddable-m5chain.git",
			"manifest":"./src/m5chain/manifest.json"
		}
	]
}
```

### 2) Pin configuration

For M5Stack products, the default UART pins are set to the Grove port.

If you use an M5Atom series device with  [Atom Chain Base](https://docs.m5stack.com/ja/accessory/Atomic_ToChain_Base), including
`./src/m5chain/manifest.json` automatically provides a `config.m5chain` pin configuration.

See [Minimal Usage](#minimal-usage) for the concrete usage pattern.


## Minimal Usage

```js
import M5Chain from "m5chain";
import config from "mod/config";

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

### `device.onKeyPressed = (status) => {}`

Available on devices with `HasKey` (Encoder / Key / JoyStick).

- `0`: single click
- `1`: double click
- `2`: long press

### `device.onPoll = (value) => {}`

Available on devices with `CanPoll` (Encoder / Angle / JoyStick).  
If any device has `onPoll` set, bus polling starts. It stops when all `onPoll` handlers are `null`.

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

Available on: Encoder / Angle / Key / JoyStick

- `await device.setLedColor(r, g, b)` (single-LED wrapper provided by each device class)
- `await device.getLedColor() -> { r, g, b }`
- `await device.setLedBrightness(brightness, saveToFlash = 0)`
- `await device.getLedBrightness()`

### Key Features (`HasKey`)

Available on: Encoder / Key / JoyStick

- `await device.getKeyStatus()`
- `await device.setKeyTriggerInterval(doubleClick, longPress)`
- `await device.getKeyTriggerInterval() -> { doubleClick, longPress }`
- `await device.setKeyMode(mode)` (`0`: non-active, `1`: active report)
- `await device.getKeyMode()`
- `device.onKeyPressed = (status) => {}`

### Poll Features (`CanPoll`)

Available on: Encoder / Angle / JoyStick

- `device.onPoll = (value) => {}`

`value` by device type:

- Encoder: delta from previous value (`number`)
- Angle: normalized value (`0.00` - `1.00`)
- JoyStick: `{ x, y }` (`-128` - `127`)

### Device-specific APIs

See the dedicated [Device-specific APIs](#device-specific-apis) section below.

## Device-specific APIs

### [Encoder](https://docs.m5stack.com/en/chain/Chain_Encoder) (`M5ChainEncoder`)

- `await device.getEncoderValue()`
- `await device.getEncoderIncValue()`
- `await device.resetEncoderValue()`
- `await device.resetEncoderIncValue()`
- `await device.setEncoderABDirect(direct, saveToFlash = 0)`
- `await device.getEncoderABDirect()`

### [Angle](https://docs.m5stack.com/en/chain/Chain_Angle) (`M5ChainAngle`)

- `await device.getAngle12Adc()`
- `await device.getAngle12Deg()`
- `await device.getAngle12value()`
- `await device.getAngle8Adc()`
- `await device.setAngleRotationDirection(direction)`
- `await device.getAngleRotationDirection()`

### [Key](https://docs.m5stack.com/en/chain/Chain_Key) (`M5ChainKey`)

No additional device-specific methods.  
Use Common Device API + `HasLed` + `HasKey` APIs.

### [JoyStick](https://docs.m5stack.com/en/chain/Chain_Joystick) (`M5ChainJoyStick`)

- `await device.getJoystick16Adc() -> { x, y }`
- `await device.getJoystick8Adc() -> { x, y }`
- `await device.getJoystickMappedRange() -> { xMin, xMax, yMin, yMax }`
- `await device.setJoystickMappedRange(xMin, xMax, yMin, yMax)`
- `await device.getJoystickMappedInt16Value() -> { x, y }`
- `await device.getJoystickMappedInt8Value() -> { x, y }`

### [ToF](https://docs.m5stack.com/en/chain/Chain_ToF) (`M5ChainToF`)

Currently only the common device API is implemented.

## Packet Format (Summary)

- Header: `0xAA 0x55`
- Length: 2 bytes (little-endian)
- Payload: `id`, `cmd`, `data...`, `crc8`
- Footer: `0x55 0xAA`

`sendAndWait(id, cmd, ...)` resolves only when both `id` and `cmd` match.

## Examples

- `examples/basic`: device discovery, info read, and event subscription
- `examples/led`: LED control for Encoder/Angle/Key/JoyStick

## Development

Format and lint:

```sh
npm run format
npm run lint
```

## License

MIT
