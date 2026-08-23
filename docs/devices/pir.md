# PIR API

M5Stack documentation: [Chain PIR](https://docs.m5stack.com/en/chain/Chain_PIR)

Protocol: [Chain PIR Communication Protocol](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1261/M5Stack-Chain-PIR-Protocol-V1_EN.pdf)

## TypeScript Exports

```ts
import M5ChainPIR, {
	PIR_REPORT_MODE,
	PIR_STATUS,
	type PIRConfiguration,
	type PIRConfigurationSnapshot,
	type PIRPresenceHandler,
	type PIRReportMode,
	type PIRStatus,
} from "m5chainPIR";
```

| Export | Description |
| --- | --- |
| `M5ChainPIR` | Default class export. |
| `PIR_STATUS` | Detection values: `NO_PERSON = 0`, `PERSON_DETECTED = 1`. |
| `PIR_REPORT_MODE` | Automatic report settings: `DISABLED = 0`, `ENABLED = 1`. |
| `PIRConfiguration` | Type accepted by `configure()`. |
| `PIRConfigurationSnapshot` | Type returned by `readConfiguration()`. |
| `PIRPresenceHandler` | Handler type used by `onPresenceChanged`. |

## Capabilities

- Common device API
- LED API
- Sample API
- Automatic presence-change events

## Usage

```ts
import M5ChainPIR, { PIR_REPORT_MODE, PIR_STATUS } from "m5chainPIR";

if (device.type === M5ChainPIR.DEVICE_TYPE) {
	const pir = device as M5ChainPIR;

	await pir.configure({
		reportMode: PIR_REPORT_MODE.ENABLED,
		holdSeconds: 5,
	});

	pir.onPresenceChanged = (status) => {
		const detected = status === PIR_STATUS.PERSON_DETECTED;
		trace(`person detected=${detected}\n`);
	};
}
```

The device reports each PIR state change when report mode is enabled. According to the protocol, report mode is enabled by default.

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.configure(options)` | Applies PIR report-mode and hold-time configuration. |
| `await device.readConfiguration()` | Reads the current PIR configuration. |
| `await device.getPresenceStatus()` | Reads `PIR_STATUS.NO_PERSON` or `PIR_STATUS.PERSON_DETECTED`. |
| `await device.isPersonDetected()` | Returns `true` while the PIR reports a detected person. |

## Configuration

| Option | Description |
| --- | --- |
| `reportMode` | Enables or disables automatic presence-change reports. |
| `holdSeconds` | Keeps the detected state for `0` to `255` seconds. The device default is 5 seconds. |
| `saveToFlash` | Persists `holdSeconds` when `true`. It requires `holdSeconds` in the same call and defaults to `false`. |

Saving to flash requires a page erase. Avoid setting `saveToFlash` on frequent configuration updates because repeated writes reduce device flash life.

## Sample Value

`onSample` receives the latest `PIRStatus` on every poll. `sample()` returns the latest cached value. Use
`onPresenceChanged` when the device's change-driven automatic report is preferable to periodic polling.
