export const MATRIX_ROTATION = {
	DEG_0: 0,
	DEG_90: 90,
	DEG_180: 180,
	DEG_270: 270,
} as const;
export type MatrixRotation = (typeof MATRIX_ROTATION)[keyof typeof MATRIX_ROTATION];

export const SCROLL_DIRECTION = {
	LEFT: "left",
	RIGHT: "right",
	UP: "up",
	DOWN: "down",
} as const;
export type ScrollDirection = (typeof SCROLL_DIRECTION)[keyof typeof SCROLL_DIRECTION];

export const SCROLL_BEHAVIOR = {
	ONCE: "once",
	LOOP: "loop",
	BOUNCE: "bounce",
} as const;
export type ScrollBehavior = (typeof SCROLL_BEHAVIOR)[keyof typeof SCROLL_BEHAVIOR];

export const SCROLL_STATE = {
	RUNNING: "running",
	PAUSED: "paused",
	STOPPED: "stopped",
} as const;
export type ScrollState = (typeof SCROLL_STATE)[keyof typeof SCROLL_STATE];

export type DisplayCoordinate = {
	x: number;
	y: number;
};

export type ScrollSettings = {
	direction: ScrollDirection;
	behavior: ScrollBehavior;
	intervalMs: number;
};

export type RgbColor = {
	r: number;
	g: number;
	b: number;
};

export type WireDirectionMap = {
	readonly [SCROLL_DIRECTION.LEFT]: number;
	readonly [SCROLL_DIRECTION.RIGHT]: number;
	readonly [SCROLL_DIRECTION.UP]: number;
	readonly [SCROLL_DIRECTION.DOWN]: number;
};

export function assertIntegerInRange(name: string, value: number, min: number, max: number) {
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
	}
}

export function assertUnitInterval(name: string, value: number) {
	if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
		throw new RangeError(`${name} must be between 0 and 1.`);
	}
}

export function assertBoolean(name: string, value: boolean) {
	if (value !== true && value !== false) {
		throw new TypeError(`${name} must be a boolean.`);
	}
}

export function encodeCoordinate(x: number, y: number): number {
	assertIntegerInRange("x", x, 0, 7);
	assertIntegerInRange("y", y, 0, 7);
	return (x << 3) | y;
}

export function encodeCharacter(character: string): number {
	if (typeof character !== "string" || character.length !== 1) {
		throw new RangeError("character must contain exactly one ASCII character.");
	}
	const code = character.charCodeAt(0);
	if (code < 32 || code > 127) {
		throw new RangeError("character must be an ASCII character from code 32 through 127.");
	}
	return code;
}

export function encodeText(text: string): Uint8Array {
	if (typeof text !== "string" || text.length < 1 || text.length > 32) {
		throw new RangeError("text must contain between 1 and 32 ASCII characters.");
	}
	const encoded = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 32 || code > 127) {
			throw new RangeError(`text[${i}] must be an ASCII character from code 32 through 127.`);
		}
		encoded[i] = code;
	}
	return encoded;
}

export function decodeText(data: Uint8Array, offset: number, length: number): string {
	let text = "";
	for (let i = 0; i < length; i++) {
		text += String.fromCharCode(data[offset + i]);
	}
	return text;
}

export function rotationToWire(rotation: MatrixRotation): number {
	switch (rotation) {
		case MATRIX_ROTATION.DEG_0:
			return 0;
		case MATRIX_ROTATION.DEG_90:
			return 1;
		case MATRIX_ROTATION.DEG_180:
			return 2;
		case MATRIX_ROTATION.DEG_270:
			return 3;
		default:
			throw new RangeError(`Unknown matrix rotation: ${rotation}`);
	}
}

export function rotationFromWire(value: number): MatrixRotation {
	switch (value) {
		case 0:
			return MATRIX_ROTATION.DEG_0;
		case 1:
			return MATRIX_ROTATION.DEG_90;
		case 2:
			return MATRIX_ROTATION.DEG_180;
		case 3:
			return MATRIX_ROTATION.DEG_270;
		default:
			throw new Error(`Unknown matrix rotation value: ${value}`);
	}
}

