# ENV API

M5Stack documentation: [Chain ENV](https://docs.m5stack.com/en/chain/Chain_ENV).
Reference: [official Chain ENV driver](https://github.com/m5stack/M5Chain/tree/main/src/ChainENV).

Include `manifests/devices/env.json` and register `M5ChainENV` from `m5chainENV`,
or use the all-device manifest and registry. ENV is type `0x000F`, with `kind === "env"`.
It provides the common device API, one RGB LED, sampling, and warning reports.

## Reading sensors

```ts
import M5ChainENV, { ENV_RATE, ENV_REPORT_MODE } from "m5chainENV";

// Inside onDeviceListChanged, after registering M5ChainENV in deviceClasses:
if (device.kind === "env") {
	await device.configure({ pressureRate: ENV_RATE.HZ_4, reportMode: ENV_REPORT_MODE.ALL });
	device.onSample = (value) => {
		trace(`${value.temperature} °C, ${value.humidity} %, ${value.pressure} hPa, ${value.altitude} m\n`);
	};
}
```

`await device.getAHT20Data()` returns `{ temperature, humidity }`.
`await device.getSPA06Data()` returns `{ temperature, pressure, altitude }`.
Temperatures are °C, humidity is percent RH, pressure is hPa, and altitude is meters.
Negative temperatures and altitudes are supported.

`onSample` receives `{ temperature, humidity, pressureTemperature, pressure, altitude }` on every poll.
`temperature` comes from AHT20 and `pressureTemperature` from SPA06. Each poll issues two sequential
requests; the two sensor readings are not simultaneous. A failed request rejects the poll without publishing
an incomplete sample. `sample()` returns a shallow copy of the latest sample, or `undefined` before sampling.
Clear `onSample` with `null` to stop polling this device.

## Configuration

`configure(options)` validates all supplied values before issuing commands. `readConfiguration()` returns
all current settings except `saveToFlash`.

| Option                            | Accepted value                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `temperatureRate`, `pressureRate` | SPA06 measurement rate from `ENV_RATE`; these do not change the bus polling interval.                                              |
| `seaLevelPressure`                | 300–1100 hPa, in 0.1 hPa steps.                                                                                                    |
| `saveToFlash`                     | Boolean, default `false`; requires `seaLevelPressure` in the same call and persists only that setting.                             |
| `reportMode`                      | Bitmask 0–15: OR `ENV_REPORT_MODE.TEMPERATURE`, `HUMIDITY`, `PRESSURE`, `ALTITUDE`; `ALL` enables all and `DISABLED` disables all. |
| `temperatureThreshold`            | `{ source, low, high }`; source is `ENV_TEMPERATURE_SOURCE.AHT20` or `.SPA06`; integer thresholds 0–255 °C.                        |
| `humidityThreshold`               | `{ low, high }`, integers 0–100 %.                                                                                                 |
| `pressureThreshold`               | `{ low, high }`, 700–1200 hPa in 0.1 hPa steps (firmware restriction).                                                             |
| `altitudeThreshold`               | `{ low, high }`, −21474836.48–21474836.47 m in 0.01 m steps.                                                                       |

Every threshold requires `low < high`. The temperature threshold encoding is unsigned even though sensor
readings can be negative. `ENV_RATE` provides `HZ_1`, `HZ_2`, `HZ_4`, `HZ_8`, `HZ_16`, `HZ_32`, `HZ_64`,
`HZ_128`, `HZ_25_16`, `HZ_25_8`, `HZ_25_4`, `HZ_25_2`, `HZ_25`, `HZ_50`, `HZ_100`, and `HZ_200`.
The fractional names mean 25/16, 25/8, 25/4, and 25/2 Hz. AHT20 has no measurement-rate setting.

## Altitude calibration

Set `seaLevelPressure` to the local sea-level pressure, or call
`await device.calibrateSeaLevelPressure(referenceAltitude, saveToFlash = false)` with the known altitude in
meters (0.01 m steps, signed 32-bit centimeters). Calibration takes about four seconds and uses a ten-second
request timeout. Other bus requests wait behind calibration. A rejected operation or timeout rejects the promise.
Saving pressure to flash erases a page; avoid saving on frequent updates.

## Warning reports

Set `device.onWarning = (warning) => { ... }` to receive automatic warning reports; clear it with `null`.
The firmware defaults to enabling all four channels. The callback receives
`{ temperature, humidity, pressure, altitude }`, each containing a two-bit transition code:

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | High threshold released |
| 1    | High threshold active   |
| 2    | Low threshold active    |
| 3    | Low threshold released  |

Fields retain their last transition code when another channel causes a report. A report does not identify
which fields changed. These codes are transitions, not a current in-range/out-of-range snapshot.
The firmware also controls its indicator LED according to its alarm state.

## TypeScript exports

The device module exports `ENV_RATE`, `ENV_REPORT_MODE`, `ENV_TEMPERATURE_SOURCE`, `ENVRate`,
`ENVTemperatureSource`, `ENVThreshold`, `ENVTemperatureThreshold`, `ENVAHT20Data`, `ENVSPA06Data`,
`ENVSample`, `ENVWarningState`, `ENVWarning`, `ENVWarningHandler`, `ENVConfiguration`, and
`ENVConfigurationSnapshot`, along with the default `M5ChainENV` class.
