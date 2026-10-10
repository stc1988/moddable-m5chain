export default class ChecksumOut {
	constructor(options) {
		Object.defineProperties(this, {
			width: { value: options.width },
			height: { value: options.height },
			pixelFormat: { value: options.pixelFormat ?? 0 },
		});
	}

	begin() {}

	send() {}

	end() {}

	continue() {}

	adaptInvalid() {}

	configure() {}
}
