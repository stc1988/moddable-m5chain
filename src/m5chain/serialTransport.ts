import Serial from "embedded:io/serial";
import type { M5ChainTransport } from "types";
import { ReadableStream, type ReadableStreamDefaultController, WritableStream } from "web/streams";

export type SerialTransportOptions = {
	transmit: number;
	receive: number;
	baud?: number;
	port?: number;
};

type PendingWrite = {
	chunk: Uint8Array;
	offset: number;
	resolve: () => void;
	reject: (reason?: unknown) => void;
};

export default function createSerialTransport(options: SerialTransportOptions): M5ChainTransport {
	let serial: Serial | undefined;
	let readController: ReadableStreamDefaultController<Uint8Array> | undefined;
	let pendingWrite: PendingWrite | undefined;
	let writableBytes = 0;
	let closed = false;

	const drainWrite = (io = serial) => {
		if (!io || !pendingWrite) return;

		const remaining = pendingWrite.chunk.byteLength - pendingWrite.offset;
		const count = Math.min(writableBytes, remaining);
		if (count <= 0) return;

		const end = pendingWrite.offset + count;
		io.write(pendingWrite.chunk.subarray(pendingWrite.offset, end));
		writableBytes -= count;
		pendingWrite.offset = end;

		if (end === pendingWrite.chunk.byteLength) {
			const resolve = pendingWrite.resolve;
			pendingWrite = undefined;
			resolve();
		}
	};

	const readable = new ReadableStream(
		{
			start(controller) {
				readController = controller;
			},
			cancel() {
				readController = undefined;
			},
		},
		{ highWaterMark: 0 },
	);

	const writable = new WritableStream<Uint8Array>({
		write(chunk) {
			if (closed) throw new Error("M5Chain serial transport is closed.");
			if (!(chunk instanceof Uint8Array)) throw new TypeError("M5Chain transport writes must be Uint8Array values.");

			return new Promise<void>((resolve, reject) => {
				pendingWrite = { chunk, offset: 0, resolve, reject };
				drainWrite();
			});
		},
		abort(reason) {
			const reject = pendingWrite?.reject;
			pendingWrite = undefined;
			reject?.(reason);
		},
	});

	serial = new Serial({
		transmit: options.transmit,
		receive: options.receive,
		baud: options.baud ?? 115200,
		format: "buffer",
		port: options.port ?? 1,
		onReadable(bytesReadable) {
			const readResult = this.read(bytesReadable);
			if (!(readResult instanceof ArrayBuffer)) return;
			if (!readController) return;
			readController.enqueue(new Uint8Array(readResult));
		},
		onWritable(bytesWritable) {
			writableBytes = bytesWritable;
			drainWrite(this);
		},
	});

	return {
		readable,
		writable,
		close() {
			if (closed) return;
			closed = true;
			serial?.close();
			serial = undefined;
			writableBytes = 0;
			const reject = pendingWrite?.reject;
			pendingWrite = undefined;
			reject?.(new Error("M5Chain serial transport closed during write."));
			try {
				readController?.close();
			} catch {
				// The consumer may already have canceled the readable stream.
			}
			readController = undefined;
		},
	};
}
