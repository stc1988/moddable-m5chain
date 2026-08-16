import M5ChainAngle from "m5chainAngle";
import M5ChainBuzzer from "m5chainBuzzer";
import M5ChainEncoder from "m5chainEncoder";
import M5ChainJoyStick from "m5chainJoyStick";
import M5ChainKey from "m5chainKey";
import M5ChainMono from "m5chainMono";
import M5ChainPIR from "m5chainPIR";
import M5ChainRGB from "m5chainRGB";
import M5ChainToF from "m5chainToF";
import type { RegisteredM5ChainDevice } from "types";

const M5CHAIN_DEVICE_CLASSES = Object.freeze([
	M5ChainEncoder,
	M5ChainAngle,
	M5ChainKey,
	M5ChainJoyStick,
	M5ChainToF,
	M5ChainPIR,
	M5ChainBuzzer,
	M5ChainMono,
	M5ChainRGB,
]);
type M5ChainDevice = RegisteredM5ChainDevice<typeof M5CHAIN_DEVICE_CLASSES>;

export { M5CHAIN_DEVICE_CLASSES, type M5ChainDevice };
