/*---
description: resolves M5Chain serial configuration precedence on XS
flags: [module]
---*/

import { resolveConnectionConfig } from "connectionConfig";
import { assertDeepEqual } from "./assertions_FIXTURE.js";

const defaults = Object.freeze({ transmit: 32, receive: 33, port: 1 });

assertDeepEqual(resolveConnectionConfig(undefined, {}, defaults), defaults);
assertDeepEqual(resolveConnectionConfig({ unrelated: true }, { m5chain: null }, defaults), defaults);
assertDeepEqual(
	resolveConnectionConfig(
		{ m5chain: { transmit: 0, port: 2 } },
		{ m5chain: { transmit: 21, receive: 22, port: 3 } },
		defaults,
	),
	{ transmit: 0, receive: 22, port: 2 },
);
assertDeepEqual(resolveConnectionConfig({ m5chain: {} }, { m5chain: { receive: 0 } }, defaults), {
	transmit: 32,
	receive: 0,
	port: 1,
});
assertDeepEqual(
	resolveConnectionConfig(
		{ m5chain: { transmit: "0", receive: -1, port: -1 } },
		{ m5chain: { transmit: 21, receive: 22, port: 0 } },
		defaults,
	),
	{ transmit: 21, receive: 22, port: 0 },
);
assertDeepEqual(
	resolveConnectionConfig(
		{ m5chain: { transmit: Number.NaN, receive: Number.POSITIVE_INFINITY, port: Number.NaN } },
		{ m5chain: { transmit: 1.5, port: 1.5 } },
		defaults,
	),
	defaults,
);
