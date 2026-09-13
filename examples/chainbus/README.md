# ChainBus Unit Examples

The examples are separated by remote I/O type so one check does not unexpectedly replace another pin mode.

| Example | Hardware | Checks |
| --- | --- | --- |
| [`basic`](basic) | ChainBus Unit | Discovery, RGB LED, and mode query |
| [`i2c`](i2c) | M5Stack Gesture Unit | 400 kHz setup, scan, register write, and register read |
| [`gpio-input`](gpio-input) | M5Stack PIR Unit | GPIO2 digital input and rising/falling interrupts |
| [`gpio-output`](gpio-output) | A verified safe load | GPIO1 push-pull output and output-state readback |
| [`adc`](adc) | A 0–3.3 V analog source | GPIO2 12-bit ADC read |

Build and flash the shared Host first from the repository root:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./examples/manifest.json
```

Then install one Mod, for example:

```sh
mcrun -d -m -p esp32/m5atom_matrix ./examples/chainbus/i2c/manifest.json
```

Replace `i2c` with another directory name from the table. Do not hot-swap Grove devices while powered. I2C, GPIO,
and ADC share the same remote pins, so run only the example matching the attached hardware.
