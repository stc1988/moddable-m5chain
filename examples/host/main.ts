import M5Chain from "m5chain";

const m5chain = new M5Chain();

m5chain.onError = (error, context) => {
	trace(`[examples/host] ${context.source} failed: ${error}\n`);
};

m5chain.onDeviceListChanged = (devices) => {
	trace(`[examples/host] found ${devices.length} device(s)\n`);

	for (const device of devices) {
		trace(`[examples/host] id=${device.id} kind=${device.kind} uid=${device.uuid}\n`);
	}
};

await m5chain.start();
