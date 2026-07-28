import M5Chain, {
	type LedColor,
	type M5ChainDevice,
	MATRIX_ROTATION,
	SCROLL_BEHAVIOR,
	SCROLL_DIRECTION,
} from "m5chain";

const LOG_PREFIX = "[examples/matrix]";

export async function main() {
	log("start");

	const m5chain = new M5Chain();

	m5chain.onError = (error, context) => {
		log(`${context.source} failed: ${errorMessage(error)}`);
	};

	m5chain.onDeviceListChanged = async (devices) => {
		for (const device of devices) {
			switch (device.kind) {
				case "mono":
					await showMono(device);
					break;
				case "rgb":
					await showRGB(device);
					break;
			}
		}
	};

	await m5chain.start();
}

async function showMono(mono: Extract<M5ChainDevice, { kind: "mono" }>) {
	await mono.configure({
		display: {
			rotation: MATRIX_ROTATION.DEG_0,
			brightness: 0.5,
		},
	});
	await mono.writeFrame(
		new Uint8Array([0b00111100, 0b01000010, 0b10100101, 0b10000001, 0b10100101, 0b10011001, 0b01000010, 0b00111100]),
	);
	log(`Mono id=${mono.id} showing a frame`);
}

async function showRGB(rgb: Extract<M5ChainDevice, { kind: "rgb" }>) {
	await rgb.configure({
		display: {
			rotation: MATRIX_ROTATION.DEG_0,
			brightness: 0.5,
		},
	});
	const colors: LedColor[] = [];
	for (let y = 0; y < rgb.height; y++) {
		for (let x = 0; x < rgb.width; x++) {
			colors.push({
				r: x * 32,
				g: y * 32,
				b: 64,
			});
		}
	}
	await rgb.writeFrame(colors);
	await rgb.scrollText("M5STACK", {
		direction: SCROLL_DIRECTION.LEFT,
		behavior: SCROLL_BEHAVIOR.LOOP,
		intervalMs: 100,
		color: "gradient",
	});
	log(`RGB id=${rgb.id} scrolling text`);
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function log(message: string) {
	trace(`${LOG_PREFIX} ${message}\n`);
}
