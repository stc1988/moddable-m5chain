import { type ChainBusDevice, runChainBusExample } from "../common";

const OUTPUT_TEST_ENABLED = false;

export async function main() {
	await runChainBusExample("gpio-output", async (device) => {
		if (!OUTPUT_TEST_ENABLED) {
			trace("[examples/chainbus/gpio-output] skipped; verify the load, then set OUTPUT_TEST_ENABLED=true\n");
			return;
		}

		await device.gpio1.configure({ mode: "output", drive: "push-pull", pull: "none" });
		await setAndReadBack(device, true);
		await setAndReadBack(device, false);
	});
}

async function setAndReadBack(device: ChainBusDevice, value: boolean) {
	await device.gpio1.write(value);
	trace(`[examples/chainbus/gpio-output] GPIO1 wrote=${value} read=${await device.gpio1.readOutput()}\n`);
}
