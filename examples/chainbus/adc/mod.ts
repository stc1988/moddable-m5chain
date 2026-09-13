import { runChainBusExample } from "../common";

export async function main() {
	await runChainBusExample("adc", async (device) => {
		await device.gpio2.configure({ mode: "analog" });
		const value = await device.gpio2.readAnalog();
		trace(`[examples/chainbus/adc] GPIO2 ADC=${value} / 4095\n`);
	});
}
