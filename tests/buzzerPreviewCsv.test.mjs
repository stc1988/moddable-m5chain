import assert from "node:assert/strict";
import test from "node:test";
import { parseMelodyCsv } from "../web/buzzer/src/melodyCsv.ts";

const VALID_NOTES = new Set(["REST", "C5", "G4", "A_SHARP_4"]);

test("imports melody CSV with an optional header", () => {
	assert.deepEqual(parseMelodyCsv("note,beats\nC5,1.5\nREST,0.5", VALID_NOTES), [
		{ noteConstant: "C5", beats: 1.5 },
		{ noteConstant: "REST", beats: 0.5 },
	]);
});

test("accepts firmware-style note names, quotes, comments, and fractions", () => {
	assert.deepEqual(parseMelodyCsv('# melody\n"BUZZER_NOTE.G4","2/3"\nNOTE_AS4,1\nNOTE_REST,0.5', VALID_NOTES), [
		{ noteConstant: "G4", beats: 2 / 3 },
		{ noteConstant: "A_SHARP_4", beats: 1 },
		{ noteConstant: "REST", beats: 0.5 },
	]);
});

test("reports invalid CSV without returning partial rows", () => {
	assert.throws(() => parseMelodyCsv("C5,1\nNOPE,0.5", VALID_NOTES), /Line 2: unknown note/);
	assert.throws(() => parseMelodyCsv("C5,0", VALID_NOTES), /Line 1: beats must be/);
	assert.throws(() => parseMelodyCsv("C5,1,extra", VALID_NOTES), /Line 1: expected exactly 2 columns/);
	assert.throws(() => parseMelodyCsv("note,beats", VALID_NOTES), /at least one melody step/);
});
