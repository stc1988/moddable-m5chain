import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, SampleHandler } from "types";

type CanPollMethods<T = unknown> = {
	onSample: SampleHandler<T>;
	hasOnSample(): boolean;
	polling(): Promise<T | undefined>;
	sample(): T | undefined;
	dispatchOnSample(value: T): void;
};

type CanPollMixin = <T = unknown, TBase extends DeviceConstructor<M5ChainDevice> = DeviceConstructor<M5ChainDevice>>(
	Base: TBase,
) => (new (...args: ConstructorParameters<TBase>) => InstanceType<TBase> & CanPollMethods<T>) & TBase;

const CanPoll = <T = unknown, TBase extends DeviceConstructor<M5ChainDevice> = DeviceConstructor<M5ChainDevice>>(
	Base: TBase,
) =>
	class extends Base {
		#onSample: SampleHandler<T> = null;
		#sample: T | undefined;

		set onSample(fn: SampleHandler<T>) {
			if (fn !== null && typeof fn !== "function") {
				throw new Error("onSample must be a function or null");
			}

			const wasActive = this.#onSample !== null;
			const nextActive = fn !== null;
			this.#onSample = fn;
			if (wasActive !== nextActive) {
				this.bus._notifyPollingStateChanged();
			}
		}

		get onSample(): SampleHandler<T> {
			return this.#onSample;
		}

		hasOnSample() {
			return this.#onSample !== null;
		}

		async polling(): Promise<T | undefined> {
			throw new Error("polling is not implemented");
		}

		sample(): T | undefined {
			const value = this.#sample;
			if (value && typeof value === "object") {
				return { ...value };
			}
			return value;
		}

		dispatchOnSample(value: T) {
			this.#sample = value;
			this.#onSample?.call(this);
		}
	};

export default CanPoll as CanPollMixin & DeviceMixin<DeviceConstructor<M5ChainDevice>, CanPollMethods>;
