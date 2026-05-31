# GATTServer.onSecured ESP32 Crash Reproduction

This is a minimal reproduction for an ESP32 crash in `embedded:io/bluetoothle/peripheral`.

The app starts a `GATTServer` with:

- `security.bond: true`
- no GATT services
- Apple Media Service UUID solicitation in the advertising payload
- an `onSecured` callback

On ESP32, pairing from an iOS device can crash before the JavaScript `onSecured` callback is called.

## Run

```sh
mcconfig -dl -m -p esp32/m5atom_matrix ./examples/ble-hid/onSecuredCrash/manifest.json
```

Keep an iOS device nearby with Bluetooth enabled. The AMS solicitation should cause iOS to connect to the peripheral.

## Expected

The app should either call `onSecured` with a valid `GATTServerConnection` and security state, or fail without crashing.

## Actual

The ESP32 can panic in Moddable's `modules/io/ble/server/esp32/bleserver.c`:

```text
Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.
PC: deliverOnSecured
EXCVADDR: 0x00000008
```

The observed crash path is `deliverOnSecured()` dereferencing `connection->obj` after `findConnection(server, conn_handle)` returns `NULL`.