function behaviorToWire(behavior: ScrollBehavior): number {
	switch (behavior) {
		case SCROLL_BEHAVIOR.ONCE:
			return 0;
		case SCROLL_BEHAVIOR.LOOP:
			return 1;
		case SCROLL_BEHAVIOR.BOUNCE:
			return 2;
		default:
			throw new RangeError(`Unknown scroll behavior: ${behavior}`);
	}
}

function behaviorFromWire(value: number): ScrollBehavior {
	switch (value) {
		case 0:
			return SCROLL_BEHAVIOR.ONCE;
		case 1:
			return SCROLL_BEHAVIOR.LOOP;
		case 2:
			return SCROLL_BEHAVIOR.BOUNCE;
		default:
			throw new Error(`Unknown scroll behavior value: ${value}`);
	}
}

function directionToWire(direction: ScrollDirection, directions: WireDirectionMap): number {
	const value = directions[direction];
	if (value === undefined) {
		throw new RangeError(`Unknown scroll direction: ${direction}`);
	}
	return value;
}

function directionFromWire(value: number, directions: WireDirectionMap): ScrollDirection {
	for (const direction of Object.values(SCROLL_DIRECTION)) {
		if (directions[direction] === value) return direction;
	}
	throw new Error(`Unknown scroll direction value: ${value}`);
}

export function encodeScrollMode(
	direction: ScrollDirection,
	behavior: ScrollBehavior,
	directions: WireDirectionMap,
): number {
	return (directionToWire(direction, directions) << 4) | behaviorToWire(behavior);
}

export function decodeScrollMode(value: number, directions: WireDirectionMap) {
	return {
		direction: directionFromWire((value >> 4) & 0x0f, directions),
		behavior: behaviorFromWire(value & 0x0f),
	};
}

export function assertScrollInterval(intervalMs: number) {
	assertIntegerInRange("intervalMs", intervalMs, 0, 0xffff);
}

export function assertColor(name: string, color: RgbColor) {
	if (!color || typeof color !== "object" || Array.isArray(color)) {
		throw new TypeError(`${name} must be an RGB color object.`);
	}
	assertIntegerInRange(`${name}.r`, color.r, 0, 255);
	assertIntegerInRange(`${name}.g`, color.g, 0, 255);
	assertIntegerInRange(`${name}.b`, color.b, 0, 255);
}

export function colorToRgb565(color: RgbColor): number {
	return ((color.r >> 3) << 11) | ((color.g >> 2) << 5) | (color.b >> 3);
}

export function colorFromRgb565(value: number): RgbColor {
	const r = (value >> 11) & 0x1f;
	const g = (value >> 5) & 0x3f;
	const b = value & 0x1f;
	return {
		r: Math.round((r * 255) / 31),
		g: Math.round((g * 255) / 63),
		b: Math.round((b * 255) / 31),
	};
}

export function writeRgb565(data: Uint8Array, offset: number, value: number) {
	data[offset] = value & 0xff;
	data[offset + 1] = (value >> 8) & 0xff;
}

export function scrollStateToWire(state: ScrollState): number {
	switch (state) {
		case SCROLL_STATE.RUNNING:
			return 0;
		case SCROLL_STATE.PAUSED:
			return 1;
		case SCROLL_STATE.STOPPED:
			return 2;
		default:
			throw new RangeError(`Unknown scroll state: ${state}`);
	}
}

export function scrollStateFromWire(value: number): ScrollState {
	switch (value) {
		case 0:
			return SCROLL_STATE.RUNNING;
		case 1:
			return SCROLL_STATE.PAUSED;
		case 2:
			return SCROLL_STATE.STOPPED;
		default:
			throw new Error(`Unknown scroll state value: ${value}`);
	}
}
