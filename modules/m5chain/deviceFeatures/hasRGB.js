const HasRGB = (Base) =>
	class extends Base {
		static CMD = {
			SET_RGB_VALUE: 0x20 /**< Set RGB value. */,
			GET_RGB_VALUE: 0x21 /**< Get RGB value. */,
			SET_RGB_LIGHT: 0x22 /**< Set RGB brightness. */,
			GET_RGB_LIGHT: 0x23 /**< Get RGB brightness. */,
		};
		async setRGBValue(id, index, num, colors) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			for (let i = 0; i < num; i++) {
				cmdBuffer[2 + i * 3] = colors[i].r;
				cmdBuffer[3 + i * 3] = colors[i].g;
				cmdBuffer[4 + i * 3] = colors[i].b;
			}
			const returnPacket = await bus.sendAndWait(id, HasRGB.CMD.SET_RGB_VALUE, cmdBuffer, num * 3 + 2);
			const result = returnPacket[6];
			if (result !== 1) {
				throw new Error(`setRGBValue failed.\n`);
			}
		}
		async getRGBValue(id, index, num) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = index;
			cmdBuffer[1] = num;
			const returnPacket = await bus.sendAndWait(id, HasRGB.CMD.GET_RGB_VALUE, cmdBuffer, 2);
			let start = 6;
			let count = num;
			if (returnPacket[6] === index && returnPacket[7] === num) {
				start = 8;
				count = returnPacket[7];
			}
			const colors = [];
			for (let i = 0; i < count; i++) {
				colors.push({
					r: returnPacket[start + i * 3],
					g: returnPacket[start + i * 3 + 1],
					b: returnPacket[start + i * 3 + 2],
				});
			}
			return colors;
		}
		async setRGBLight(id, rgbBrightness) {
			const bus = this.bus;
			const cmdBuffer = bus.cmdBuffer;
			cmdBuffer[0] = rgbBrightness;
			const returnPacket = await bus.sendAndWait(id, HasRGB.CMD.SET_RGB_LIGHT, cmdBuffer, 1);
			const result = returnPacket[6];
			if (result !== 1) {
				throw new Error(`setRGBLight failed.\n`);
			}
		}
		async getRGBLight(id) {
			const bus = this.bus;
			const returnPacket = await bus.sendAndWait(id, HasRGB.CMD.GET_RGB_LIGHT, bus.cmdBuffer, 0);
			return returnPacket[6];
		}
	};

export default HasRGB;
