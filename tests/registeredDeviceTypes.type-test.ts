import type {
	M5ChainDeviceClass,
	M5ChainRuntimeDevice,
	M5ChainRuntimeHooks,
	RegisteredM5ChainDevice,
	SampleHandler,
} from "types";

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type SampleHandlerResult = ReturnType<Exclude<SampleHandler<number>, null>>;
type _SampleHandlerReturnsVoidOrPromise = Expect<Equal<SampleHandlerResult, void | Promise<void>>>;

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
