import { type ModelContext, registerTools, type Tool } from "./webmcp.ts";

export async function initializeWebMcp(
	context: ModelContext | undefined,
	tools: Tool[],
	lifetime: AbortController,
	status: HTMLElement,
): Promise<void> {
	const update = (state: string, message: string) => {
		status.dataset.state = state;
		status.textContent = message;
	};
	if (typeof context?.registerTool !== "function") {
		update("unavailable", "このブラウザでは利用できません");
		return;
	}
	update("registering", "登録中…");
	try {
		await registerTools(context, tools, lifetime.signal);
		if (!lifetime.signal.aborted) update("registered", "ツール登録済み");
	} catch (error) {
		lifetime.abort();
		update("error", "初期化に失敗しました");
		console.warn("WebMCP tools could not be registered", error);
	}
}
