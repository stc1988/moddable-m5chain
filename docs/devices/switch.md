# Switch API

M5Stack documentation: [Chain Switch](https://docs.m5stack.com/en/chain/Chain_Switch)

Official driver: [M5Stack M5Chain ChainSwitch](https://github.com/m5stack/M5Chain/tree/main/src/ChainSwitch)

## TypeScript Exports

```ts
import M5ChainSwitch, {
	SWITCH_DIRECTION,
	SWITCH_REPORT_MODE,
	SWITCH_STATUS,
	type SwitchChangeHandler,
	type SwitchConfiguration,
	type SwitchConfigurationSnapshot,
	type SwitchDirection,
	type SwitchReportMode,
	type SwitchStatus,
	type SwitchThresholds,
} from "m5chainSwitch";
```

| Export | Description |
| --- | --- |
| `M5ChainSwitch` | Default class export. |
| `SWITCH_DIRECTION` | Down-to-up slider direction: `DOWN_TO_UP_DECREASES = 0`, `DOWN_TO_UP_INCREASES = 1`. |
| `SWITCH_STATUS` | Threshold-derived state: `CLOSED = 0`, `OPEN = 1`. |
| `SWITCH_REPORT_MODE` | Automatic report settings: `DISABLED = 0`, `ENABLED = 1`. |
| `SwitchConfiguration` | Type accepted by `configure()`. |
| `SwitchConfigurationSnapshot` | Type returned by `readConfiguration()`. |
| `SwitchChangeHandler` | Handler type used by `onSwitchChanged`. |

## Capabilities

- Common device API
- LED API
- Sample API
- Automatic open/close events

## Usage

Register this class in `deviceClasses`. Use the following inside an async `onDeviceListChanged` handler
while iterating its `devices` list; see the [complete pattern](README.md#import-pattern).

```ts
import M5ChainSwitch, { SWITCH_REPORT_MODE, SWITCH_STATUS } from "m5chainSwitch";

if (device.kind === "switch") {
	const switchDevice = device;

	await switchDevice.configure({ reportMode: SWITCH_REPORT_MODE.ENABLED });
	switchDevice.onSample = (position) => trace(`slider=${position}\n`);
	switchDevice.onSwitchChanged = (status) => {
		trace(`open=${status === SWITCH_STATUS.OPEN}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getSwitch12Adc()` | Reads the 12-bit slider position (`0` to `4095`). |
| `await device.getSwitch8Adc()` | Reads the mapped 8-bit slider position (`0` to `255`). |
| `await device.getSwitchStatus()` | Reads `SWITCH_STATUS.CLOSED` or `SWITCH_STATUS.OPEN`. |
| `await device.isOpen()` | Returns `true` while the threshold-derived state is open. |
| `await device.configure(options)` | Applies direction, threshold, and report-mode configuration. |
| `await device.readConfiguration()` | Reads the current direction, thresholds, and report mode. |

## Configuration

| Option | Description |
| --- | --- |
| `direction` | Selects whether the ADC value increases or decreases while moving the slider from down to up. |
| `thresholds` | Sets `{ open, close }` 12-bit ADC thresholds. `open` must be greater than `close`. Device defaults are `3967` and `80`. |
| `reportMode` | Enables or disables automatic open/close reports. |
| `saveToFlash` | Persists `direction` and/or `thresholds` when `true`. It requires either setting in the same call and defaults to `false`. |

Saving to flash requires a page erase. Avoid setting `saveToFlash` on frequent configuration updates because repeated writes reduce device flash life.

## Sample Value

`onSample` receives the latest 12-bit slider position (`0` to `4095`) on every poll. `sample()` returns the latest cached value.
Use `onSwitchChanged` when threshold-driven automatic reports are preferable to periodic polling.
