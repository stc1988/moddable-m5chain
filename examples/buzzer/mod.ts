import M5ChainBuzzer, { BUZZER_NOTE } from "m5chainBuzzer";
import M5Chain, { type RegisteredM5ChainDevice } from "m5chain";

const LOG_PREFIX = "[examples/buzzer]";
const BUZZER_DEVICE_CLASSES = Object.freeze([M5ChainBuzzer]);
type BuzzerDevice = RegisteredM5ChainDevice<typeof BUZZER_DEVICE_CLASSES>;

export async function main() {
	log("start");

	const m5chain = new M5Chain({ deviceClasses: BUZZER_DEVICE_CLASSES });

	m5chain.onError = (error, context) => {
		log(`${context.source} failed: ${errorMessage(error)}`);
	};

	m5chain.onDeviceListChanged = async (devices) => {
		const buzzer = findBuzzer(devices);
		if (!buzzer) {
			log("Chain Buzzer not found");
			return;
		}

		log(`buzzer id=${buzzer.id} ready`);
		await buzzer.setLedColor(255, 0, 0);
		await buzzer.playMelody(
			[
				{ note: BUZZER_NOTE.C5, beats: 1.5 },
				{ note: BUZZER_NOTE.G4, beats: 0.5 },
				{ note: BUZZER_NOTE.REST, beats: 1 },
				{ note: BUZZER_NOTE.E4, beats: 1 },
			],
			{ tempoBpm: 120 },
		);
	};

	await m5chain.start();
}

function findBuzzer(devices: readonly BuzzerDevice[]) {
	for (const device of devices) {
		if (device.kind === "buzzer") return device;
	}
	return undefined;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function log(message: string) {
	trace(`${LOG_PREFIX} ${message}\n`);
}
