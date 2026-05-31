# GATTServer.onSecured ESP32 Crash Reproduction

This is a minimal reproduction for an ESP32 crash in `embedded:io/bluetoothle/peripheral`.

The app starts a `GATTServer` with:

- `security.bond: true`
- `security.immediate: true`
- Generic Access, Heart Rate, and Battery services
- Heart Rate and Battery Service UUIDs in the advertising payload
- an encrypted Battery Level read characteristic
- complete local name `SecCrashHRM` in the advertising payload
- an `onSecured` callback

On ESP32, pairing can crash before the JavaScript `onSecured` callback is called.

## Run

```sh
mcconfig -dl -m -p esp32/m5atom_matrix ./examples/ble-hid/onSecuredCrash/manifest.json
```

Use a BLE scanner such as nRF Connect or LightBlue to connect to `SecCrashHRM`.

If pairing does not start immediately on connect, read the Battery Level characteristic. It is encrypted and should trigger pairing.

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
