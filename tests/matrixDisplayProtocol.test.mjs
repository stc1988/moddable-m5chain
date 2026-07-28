import assert from "node:assert/strict";
import test from "node:test";
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
} from "../src/m5chain/matrixDisplayProtocol.ts";

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

test("encodes display coordinates with X in bits 5:3 and Y in bits 2:0", () => {
	assert.equal(encodeCoordinate(0, 0), 0);
	assert.equal(encodeCoordinate(7, 7), 0x3f);
	assert.equal(encodeCoordinate(3, 5), 0x1d);
});

test("maps public degree rotations to protocol values", () => {
	for (const [rotation, wire] of [
		[MATRIX_ROTATION.DEG_0, 0],
		[MATRIX_ROTATION.DEG_90, 1],
		[MATRIX_ROTATION.DEG_180, 2],
		[MATRIX_ROTATION.DEG_270, 3],
	]) {
		assert.equal(rotationToWire(rotation), wire);
		assert.equal(rotationFromWire(wire), rotation);
	}
});

test("absorbs the opposite Mono and RGB horizontal direction values", () => {
	assert.equal(encodeScrollMode(SCROLL_DIRECTION.LEFT, SCROLL_BEHAVIOR.LOOP, monoDirections), 0x11);
	assert.equal(encodeScrollMode(SCROLL_DIRECTION.LEFT, SCROLL_BEHAVIOR.LOOP, rgbDirections), 0x01);
	assert.deepEqual(decodeScrollMode(0x02, rgbDirections), {
		direction: SCROLL_DIRECTION.LEFT,
		behavior: SCROLL_BEHAVIOR.BOUNCE,
	});
});

test("encodes only protocol-supported ASCII text", () => {
	assert.deepEqual(encodeText("M5"), new Uint8Array([0x4d, 0x35]));
	assert.throws(() => encodeText("M5\u2605"), /ASCII/);
	assert.throws(() => encodeText(""), /between 1 and 32/);
	assert.throws(() => encodeText("x".repeat(33)), /between 1 and 32/);
});

test("converts 8-bit RGB colors to and from RGB565", () => {
	assert.equal(colorToRgb565({ r: 255, g: 0, b: 0 }), 0xf800);
	assert.equal(colorToRgb565({ r: 0, g: 255, b: 0 }), 0x07e0);
	assert.equal(colorToRgb565({ r: 0, g: 0, b: 255 }), 0x001f);
	assert.deepEqual(colorFromRgb565(0xffff), { r: 255, g: 255, b: 255 });
});
