import CanSample from "canSample";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";
import type {
	M5ChainDeviceClass,
	M5ChainRuntimeDevice,
	M5ChainRuntimeHooks,
	M5ChainTransport,
	RegisteredM5ChainDevice,
	SampleHandler,
} from "types";

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type SampleHandlerResult = ReturnType<Exclude<SampleHandler<number>, null>>;
type _SampleHandlerReturnsVoidOrPromise = Expect<Equal<SampleHandlerResult, void | Promise<void>>>;

declare const transport: M5ChainTransport;
transport.readable.getReader().releaseLock();
transport.writable.getWriter().releaseLock();

declare const sampleHooks: M5ChainRuntimeHooks<number>;

if (sampleHooks.readSample && sampleHooks.dispatchOnSample) {
	const sample = await sampleHooks.readSample();
	if (sample !== undefined) {
		sampleHooks.dispatchOnSample(sample);
	}

	// @ts-expect-error The runtime hook owns its sample type; callers cannot replace it.
	await sampleHooks.readSample<string>();
	// @ts-expect-error A number sample hook cannot dispatch another sample type.
	sampleHooks.dispatchOnSample("invalid");
}

interface TestDevice extends M5ChainRuntimeDevice {
	readonly kind: "test";
	readonly known: boolean;
}

declare const TestDevice: M5ChainDeviceClass<TestDevice>;
declare const device: RegisteredM5ChainDevice<readonly [typeof TestDevice]>;

if (device.known) {
	const knownKind: "test" = device.kind;
	void knownKind;
} else {
	const unknownKind: "unknown" = device.kind;
	void unknownKind;
}

declare class IncompleteDevice {
	static readonly DEVICE_TYPE: 2;
	readonly kind: "incomplete";
}

// @ts-expect-error Registered device classes must implement the runtime device contract.
type _IncompleteDeviceRegistry = RegisteredM5ChainDevice<readonly [typeof IncompleteDevice]>;

import M5ChainAngle from "m5chainAngle";
import M5ChainChainBus, { type ChainBusGPIOMode } from "m5chainChainBus";
import M5ChainEncoder from "m5chainEncoder";
import M5Chain from "m5chain";

const chain = new M5Chain({ deviceClasses: [M5ChainAngle, M5ChainEncoder], transport });
// @ts-expect-error Custom transport and UART pins are mutually exclusive.
new M5Chain({ deviceClasses: [], transport, transmit: 1 });
// @ts-expect-error Device IDs are fixed.
M5ChainEncoder.DEVICE_TYPE = 2;
type _EncoderIdIsLiteral = Expect<Equal<typeof M5ChainEncoder.DEVICE_TYPE, 1>>;
for (const device of chain.devices) {
	if (device.kind === "angle") {
		await device.configure({ rotationDirection: 0 });
		// @ts-expect-error Angle has no key settings.
		await device.configure({ key: { mode: 1 } });
	}
	if (device.kind === "encoder") {
		await device.configure({ key: { mode: 1 } });
	}
}
const chainBusChain = new M5Chain({ deviceClasses: [M5ChainChainBus], transport });
for (const device of chainBusChain.devices) {
	if (device.kind === "chainbus") {
		await device.i2c.configure({ frequency: 400_000 });
		await device.gpio1.configure({ mode: "interrupt", edge: "both" });
		const mode: ChainBusGPIOMode = await device.gpio1.readMode();
		void mode;
		device.gpio2.onInterrupt = async (edge) => {
			const typedEdge: "rising" | "falling" = edge;
			void typedEdge;
		};
		// @ts-expect-error Unsupported I2C speed.
		await device.i2c.configure({ frequency: 1_000_000 });
		// @ts-expect-error Analog mode has no pull option.
		await device.gpio1.configure({ mode: "analog", pull: "up" });
	}
}
const SampleDevice = withDeviceFeatures(HasLed, CanSample<number>());
declare const sampled: InstanceType<typeof SampleDevice>;
const latest: number | undefined = sampled.sample();
void latest;
await sampled.setLedColor(1, 2, 3);
// @ts-expect-error Composition must preserve the sample type.
sampled.dispatchOnSample("wrong");
// @ts-expect-error No key feature was composed.
sampled.isKeyPressed();
