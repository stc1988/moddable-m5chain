import assert from "node:assert/strict";
import test from "node:test";
import PollingState from "../src/m5chain/pollingState.ts";

test("does not start a second loop while one is running", () => {
	const state = new PollingState();

	assert.equal(state.start(), true);
	assert.equal(state.start(), false);
	assert.equal(state.requested, true);
});

test("restarts only after the previous loop has finished", () => {
	const state = new PollingState();

	assert.equal(state.start(), true);
	state.stop();
	assert.equal(state.requested, false);

	assert.equal(state.start(), false);
	assert.equal(state.requested, true);

	state.finished();
	assert.equal(state.start(), true);
});
