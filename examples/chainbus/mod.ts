import M5ChainChainBus, { type ChainBusI2CFrequency } from "m5chainChainBus";
import M5Chain, { type RegisteredM5ChainDevice } from "m5chain";

const LOG_PREFIX = "[examples/chainbus]";

// Safe operations run by default. Set the optional tests below to match the connected hardware.
const I2C_FREQUENCY: ChainBusI2CFrequency = 400_000;
const I2C_TEST: I2CTest | null = null;
const RUN_GPIO_TESTS = false;

type I2CTest = {
	address: number;
	readLength: number;
	writeData: Uint8Array;
	register: number;
	registerAddressSize: 1 | 2;
	registerReadLength: number;
	registerWriteData: Uint8Array;
};

type ChainBusDevice = Extract<RegisteredM5ChainDevice<readonly [typeof M5ChainChainBus]>, { kind: "chainbus" }>;

export async function main() {
	log("start");

	const m5chain = new M5Chain({ deviceClasses: [M5ChainChainBus] });

	m5chain.onError = (error, context) => {
		log(`${context.source} failed: ${errorMessage(error)}`);
	};

	m5chain.onDeviceListChanged = async (devices) => {
		log(`found ${devices.length} device(s)`);

		for (const device of devices) {
			if (device.kind === "unknown") {
				log(`unknown id=${device.id} type=0x${device.type.toString(16).padStart(4, "0")}`);
				continue;
			}

			device.onDisconnected = () => log(`chainbus id=${device.id} disconnected`);
			try {
				await runChainBusChecks(device);
			} catch (error) {
				log(`chainbus id=${device.id} check failed: ${errorMessage(error)}`);
			}
		}
	};

	await m5chain.start();
}

async function runChainBusChecks(device: ChainBusDevice) {
	log(`chainbus id=${device.id} uid=${device.uuid}`);

	await device.setLedColor(0, 32, 255);
	await device.setLedBrightness(64);
	log("LED set to blue at 25% brightness");

	await device.i2c.configure({ frequency: I2C_FREQUENCY });
	const addresses = await device.i2c.scan();
	log(`I2C ${I2C_FREQUENCY} Hz addresses=${formatAddresses(addresses)}`);

	if (I2C_TEST) await runI2CTransfers(device, I2C_TEST);
	else log("raw I2C transfers skipped; configure I2C_TEST for the connected peripheral");

	const configuration = await device.readConfiguration();
	log(`modes after I2C setup: gpio1=${configuration.gpio1.mode} gpio2=${configuration.gpio2.mode}`);

	if (RUN_GPIO_TESTS) await runGPIOChecks(device);
	else log("GPIO tests skipped; set RUN_GPIO_TESTS after checking the wiring");
}

async function runI2CTransfers(device: ChainBusDevice, test: I2CTest) {
	const raw = await device.i2c.read(test.address, test.readLength);
	log(`I2C raw read=${formatBytes(raw)}`);

	await device.i2c.write(test.address, test.writeData);
	log(`I2C raw write=${formatBytes(test.writeData)}`);

	const register = await device.i2c.readRegister(
		test.address,
		test.register,
		test.registerAddressSize,
		test.registerReadLength,
	);
	log(`I2C register read=${formatBytes(register)}`);

	await device.i2c.writeRegister(test.address, test.register, test.registerAddressSize, test.registerWriteData);
	log(`I2C register write=${formatBytes(test.registerWriteData)}`);
}

async function runGPIOChecks(device: ChainBusDevice) {
	// GPIO1 must be safe to drive before enabling this test.
	await device.gpio1.configure({ mode: "output", drive: "push-pull", pull: "none" });
	await device.gpio1.write(true);
	log(`gpio1 output high=${await device.gpio1.readOutput()}`);
	await device.gpio1.write(false);
	log(`gpio1 output low=${await device.gpio1.readOutput()}`);

	await device.gpio2.configure({ mode: "input", pull: "up" });
	log(`gpio2 digital input=${await device.gpio2.read()}`);

	await device.gpio2.configure({ mode: "analog" });
	log(`gpio2 ADC=${await device.gpio2.readAnalog()} / 4095`);

	device.gpio2.onInterrupt = (edge) => log(`gpio2 interrupt=${edge}`);
	await device.gpio2.configure({ mode: "interrupt", pull: "up", edge: "both" });
	log(`final modes: gpio1=${await device.gpio1.readMode()} gpio2=${await device.gpio2.readMode()}`);
	log("gpio2 interrupt armed; change its input level to produce events");
}

function formatAddresses(addresses: readonly number[]) {
	if (addresses.length === 0) return "none";
	return addresses.map((address) => `0x${address.toString(16).padStart(2, "0")}`).join(", ");
}

function formatBytes(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function log(message: string) {
	trace(`${LOG_PREFIX} ${message}\n`);
}
