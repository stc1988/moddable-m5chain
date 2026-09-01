import { M5ChainDevice } from "m5chainDevice";
import M5Chain, { type M5ChainTransport } from "m5chain";
import { ReadableStream, type ReadableStreamDefaultController, WritableStream } from "web/streams";

const SIMULATED_DEVICE_TYPE = 0x1234;

class SimulatedDevice extends M5ChainDevice {
	static DEVICE_TYPE = SIMULATED_DEVICE_TYPE;
	readonly kind = "simulated" as const;
}

class MockM5ChainTransport implements M5ChainTransport {
	readonly readable: ReadableStream<Uint8Array>;
	readonly writable: WritableStream<Uint8Array>;
	#controller: ReadableStreamDefaultController<Uint8Array> | undefined;

	constructor() {
		this.readable = new ReadableStream({
			start: (controller) => {
				this.#controller = controller;
			},
		});
		this.writable = new WritableStream({
			write: (packet) => {
				this.#respond(packet);
			},
		});
	}

	close() {
		this.#controller?.close();
		this.#controller = undefined;
	}

	#respond(packet: Uint8Array) {
		const id = packet[4];
		const command = packet[5];
		if (id === undefined || command === undefined) throw new Error("Mock received a truncated request.");

		let data: Uint8Array;
		switch (command) {
			case M5Chain.CMD.HEARTBEAT:
				data = new Uint8Array(0);
				break;
			case M5Chain.CMD.ENUM:
				data = Uint8Array.of(1);
				break;
			case M5Chain.CMD.GET_DEVICE_TYPE:
				data = Uint8Array.of(SIMULATED_DEVICE_TYPE & 0xff, SIMULATED_DEVICE_TYPE >> 8);
				break;
			case M5ChainDevice.CMD.GET_UID:
				data = Uint8Array.of(1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
				break;
			default:
				throw new Error(`Mock received unsupported command 0x${command.toString(16)}.`);
		}

		const response = createPacket(id, command, data);
		this.#controller?.enqueue(response.slice(0, 5));
		this.#controller?.enqueue(response.slice(5));
	}
}

function createPacket(id: number, command: number, data: Uint8Array) {
	const packet = new Uint8Array(data.byteLength + 9);
	packet[0] = 0xaa;
	packet[1] = 0x55;
	packet[2] = data.byteLength + 3;
	packet[4] = id;
	packet[5] = command;
	packet.set(data, 6);

	let crc = 0;
	for (const byte of packet.subarray(4, packet.byteLength - 3)) {
		crc = (crc + byte) & 0xff;
	}
	packet[packet.byteLength - 3] = crc;
	packet[packet.byteLength - 2] = 0x55;
	packet[packet.byteLength - 1] = 0xaa;
	return packet;
}

const m5chain = new M5Chain({
	deviceClasses: [SimulatedDevice],
	transport: new MockM5ChainTransport(),
	connectionCheckInterval: 0,
});

await m5chain.start();
const [simulated] = m5chain.devices;
if (m5chain.devices.length !== 1 || simulated?.kind !== "simulated" || simulated.uuid !== "0102030405060708090A0B0C") {
	throw new Error("Stream transport simulator verification failed.");
}
trace(`[examples/simulator] PASS id=${simulated.id} uid=${simulated.uuid}\n`);
await m5chain.close();
