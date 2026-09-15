import assert from "node:assert/strict";
import test from "node:test";
import { BLACK, generateAnimationCode, generateCode, packMonoRows } from "../web/matrix/src/matrix.ts";

const frame = () => Array.from({ length: 64 }, () => ({ ...BLACK }));

test("packs Mono rows with X=0 in bit 7", () => {
	const pixels = frame();
	pixels[0] = { r: 1, g: 0, b: 0 };
	pixels[7] = { r: 0, g: 0, b: 1 };
	pixels[8 + 3] = { r: 1, g: 1, b: 1 };
	assert.deepEqual(packMonoRows(pixels), [0b10000001, 0b00010000, 0, 0, 0, 0, 0, 0]);
});

test("generates Mono configuration and eight row bytes", () => {
	const code = generateCode("mono", frame(), 90, 128);
	assert.match(code, /MATRIX_ROTATION\.DEG_90/);
	assert.match(code, /brightness: 128/);
	assert.match(code, /new M5Chain\(\{ deviceClasses: \[M5ChainMono\] \}\)/);
	assert.match(code, /device\.kind === "mono"/);
	assert.match(code, /mono\.writeFrame\(new Uint8Array\(\[/);
	assert.equal((code.match(/0b00000000/g) ?? []).length, 8);
});

test("generates 64 RGB colors in row-major order", () => {
	const pixels = frame();
	pixels[0] = { r: 1, g: 2, b: 3 };
	pixels[63] = { r: 253, g: 254, b: 255 };
	const code = generateCode("rgb", pixels, 270, 255);
	assert.match(code, /M5ChainRGB/);
	assert.ok(code.indexOf("{ r: 1, g: 2, b: 3 }") < code.indexOf("{ r: 253, g: 254, b: 255 }"));
	assert.equal((code.match(/\{ r: /g) ?? []).length, 64);
	assert.match(code, /rgb\.writeFrame\(frame\)/);
});

test("generates response-serialized looping and one-shot animations", () => {
	const looping = generateAnimationCode("mono", [frame(), frame()], 0, 128, 250, true);
	assert.doesNotMatch(looping, /import Timer/);
	assert.match(looping, /await mono\.playAnimation\(frames/);
	assert.match(looping, /frameDurationMs: 250/);
	assert.match(looping, /loop: true/);
	const once = generateAnimationCode("rgb", [frame(), frame()], 0, 128, 80, false);
	assert.match(once, /await rgb\.playAnimation\(frames/);
	assert.match(once, /frameDurationMs: 80/);
	assert.match(once, /loop: false/);
});
