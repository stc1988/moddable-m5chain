import { runChainBusExample } from "../common";

export async function main() {
	await runChainBusExample("gpio-input", async (device) => {
		await device.gpio2.configure({ mode: "input", pull: "none" });
		trace(`[examples/chainbus/gpio-input] PIR initial detected=${await device.gpio2.read()}\n`);

		device.gpio2.onInterrupt = (edge) => trace(`[examples/chainbus/gpio-input] PIR edge=${edge}\n`);
		await device.gpio2.configure({ mode: "interrupt", pull: "none", edge: "both" });
		trace("[examples/chainbus/gpio-input] PIR interrupt armed on GPIO2; move in front of the sensor\n");
	});
}
