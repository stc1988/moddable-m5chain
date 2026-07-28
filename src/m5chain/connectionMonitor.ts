export default class ConnectionMonitor {
	#failureCount = 0;
	readonly failureThreshold: number;

	constructor(failureThreshold = 3) {
		if (!Number.isInteger(failureThreshold) || failureThreshold < 1) {
			throw new RangeError("failureThreshold must be a positive integer.");
		}
		this.failureThreshold = failureThreshold;
	}

	observeDeviceCount(expectedCount: number, observedCount: number): boolean {
		this.#failureCount = 0;
		return expectedCount !== observedCount;
	}

	observeFailure(): boolean {
		this.#failureCount += 1;
		return this.#failureCount >= this.failureThreshold;
	}

	reset() {
		this.#failureCount = 0;
	}
}
