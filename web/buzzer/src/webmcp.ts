export type PreviewSettings = {
	mode: "tone" | "note" | "melody" | "continuous";
	frequencyHz: number;
	dutyPercent: number;
	durationMs: number;
	noteConstant: string;
	previewVolume: number;
	tempoBpm: number;
	gatePercent: number;
};

type BuzzerActions = {
	getState: () => unknown;
	configure: (settings: Partial<PreviewSettings>) => void;
	importCsv: (csv: string) => void;
	preview: () => void;
	stop: () => void;
};

type Tool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations: { readOnlyHint: boolean };
	execute: (input: unknown) => Promise<string>;
};

// Local types for the experimental document API, not an MCP server or a polyfill.
export type ModelContext = {
	registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void>;
};

const NUMBER_LIMITS = {
	frequencyHz: [100, 10_000, true],
	dutyPercent: [0, 100, true],
	durationMs: [0, 65_535, true],
	previewVolume: [0, 100, true],
	tempoBpm: [1, 1000, false],
	gatePercent: [1, 100, false],
} as const;

function objectInput(input: unknown): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object.");
	return input as Record<string, unknown>;
}

export function createBuzzerTools(actions: BuzzerActions, notes: readonly string[]): Tool[] {
	const properties: Record<string, unknown> = {
		mode: { type: "string", enum: ["tone", "note", "melody", "continuous"] },
		noteConstant: { type: "string", enum: notes, description: "BUZZER_NOTE constant without the prefix." },
	};
	for (const [key, [minimum, maximum, integer]] of Object.entries(NUMBER_LIMITS)) {
		properties[key] = { type: integer ? "integer" : "number", minimum, maximum };
	}

	function tool(
		name: string,
		description: string,
		fields: Record<string, unknown>,
		required: string[],
		run: (input: Record<string, unknown>) => void,
		readOnlyHint = false,
	): Tool {
		return {
			name,
			description,
			inputSchema: { type: "object", properties: fields, required, additionalProperties: false },
			annotations: { readOnlyHint },
			execute: async (input) => {
				try {
					const values = objectInput(input);
					for (const key of Object.keys(values)) {
						if (!Object.hasOwn(fields, key)) throw new Error(`Unknown field: ${key}`);
					}
					for (const key of required) {
						if (!Object.hasOwn(values, key)) throw new Error(`Missing field: ${key}`);
					}
					run(values);
					return JSON.stringify({ ok: true, state: actions.getState() });
				} catch (error) {
					return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Tool failed." });
				}
			},
		};
	}

	return [
		tool(
			"get_buzzer_state",
			"Read current buzzer settings, melody, playback status and generated Moddable code.",
			{},
			[],
			() => {},
			true,
		),
		tool(
			"configure_buzzer",
			"Update preview settings and generated code. Omitted settings stay unchanged. Stops playback; does not play audio. Volume affects browser preview only. Melody notes always use 50% duty.",
			properties,
			[],
			(values) => {
				for (const [key, value] of Object.entries(values)) {
					if (key === "mode") {
						if (!["tone", "note", "melody", "continuous"].includes(value as string)) throw new Error("Invalid mode.");
					} else if (key === "noteConstant") {
						if (typeof value !== "string" || !notes.includes(value)) throw new Error("Unknown noteConstant.");
					} else {
						const [minimum, maximum, integer] = NUMBER_LIMITS[key as keyof typeof NUMBER_LIMITS];
						if (
							typeof value !== "number" ||
							!Number.isFinite(value) ||
							value < minimum ||
							value > maximum ||
							(integer && !Number.isInteger(value))
						) {
							throw new Error(`${key} must be ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}.`);
						}
					}
				}
				actions.configure(values as Partial<PreviewSettings>);
			},
		),
		tool(
			"import_buzzer_melody",
			"Replace the melody from note,beats CSV and select melody mode. Optional header; notes like C5, A#4, BUZZER_NOTE.C5, NOTE_AS4, REST; positive beats may be fractions like 2/3. Validates all rows before replacement. Does not play audio.",
			{ csv: { type: "string", minLength: 1 } },
			["csv"],
			({ csv }) => {
				if (typeof csv !== "string" || !csv.trim()) throw new Error("csv must be non-empty text.");
				actions.importCsv(csv);
			},
		),
		tool(
			"preview_buzzer",
			"Start browser audio using current settings. Requires the user to click Preview once to enable audio. Returns immediately; read get_buzzer_state for progress. Continuous mode plays until stopped. Does not control hardware.",
			{},
			[],
			() => actions.preview(),
		),
		tool("stop_buzzer_preview", "Stop browser audio, including continuous tones and melodies.", {}, [], () =>
			actions.stop(),
		),
	];
}

export async function registerBuzzerTools(
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
