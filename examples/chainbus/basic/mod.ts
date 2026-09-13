import { runChainBusExample } from "chainbusExample";

export async function main() {
	await runChainBusExample("basic", async (device) => {
		await device.setLedColor(0, 32, 255);
		await device.setLedBrightness(64);
		const configuration = await device.readConfiguration();
		trace(`[examples/chainbus/basic] LED set; gpio1=${configuration.gpio1.mode} gpio2=${configuration.gpio2.mode}\n`);
	});
}
