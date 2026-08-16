import type { M5ChainDevice } from "m5chainDevice";
import type { DeviceConstructor, DeviceMixin, SampleHandler } from "types";

export type CanSampleMethods<T = unknown> = {
	onSample: SampleHandler<T>;
	hasOnSample(): boolean;
	readSample(): Promise<T | undefined>;
	sample(): T | undefined;
	dispatchOnSample(value: T): unknown;
};

const CanSample = <T = unknown>() =>
	(<TBase extends DeviceConstructor<M5ChainDevice>>(Base: TBase) =>
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

			async readSample(): Promise<T | undefined> {
				throw new Error("readSample is not implemented");
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
				const sample = this.sample();
				if (sample === undefined) return;
				return this.#onSample?.(sample);
			}
		}) as DeviceMixin<CanSampleMethods<T>, M5ChainDevice>;

export default CanSample;
