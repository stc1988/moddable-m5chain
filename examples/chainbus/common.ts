import M5ChainChainBus from "m5chainChainBus";
import M5Chain, { type RegisteredM5ChainDevice } from "m5chain";

export type ChainBusDevice = Extract<RegisteredM5ChainDevice<readonly [typeof M5ChainChainBus]>, { kind: "chainbus" }>;

export async function runChainBusExample(prefix: string, check: (device: ChainBusDevice) => Promise<void>) {
	const log = (message: string) => trace(`[examples/chainbus/${prefix}] ${message}\n`);
	log("start");

	const m5chain = new M5Chain({ deviceClasses: [M5ChainChainBus] });
	m5chain.onError = (error, context) => log(`${context.source} failed: ${errorMessage(error)}`);
	m5chain.onDeviceListChanged = async (devices) => {
		log(`found ${devices.length} device(s)`);
		for (const device of devices) {
			if (device.kind === "unknown") continue;
			device.onDisconnected = () => log(`chainbus id=${device.id} disconnected`);
			log(`chainbus id=${device.id} uid=${device.uuid}`);
			try {
				await check(device);
			} catch (error) {
				log(`chainbus id=${device.id} check failed: ${errorMessage(error)}`);
			}
		}
	};
	await m5chain.start();
}

export function formatBytes(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
