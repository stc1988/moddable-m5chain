# ChainBus Unit Example

This Mod discovers only ChainBus Units and demonstrates every public communication style: RGB LED control, I2C bus
configuration and scanning, raw and register-based I2C transfers, digital output and input, ADC input, mode queries,
and edge-triggered GPIO events.

## Safety and Wiring

The default configuration performs only operations that do not depend on external GPIO wiring: it identifies the
unit, changes its onboard LED, configures I2C, scans the I2C bus, verifies an attached M5Stack Gesture Unit, and reads
the GPIO working modes. The Gesture check selects PAJ7620U2 register bank 0 and verifies that registers `0x00` and
`0x01` contain the expected device ID `20 76`, exercising both register write and register read commands.

In [`mod.ts`](mod.ts):

- Set `I2C_TEST` for the attached I2C peripheral before enabling raw or register transfers. Its write payloads are
  device-specific and may change peripheral state.
- Set `RUN_GESTURE_TEST` to `false` when a Gesture Unit is not connected at its fixed I2C address, `0x73`.
- Set `RUN_GPIO_TESTS` to `true` only after confirming GPIO1 is safe to drive. The test drives GPIO1 high and low, then
  uses GPIO2 as a pulled-up digital input, an analog input, and finally a both-edge interrupt input.
- I2C and GPIO functions share the same remote pins. Running the GPIO checks replaces their I2C mode and leaves GPIO1
  as an output and GPIO2 as an interrupt input.

Edit the sample constants to match the peripheral, register layout, and wiring under test.

## Run

Build and flash the shared Host first from the repository root:

```sh
mcconfig -d -m -p esp32/m5atom_matrix ./examples/manifest.json
```

Keep the device connected, then install this Mod from another terminal:

```sh
mcrun -d -m -p esp32/m5atom_matrix ./examples/chainbus/manifest.json
```

Watch xsbug for lines prefixed with `[examples/chainbus]`. The application remains active after setup so GPIO
interrupt events can continue to arrive.
