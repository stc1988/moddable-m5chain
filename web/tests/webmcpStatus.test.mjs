import assert from "node:assert/strict";
import test from "node:test";
import { initializeWebMcp } from "../shared/webmcpStatus.ts";

function statusElement() {
	return { dataset: {}, textContent: "確認中…" };
}

test("missing or incomplete WebMCP APIs display unavailable", async () => {
	for (const context of [undefined, {}, { registerTool: true }]) {
		const status = statusElement();
		await initializeWebMcp(context, [], new AbortController(), status);
		assert.equal(status.dataset.state, "unavailable");
		assert.equal(status.textContent, "このブラウザでは利用できません");
	}
});

test("status stays pending until every tool has registered", async () => {
	const status = statusElement();
	const lifetime = new AbortController();
	const registered = [];
	let completeLastTool;
	const registration = initializeWebMcp(
		{
			registerTool: async (tool, options) => {
				registered.push(tool.name);
				assert.equal(options.signal, lifetime.signal);
				if (tool.name === "last") {
					await new Promise((resolve) => {
						completeLastTool = resolve;
					});
				}
			},
		},
		[{ name: "first" }, { name: "last" }],
		lifetime,
		status,
	);
	await Promise.resolve();
	assert.deepEqual(registered, ["first", "last"]);
	assert.equal(status.dataset.state, "registering");
	assert.equal(status.textContent, "登録中…");
	completeLastTool();
	await registration;
	assert.equal(status.dataset.state, "registered");
	assert.equal(status.textContent, "ツール登録済み");
});

test("a partial registration failure aborts registered tools and displays an error", async (t) => {
	const warning = t.mock.method(console, "warn", () => {});
	const status = statusElement();
	const lifetime = new AbortController();
	const registered = [];
	await initializeWebMcp(
		{
			registerTool: async (tool) => {
				registered.push(tool.name);
				if (tool.name === "fails") throw new Error("Registration rejected");
			},
		},
		[{ name: "first" }, { name: "fails" }, { name: "never" }],
		lifetime,
		status,
	);
	assert.deepEqual(registered, ["first", "fails"]);
	assert.equal(lifetime.signal.aborted, true);
	assert.equal(status.dataset.state, "error");
	assert.equal(status.textContent, "初期化に失敗しました");
	assert.equal(warning.mock.callCount(), 1);
});
