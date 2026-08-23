import type { RegisteredM5ChainDevice } from "types";

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
