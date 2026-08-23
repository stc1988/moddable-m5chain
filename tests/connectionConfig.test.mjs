import assert from "node:assert/strict";
import test from "node:test";

import { resolveConnectionConfig } from "../src/m5chain/connectionConfig.ts";

const defaults = Object.freeze({ transmit: 32, receive: 33 });

test("falls back when config objects do not define m5chain pins", () => {
	assert.deepEqual(resolveConnectionConfig(undefined, {}, defaults), defaults);
	assert.deepEqual(resolveConnectionConfig({ unrelated: true }, { m5chain: null }, defaults), defaults);
});

test("combines mod, application, and default pins independently", () => {
	assert.deepEqual(
		resolveConnectionConfig({ m5chain: { transmit: 0 } }, { m5chain: { transmit: 21, receive: 22 } }, defaults),
		{ transmit: 0, receive: 22 },
	);
	assert.deepEqual(resolveConnectionConfig({ m5chain: {} }, { m5chain: { receive: 0 } }, defaults), {
		transmit: 32,
		receive: 0,
	});
});

test("ignores invalid configured pins and falls back independently", () => {
	assert.deepEqual(
		resolveConnectionConfig(
			{ m5chain: { transmit: "0", receive: -1 } },
			{ m5chain: { transmit: 21, receive: 22 } },
			defaults,
		),
		{ transmit: 21, receive: 22 },
	);
	assert.deepEqual(
		resolveConnectionConfig(
			{ m5chain: { transmit: Number.NaN, receive: Number.POSITIVE_INFINITY } },
			{ m5chain: { transmit: 1.5 } },
			defaults,
		),
		defaults,
	);
});
