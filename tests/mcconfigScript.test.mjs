import assert from "node:assert/strict";
import test from "node:test";
import { createMcconfigArgs } from "../scripts/mcconfig.mjs";

const PLATFORM = "esp32/m5atom_matrix";

test("creates build arguments", () => {
	assert.deepEqual(createMcconfigArgs("build", PLATFORM), ["-d", "-m", "-p", PLATFORM, "-t", "build"]);
});

test("creates debug arguments", () => {
	assert.deepEqual(createMcconfigArgs("debug", PLATFORM), ["-d", "-m", "-p", PLATFORM]);
});

test("creates xsdb arguments", () => {
	assert.deepEqual(createMcconfigArgs("xsdb", PLATFORM), ["-dl", "-m", "-p", PLATFORM]);
});

test("requires a platform name", () => {
	assert.throws(() => createMcconfigArgs("build", undefined), /platform name/);
});
