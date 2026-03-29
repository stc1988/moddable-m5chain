import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, PollHandler } from "types";

type CanPollMethods<T = unknown> = {
	onPoll: PollHandler<T>;
	hasOnPoll(): boolean;
	polling(): Promise<T | undefined>;
	dispatchOnPoll(value: T): void;
};

type CanPollMixin = <T = unknown, TBase extends DeviceConstructor<M5ChainDevice> = DeviceConstructor<M5ChainDevice>>(
	Base: TBase,
) => (new (...args: ConstructorParameters<TBase>) => InstanceType<TBase> & CanPollMethods<T>) & TBase;

const CanPoll = <T = unknown, TBase extends DeviceConstructor<M5ChainDevice> = DeviceConstructor<M5ChainDevice>>(
	Base: TBase,
) =>
	class extends Base {
		#onPoll: PollHandler<T> = null;

		set onPoll(fn: PollHandler<T>) {
			if (fn !== null && typeof fn !== "function") {
				throw new Error("onPoll must be a function or null");
			}

			const wasActive = this.#onPoll !== null;
			const nextActive = fn !== null;
			this.#onPoll = fn;
			if (wasActive !== nextActive) {
				this.bus._notifyPollingStateChanged();
			}
		}

		get onPoll(): PollHandler<T> {
			return this.#onPoll;
		}

		hasOnPoll() {
			return this.#onPoll !== null;
		}

		async polling(): Promise<T | undefined> {
			throw new Error("polling is not implemented");
		}

		dispatchOnPoll(value: T) {
			this.#onPoll?.(value);
		}
	};

export default CanPoll as CanPollMixin & DeviceMixin<DeviceConstructor<M5ChainDevice>, CanPollMethods>;
