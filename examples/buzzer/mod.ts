import M5Chain, { BUZZER_NOTE, type M5ChainDevice } from "m5chain";
import Timer from "timer";

const LOG_PREFIX = "[examples/buzzer]";

export async function main() {
	log("start");

	const m5chain = new M5Chain();

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
		await buzzer.playTone({
			frequencyHz: 1000,
			dutyCycle: 0.5,
			durationMs: 500,
		});
		Timer.delay(600);
		await buzzer.playNote({
			note: BUZZER_NOTE.C4,
			durationMs: 250,
		});
	};

	await m5chain.start();
}

function findBuzzer(devices: readonly M5ChainDevice[]) {
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
