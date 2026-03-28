const CanPoll = (Base) =>
	class extends Base {
		#onPoll = null;
		#lastPollValue;

		set onPoll(fn) {
			this.#onPoll = fn;
			this.bus._notifyPollingStateChanged();
		}

		get onPoll() {
			return this.#onPoll;
		}
		hasOnPoll() {
			return !!this.#onPoll;
		}

		async polling() {
			throw Error("polling is not implemented");
		}

		dispatchOnPoll(value) {
			this.#onPoll?.(value);
		}
	};

export default CanPoll;
