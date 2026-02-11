const HasLed = (Base) =>
	class extends Base {
		static CMD = {
			RGB: {
				SET_RGB_VALUE: 0x20 /**< Set RGB value. */,
				GET_RGB_VALUE: 0x21 /**< Get RGB value. */,
				SET_RGB_LIGHT: 0x22 /**< Set RGB brightness. */,
				GET_RGB_LIGHT: 0x23 /**< Get RGB brightness. */,
			},
		};
		async setLedColor(index, num, colors) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			for (let i = 0; i < num; i++) {
				cmdBuffer[2 + i * 3] = colors[i].r;
				cmdBuffer[3 + i * 3] = colors[i].g;
				cmdBuffer[4 + i * 3] = colors[i].b;
			}
			const packet = await bus.sendAndWait(this.id, this.constructor.CMD.RGB.SET_RGB_VALUE, cmdBuffer, num * 3 + 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error(`setLedColor failed.\n`);
			}
		}
		async getLedColor(index, num) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			const packet = await bus.sendAndWait(this.id, this.constructor.CMD.RGB.GET_RGB_VALUE, cmdBuffer, 2);
			let start = 6;
			let count = num;
			if (packet[6] === index && packet[7] === num) {
				start = 8;
				count = packet[7];
			}
			const colors = [];
			for (let i = 0; i < count; i++) {
				colors.push({
					r: packet[start + i * 3],
					g: packet[start + i * 3 + 1],
					b: packet[start + i * 3 + 2],
				});
			}
			return colors;
		}
		// 0-1
		async setLedBrightness(brightness, saveToFlash = 0) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = brightness * 100; // 0-100
			cmdBuffer[1] = saveToFlash;
			const packet = await bus.sendAndWait(this.id, this.constructor.CMD.RGB.SET_RGB_LIGHT, cmdBuffer, 2);
			const result = packet[6];
			if (result !== 1) {
				throw new Error(`setLedBrightness failed.\n`);
			}
		}
		async getLedBrightness() {
			const bus = this.bus;
			const packet = await bus.sendAndWait(this.id, this.constructor.CMD.GET_RGB_LIGHT, bus.cmdBuffer, 0);
			return packet[6];
		}
	};

export default HasLed;
