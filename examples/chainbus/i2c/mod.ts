import type { ChainBusI2CFrequency } from "m5chainChainBus";
import { formatBytes, runChainBusExample } from "../common";

const I2C_FREQUENCY: ChainBusI2CFrequency = 400_000;
const GESTURE_ADDRESS = 0x73;

export async function main() {
	await runChainBusExample("i2c", async (device) => {
		await device.i2c.configure({ frequency: I2C_FREQUENCY });
		const addresses = await device.i2c.scan();
		trace(`[examples/chainbus/i2c] ${I2C_FREQUENCY} Hz addresses=${formatAddresses(addresses)}\n`);
		if (!addresses.includes(GESTURE_ADDRESS)) throw new Error("Gesture Unit address 0x73 was not found");

		await device.i2c.writeRegister(GESTURE_ADDRESS, 0xef, 1, Uint8Array.of(0));
		trace("[examples/chainbus/i2c] Gesture register bank selected: 0\n");
		const id = await device.i2c.readRegister(GESTURE_ADDRESS, 0x00, 1, 2);
		trace(`[examples/chainbus/i2c] Gesture device ID=${formatBytes(id)}\n`);
		if (id[0] !== 0x20 || id[1] !== 0x76) throw new Error(`unexpected Gesture device ID ${formatBytes(id)}`);
		trace("[examples/chainbus/i2c] Gesture PAJ7620U2 register read/write verified\n");
	});
}

function formatAddresses(addresses: readonly number[]) {
	return addresses.length
		? addresses.map((address) => `0x${address.toString(16).padStart(2, "0")}`).join(", ")
		: "none";
}
