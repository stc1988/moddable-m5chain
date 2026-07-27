import { M5ChainDevice } from "m5chainDevice";
import type { ChainBus, DeviceFactoryOptions } from "types";

class M5ChainUnknownDevice extends M5ChainDevice {
	readonly kind = "unknown" as const;
	readonly known = false;
	#type: number;

	constructor(bus: ChainBus, options: DeviceFactoryOptions) {
		super(bus, options);
		this.#type = options.type;
	}

	get type(): number {
		return this.#type;
	}
}

export default M5ChainUnknownDevice;
