import assert from "node:assert/strict";
import test from "node:test";
import { createMatrixTools, registerMatrixTools } from "../matrix/src/webmcp.ts";

function fixture() {
	const state = { device: "mono", frames: 1, playing: false };
	const tools = createMatrixTools({
		getState: () => state,
		configure: (settings) => Object.assign(state, settings),
		setPixel: (frameIndex, x, y, color) => Object.assign(state, { frameIndex, x, y, color }),
		addFrame: (copyCurrent) => Object.assign(state, { frames: state.frames + 1, copyCurrent }),
		selectFrame: (frameIndex) => Object.assign(state, { frameIndex }),
		deleteFrame: (frameIndex) => Object.assign(state, { frames: state.frames - 1, frameIndex }),
		preview: () => {
			state.playing = true;
		},
		stop: () => {
			state.playing = false;
		},
	});
	return {
		state,
		tools,
		call: async (name, input = {}) => JSON.parse(await tools.find((tool) => tool.name === name).execute(input)),
	};
}

test("matrix tools configure, draw, and control animation", async () => {
	const app = fixture();
	assert.equal((await app.call("configure_matrix", { device: "rgb", brightness: 200, frameDurationMs: 80 })).ok, true);
	assert.equal(
		(await app.call("set_matrix_pixel", { frameIndex: 0, x: 7, y: 3, color: { r: 1, g: 2, b: 3 } })).ok,
		true,
	);
	assert.deepEqual(app.state.color, { r: 1, g: 2, b: 3 });
	await app.call("add_matrix_frame", { copyCurrent: true });
	assert.equal(app.state.frames, 2);
	await app.call("preview_matrix_animation");
	assert.equal(app.state.playing, true);
	await app.call("stop_matrix_animation");
	assert.equal(app.state.playing, false);
});

test("matrix tools reject invalid and unknown input", async () => {
	const app = fixture();
	for (const input of [
		{ brightness: 256 },
		{ rotation: 45 },
		{ frameDurationMs: 19 },
		{ loop: "yes" },
		{ extra: true },
	])
		assert.equal((await app.call("configure_matrix", input)).ok, false);
	for (const input of [
		{ x: 8, y: 0, on: true },
		{ x: 0, y: 0 },
		{ x: 0, y: 0, color: { r: -1, g: 0, b: 0 } },
	])
		assert.equal((await app.call("set_matrix_pixel", input)).ok, false);
});

test("matrix tools register with abort lifetime", async () => {
	const { tools } = fixture();
	const controller = new AbortController();
	const registered = [];
	await registerMatrixTools(
		{
			registerTool: async (tool, options) => {
				registered.push(tool.name);
				assert.equal(options.signal, controller.signal);
			},
		},
		tools,
		controller.signal,
	);
	assert.equal(registered.length, 8);
	controller.abort();
	await registerMatrixTools({ registerTool: async () => assert.fail("aborted") }, tools, controller.signal);
});
