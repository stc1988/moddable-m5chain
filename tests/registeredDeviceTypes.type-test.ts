import type { RegisteredM5ChainDevice, SampleHandler } from "types";

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type SampleHandlerResult = ReturnType<Exclude<SampleHandler<number>, null>>;
type _SampleHandlerReturnsVoidOrPromise = Expect<Equal<SampleHandlerResult, void | Promise<void>>>;

declare class TestDevice {
	static readonly DEVICE_TYPE: 1;
	readonly kind: "test";
	readonly known: boolean;
}

declare const device: RegisteredM5ChainDevice<readonly [typeof TestDevice]>;

if (device.known) {
	const knownKind: "test" = device.kind;
	void knownKind;
} else {
	const unknownKind: "unknown" = device.kind;
	void unknownKind;
}
