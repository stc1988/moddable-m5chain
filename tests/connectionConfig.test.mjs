import assert from "node:assert/strict";
import test from "node:test";

import { resolveConnectionConfig } from "../src/m5chain/connectionConfig.ts";

const defaults = Object.freeze({ transmit: 32, receive: 33, port: 1 });

test("falls back when config objects do not define m5chain serial settings", () => {
	assert.deepEqual(resolveConnectionConfig(undefined, {}, defaults), defaults);
	assert.deepEqual(resolveConnectionConfig({ unrelated: true }, { m5chain: null }, defaults), defaults);
});

test("combines mod, application, and default serial settings independently", () => {
	assert.deepEqual(
		resolveConnectionConfig(
			{ m5chain: { transmit: 0, port: 2 } },
			{ m5chain: { transmit: 21, receive: 22, port: 3 } },
			defaults,
		),
		{ transmit: 0, receive: 22, port: 2 },
	);
	assert.deepEqual(resolveConnectionConfig({ m5chain: {} }, { m5chain: { receive: 0 } }, defaults), {
		transmit: 32,
		receive: 0,
		port: 1,
	});
});

test("ignores invalid configured serial settings and falls back independently", () => {
	assert.deepEqual(
		resolveConnectionConfig(
			{ m5chain: { transmit: "0", receive: -1, port: -1 } },
			{ m5chain: { transmit: 21, receive: 22, port: 0 } },
			defaults,
		),
		{ transmit: 21, receive: 22, port: 0 },
	);
	assert.deepEqual(
		resolveConnectionConfig(
			{ m5chain: { transmit: Number.NaN, receive: Number.POSITIVE_INFINITY, port: Number.NaN } },
			{ m5chain: { transmit: 1.5, port: 1.5 } },
			defaults,
		),
		defaults,
	);
});
