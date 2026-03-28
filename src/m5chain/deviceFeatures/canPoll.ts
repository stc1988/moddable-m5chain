import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, PollHandler } from "types";

type CanPollMethods<T = unknown> = {
	onPoll: PollHandler<T>;
	hasOnPoll(): boolean;
	polling(): Promise<T | undefined>;
	dispatchOnPoll(value: T): void;
};

const CanPoll = <TBase extends DeviceConstructor<M5ChainDevice>>(Base: TBase) =>
	class extends Base {
		#onPoll: PollHandler = null;

		set onPoll(fn: PollHandler) {
			this.#onPoll = fn;
			this.bus._notifyPollingStateChanged();
		}

		get onPoll(): PollHandler {
			return this.#onPoll;
		}

		hasOnPoll() {
			return !!this.#onPoll;
		}

		async polling(): Promise<unknown> {
			throw Error("polling is not implemented");
		}

		dispatchOnPoll(value: unknown) {
			this.#onPoll?.(value);
		}
	};

export default CanPoll as DeviceMixin<DeviceConstructor<M5ChainDevice>, CanPollMethods>;
