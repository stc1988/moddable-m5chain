/*---
description: validates matrix display protocol conversions on XS
flags: [module]
---*/

import {
	colorFromRgb565,
	colorToRgb565,
	decodeScrollMode,
	encodeCoordinate,
	encodeScrollMode,
	encodeText,
	MATRIX_ROTATION,
	rotationFromWire,
	rotationToWire,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
} from "matrixDisplayProtocol";
import { assertDeepEqual, assertThrows } from "./assertions_FIXTURE.js";

const monoDirections = {
	[SCROLL_DIRECTION.LEFT]: 1,
	[SCROLL_DIRECTION.RIGHT]: 0,
	[SCROLL_DIRECTION.UP]: 2,
	[SCROLL_DIRECTION.DOWN]: 3,
};
const rgbDirections = {
	[SCROLL_DIRECTION.LEFT]: 0,
	[SCROLL_DIRECTION.RIGHT]: 1,
	[SCROLL_DIRECTION.UP]: 2,
	[SCROLL_DIRECTION.DOWN]: 3,
};

assert.sameValue(encodeCoordinate(0, 0), 0);
assert.sameValue(encodeCoordinate(7, 7), 0x3f);
assert.sameValue(encodeCoordinate(3, 5), 0x1d);
for (const [rotation, wire] of [
	[MATRIX_ROTATION.DEG_0, 0],
	[MATRIX_ROTATION.DEG_90, 1],
	[MATRIX_ROTATION.DEG_180, 2],
	[MATRIX_ROTATION.DEG_270, 3],
]) {
	assert.sameValue(rotationToWire(rotation), wire);
	assert.sameValue(rotationFromWire(wire), rotation);
}
assert.sameValue(encodeScrollMode(SCROLL_DIRECTION.LEFT, SCROLL_BEHAVIOR.LOOP, monoDirections), 0x11);
assert.sameValue(encodeScrollMode(SCROLL_DIRECTION.LEFT, SCROLL_BEHAVIOR.LOOP, rgbDirections), 0x01);
assertDeepEqual(decodeScrollMode(0x02, rgbDirections), {
	direction: SCROLL_DIRECTION.LEFT,
	behavior: SCROLL_BEHAVIOR.BOUNCE,
});
assertDeepEqual(encodeText("M5"), new Uint8Array([0x4d, 0x35]));
assertThrows(() => encodeText("M5\u2605"), /ASCII/);
assertThrows(() => encodeText(""), /between 1 and 32/);
assertThrows(() => encodeText("x".repeat(33)), /between 1 and 32/);
assert.sameValue(colorToRgb565({ r: 255, g: 0, b: 0 }), 0xf800);
assert.sameValue(colorToRgb565({ r: 0, g: 255, b: 0 }), 0x07e0);
assert.sameValue(colorToRgb565({ r: 0, g: 0, b: 255 }), 0x001f);
assertDeepEqual(colorFromRgb565(0xffff), { r: 255, g: 255, b: 255 });
