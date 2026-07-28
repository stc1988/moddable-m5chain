import assert from "node:assert/strict";
import test from "node:test";
import ConnectionMonitor from "../src/m5chain/connectionMonitor.ts";

test("requests a rescan when the observed device count changes", () => {
	const monitor = new ConnectionMonitor();

	assert.equal(monitor.observeDeviceCount(2, 2), false);
	assert.equal(monitor.observeDeviceCount(2, 1), true);
});

test("requests a rescan after three consecutive probe failures", () => {
	const monitor = new ConnectionMonitor();

	assert.equal(monitor.observeFailure(), false);
	assert.equal(monitor.observeFailure(), false);
	assert.equal(monitor.observeFailure(), true);
});

test("a successful probe resets the failure count", () => {
	const monitor = new ConnectionMonitor();

	assert.equal(monitor.observeFailure(), false);
	assert.equal(monitor.observeFailure(), false);
	assert.equal(monitor.observeDeviceCount(1, 1), false);
	assert.equal(monitor.observeFailure(), false);
});
