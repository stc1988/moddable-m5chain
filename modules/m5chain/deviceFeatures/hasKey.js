const HasKey = (Base) =>
	class extends Base {
		static CMD = {
			GET_STATUS: 0xe1 /**< Get key status. */,
			SET_TRIGGER_TIMEOUT: 0xe2 /**< Set trigger timeout. */,
			GET_TRIGGER_TIMEOUT: 0xe3 /**< Get trigger timeout. */,
			SET_MODE: 0xe4 /**< Set key mode. */,
			GET_MODE: 0xe5 /**< Get key mode. */,
		};
		#onKeyPressed = null;
		set onKeyPressed(fn) {
			if (fn !== null && typeof fn !== "function") {
				throw new Error("onKeyPressed must be a function or null");
			}
			this.#onKeyPressed = fn;
		}
		get onKeyPressed() {
			return this.#onKeyPressed;
		}
		onDispatchEvent(buffer) {
			// 0: Single Click
			// 1: Double Click
			// 2: Long Press
			const keyStatus = buffer[6];
			this.onKeyPressed?.(keyStatus);
		}

		// Key Status
		// 0: Not pressed
		// 1: Presse
		async getKeyStatus() {
			const bus = this.bus;
			const returnPacket = await bus.sendAndWait(this.id, HasKey.CMD.GET_STATUS, m5chain.cmdBuffer, 0);
			const keyStatus = returnPacket[6];
			return keyStatus;
		}

		//  Double double-click interval
		//  0～9 (100ms～1000ms)
		//  Note 2: Long long-press interval
		//  0～7 (3s～10s)
		async setKeyTriggerInterval(doubleClick, longPress) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = doubleClick;
			cmdBuffer[1] = longPress;
			const packet = await bus.sendAndWait(this.id, HasKey.CMD.SET_TRIGGER_TIMEOUT, cmdBuffer, 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error(`setKeyTriggerInterval failed.\n`);
			}
		}
		async getKeyTriggerInterval() {
			const bus = this.bus;
			const packet = await bus.sendAndWait(this.id, HasKey.CMD.GET_TRIGGER_TIMEOUT, bus.cmdBuffer, 0);
			return {
				doubleClick: packet[6],
				longPress: packet[7],
			};
		}

		// 0: Non-active reporting
		// 1: Active reporting
		async setKeyMode(mode) {
			const bus = this.bus;
			bus.cmdBuffer[0] = mode;
			const packet = await bus.sendAndWait(this.id, HasKey.CMD.SET_MODE, bus.cmdBuffer, 1);
			const result = packet[6];
			if (result !== 1) {
				throw new Error(`setKeyMode failed.\n`);
			}
		}

		async getKeyMode() {
			const bus = this.bus;
			const packet = bus.sendAndWait(this.id, HasKey.CMD.GET_MODE, bus.cmdBuffer, 0);
			const mode = packet[6];
			return mode;
		}
	};

export default HasKey;
