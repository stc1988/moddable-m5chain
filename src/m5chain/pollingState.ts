export default class PollingState {
	#requested = false;
	#running = false;

	get requested(): boolean {
		return this.#requested;
	}

	start(): boolean {
		this.#requested = true;
		if (this.#running) return false;
		this.#running = true;
		return true;
	}

	stop() {
		this.#requested = false;
	}

	finished() {
		this.#running = false;
	}
}
