import assert from "node:assert/strict";
import test from "node:test";
import { parseMelodyCsv } from "../web/buzzer/src/melodyCsv.ts";
import { createBuzzerTools, registerBuzzerTools } from "../web/buzzer/src/webmcp.ts";

function fixture() {
	const notes = ["REST", "C5", "A_SHARP_4"];
	const state = { mode: "tone", frequencyHz: 1000, melody: [] };
	let changes = 0;
	const tools = createBuzzerTools(
		{
			getState: () => state,
			configure: (settings) => {
				changes++;
				Object.assign(state, settings);
			},
			importCsv: (csv) => {
				const melody = parseMelodyCsv(csv, new Set(notes));
				state.melody = melody;
				state.mode = "melody";
			},
			preview: () => {
				throw new Error("Click Preview on the page once to enable browser audio, then retry.");
			},
			stop: () => {
				state.playing = false;
			},
		},
		notes,
	);
	return {
		state,
		tools,
		changes: () => changes,
		call: async (name, args = {}) => JSON.parse(await tools.find((tool) => tool.name === name).execute(args)),
	};
}

test("valid settings update together and reads reflect current application state", async () => {
	const app = fixture();
	assert.equal((await app.call("configure_buzzer", { mode: "note", noteConstant: "C5", durationMs: 0 })).ok, true);
	assert.equal(app.state.frequencyHz, 1000);
	app.state.frequencyHz = 440;
	assert.equal((await app.call("get_buzzer_state")).state.frequencyHz, 440);
	assert.equal(app.changes(), 1);
});

test("invalid tool inputs never partially update settings", async () => {
	const app = fixture();
	for (const args of [
		null,
		[],
		{ mode: "invalid" },
		{ mode: "note", frequencyHz: 99 },
		{ frequencyHz: "440" },
		{ frequencyHz: Infinity },
		{ durationMs: 0.5 },
		{ dutyPercent: 101 },
		{ previewVolume: -1 },
		{ tempoBpm: 0 },
		{ gatePercent: NaN },
		{ noteConstant: "X4" },
		{ extra: true },
	]) {
		assert.equal((await app.call("configure_buzzer", args)).ok, false);
	}
	assert.equal(app.changes(), 0);
	assert.equal(app.state.mode, "tone");
});

test("CSV import accepts fractions and reports invalid rows without replacing melody", async () => {
	const app = fixture();
	assert.equal((await app.call("import_buzzer_melody", { csv: "note,beats\nC5,2/3\nREST,1" })).ok, true);
	assert.equal(app.state.melody[0].beats, 2 / 3);
	const previous = structuredClone(app.state);
	for (const args of [{}, { csv: 3 }, { csv: "" }, { csv: "C5,1\nNOPE,1" }]) {
		assert.equal((await app.call("import_buzzer_melody", args)).ok, false);
		assert.deepEqual(app.state, previous);
	}
});

test("audio errors are actionable and stop stays independently callable", async () => {
	const app = fixture();
	const result = await app.call("preview_buzzer");
	assert.equal(result.ok, false);
	assert.match(result.error, /Click Preview/);
	app.state.playing = true;
	assert.equal((await app.call("stop_buzzer_preview")).state.playing, false);
	assert.equal((await app.call("get_buzzer_state", { unexpected: 1 })).ok, false);
});

test("registration supports unavailable API, async failures, and abort lifetime", async () => {
	const { tools } = fixture();
	const controller = new AbortController();
	await registerBuzzerTools(undefined, tools, controller.signal);
	const registered = [];
	await registerBuzzerTools(
		{
			registerTool: async (tool, options) => {
				registered.push(tool.name);
				assert.equal(options.signal, controller.signal);
			},
		},
		tools,
		controller.signal,
	);
	assert.equal(new Set(registered).size, 5);
	await assert.rejects(
		registerBuzzerTools(
			{
				registerTool: async () => {
					throw new Error("Policy blocked");
				},
			},
			tools,
			controller.signal,
		),
		/Policy blocked/,
	);
	controller.abort();
	await registerBuzzerTools({ registerTool: async () => assert.fail("Already aborted") }, tools, controller.signal);
});
