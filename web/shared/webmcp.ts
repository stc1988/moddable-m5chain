export type Tool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations: { readOnlyHint: boolean };
	execute: (input: unknown) => Promise<string>;
};

export type ModelContext = {
	registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void>;
};

export function objectInput(input: unknown): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object.");
	return input as Record<string, unknown>;
}

export function createToolFactory(getState: () => unknown) {
	return function createTool(
		name: string,
		description: string,
		properties: Record<string, unknown>,
		required: string[],
		run: (input: Record<string, unknown>) => void,
		readOnlyHint = false,
	): Tool {
		return {
			name,
			description,
			inputSchema: { type: "object", properties, required, additionalProperties: false },
			annotations: { readOnlyHint },
			execute: async (input) => {
				try {
					const values = objectInput(input);
					for (const key of Object.keys(values)) {
						if (!Object.hasOwn(properties, key)) throw new Error(`Unknown field: ${key}`);
					}
					for (const key of required) {
						if (!Object.hasOwn(values, key)) throw new Error(`Missing field: ${key}`);
					}
					run(values);
					return JSON.stringify({ ok: true, state: getState() });
				} catch (error) {
					return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Tool failed." });
				}
			},
		};
	};
}

export async function registerTools(
	context: ModelContext | undefined,
	tools: Tool[],
	signal: AbortSignal,
): Promise<void> {
	if (!context) return;
	for (const tool of tools) {
		if (signal.aborted) return;
		await context.registerTool(tool, { signal });
	}
}
