import type { Color, DeviceType } from "./matrix";

export type MatrixSettings = {
	device: DeviceType;
	rotation: number;
	brightness: number;
	frameDurationMs: number;
	loop: boolean;
};

type MatrixActions = {
	getState: () => unknown;
	configure: (settings: Partial<MatrixSettings>) => void;
	setPixel: (frameIndex: number | undefined, x: number, y: number, color: Color | null) => void;
	addFrame: (copyCurrent: boolean) => void;
	selectFrame: (frameIndex: number) => void;
	deleteFrame: (frameIndex: number | undefined) => void;
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

export type ModelContext = {
	registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void>;
};

function objectInput(input: unknown): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object.");
	return input as Record<string, unknown>;
}

function integer(name: string, value: unknown, minimum: number, maximum: number): number {
	if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum)
		throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
	return value as number;
}

function tool(
	actions: MatrixActions,
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
				for (const key of Object.keys(values))
					if (!Object.hasOwn(properties, key)) throw new Error(`Unknown field: ${key}`);
				for (const key of required) if (!Object.hasOwn(values, key)) throw new Error(`Missing field: ${key}`);
				run(values);
				return JSON.stringify({ ok: true, state: actions.getState() });
			} catch (error) {
				return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Tool failed." });
			}
		},
	};
}

export function createMatrixTools(actions: MatrixActions): Tool[] {
	const frameIndex = { type: "integer", minimum: 0, description: "Zero-based frame index; defaults to current frame." };
	return [
		tool(
			actions,
			"get_matrix_state",
			"Read settings, frames, playback state, and generated Moddable code.",
			{},
			[],
			() => {},
			true,
		),
		tool(
			actions,
			"configure_matrix",
			"Change display and animation settings. Omitted settings stay unchanged; does not start playback.",
			{
				device: { type: "string", enum: ["mono", "rgb"] },
				rotation: { type: "integer", enum: [0, 90, 180, 270] },
				brightness: { type: "integer", minimum: 0, maximum: 255 },
				frameDurationMs: { type: "integer", minimum: 20, maximum: 60_000 },
				loop: { type: "boolean" },
			},
			[],
			(values) => {
				if (values.device !== undefined && values.device !== "mono" && values.device !== "rgb")
					throw new Error("Invalid device.");
				if (values.rotation !== undefined && ![0, 90, 180, 270].includes(values.rotation as number))
					throw new Error("Invalid rotation.");
				if (values.brightness !== undefined) integer("brightness", values.brightness, 0, 255);
				if (values.frameDurationMs !== undefined) integer("frameDurationMs", values.frameDurationMs, 20, 60_000);
				if (values.loop !== undefined && typeof values.loop !== "boolean") throw new Error("loop must be boolean.");
				actions.configure(values as Partial<MatrixSettings>);
			},
		),
		tool(
			actions,
			"set_matrix_pixel",
			"Set one pixel in a frame. Use on for Mono or color for RGB; null/false clears the pixel.",
			{
				frameIndex,
				x: { type: "integer", minimum: 0, maximum: 7 },
				y: { type: "integer", minimum: 0, maximum: 7 },
				on: { type: "boolean" },
				color: {
					oneOf: [
						{ type: "null" },
						{
							type: "object",
							properties: {
								r: { type: "integer", minimum: 0, maximum: 255 },
								g: { type: "integer", minimum: 0, maximum: 255 },
								b: { type: "integer", minimum: 0, maximum: 255 },
							},
							required: ["r", "g", "b"],
							additionalProperties: false,
						},
					],
				},
			},
			["x", "y"],
			(values) => {
				const x = integer("x", values.x, 0, 7);
				const y = integer("y", values.y, 0, 7);
				const index = values.frameIndex === undefined ? undefined : integer("frameIndex", values.frameIndex, 0, 999);
				let color: Color | null;
				if (values.color === null || values.on === false) color = null;
				else if (values.color !== undefined) {
					const input = objectInput(values.color);
					if (Object.keys(input).some((key) => !["r", "g", "b"].includes(key))) throw new Error("Unknown color field.");
					color = {
						r: integer("color.r", input.r, 0, 255),
						g: integer("color.g", input.g, 0, 255),
						b: integer("color.b", input.b, 0, 255),
					};
				} else if (values.on === true) color = { r: 255, g: 255, b: 255 };
				else throw new Error("Provide on or color.");
				actions.setPixel(index, x, y, color);
			},
		),
		tool(
			actions,
			"add_matrix_frame",
			"Append a blank frame or a copy of the current frame and select it.",
			{ copyCurrent: { type: "boolean" } },
			[],
			({ copyCurrent }) => {
				if (copyCurrent !== undefined && typeof copyCurrent !== "boolean")
					throw new Error("copyCurrent must be boolean.");
				actions.addFrame(copyCurrent === true);
			},
		),
		tool(
			actions,
			"select_matrix_frame",
			"Select a frame for editing.",
			{ frameIndex },
			["frameIndex"],
			({ frameIndex: value }) => actions.selectFrame(integer("frameIndex", value, 0, 999)),
		),
		tool(
			actions,
			"delete_matrix_frame",
			"Delete a frame; defaults to the current frame. At least one frame remains.",
			{ frameIndex },
			[],
			({ frameIndex: value }) =>
				actions.deleteFrame(value === undefined ? undefined : integer("frameIndex", value, 0, 999)),
		),
		tool(
			actions,
			"preview_matrix_animation",
			"Start the browser-only animation preview. Does not control hardware.",
			{},
			[],
			() => actions.preview(),
		),
		tool(actions, "stop_matrix_animation", "Stop the browser animation preview.", {}, [], () => actions.stop()),
	];
}

export async function registerMatrixTools(context: ModelContext | undefined, tools: Tool[], signal: AbortSignal) {
	if (!context) return;
	for (const item of tools) {
		if (signal.aborted) return;
		await context.registerTool(item, { signal });
	}
}
