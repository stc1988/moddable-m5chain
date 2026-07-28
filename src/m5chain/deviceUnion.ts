import type M5ChainAngle from "m5chainAngle";
import type M5ChainBuzzer from "m5chainBuzzer";
import type M5ChainEncoder from "m5chainEncoder";
import type M5ChainJoyStick from "m5chainJoyStick";
import type M5ChainKey from "m5chainKey";
import type M5ChainMono from "m5chainMono";
import type M5ChainRGB from "m5chainRGB";
import type M5ChainToF from "m5chainToF";
import type M5ChainUnknownDevice from "m5chainUnknownDevice";
import type { M5ChainDeviceLike } from "types";

export type M5ChainDevice =
	| (M5ChainEncoder & M5ChainDeviceLike)
	| (M5ChainAngle & M5ChainDeviceLike)
	| (M5ChainKey & M5ChainDeviceLike)
	| (M5ChainJoyStick & M5ChainDeviceLike)
	| (M5ChainToF & M5ChainDeviceLike)
	| (M5ChainBuzzer & M5ChainDeviceLike)
	| (M5ChainMono & M5ChainDeviceLike)
	| (M5ChainRGB & M5ChainDeviceLike)
	| (M5ChainUnknownDevice & M5ChainDeviceLike);
