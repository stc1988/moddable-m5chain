export type ConnectionConfig = {
	transmit: number;
	receive: number;
};

type PartialConnectionConfig = Partial<ConnectionConfig>;

function readConnectionConfig(value: unknown): PartialConnectionConfig | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

	if (!("m5chain" in value)) return undefined;
	const { m5chain } = value;
	if (!m5chain || typeof m5chain !== "object" || Array.isArray(m5chain)) return undefined;

	const config: PartialConnectionConfig = {};
	if (
		"transmit" in m5chain &&
		typeof m5chain.transmit === "number" &&
		Number.isInteger(m5chain.transmit) &&
		m5chain.transmit >= 0
	) {
		config.transmit = m5chain.transmit;
	}
	if (
		"receive" in m5chain &&
		typeof m5chain.receive === "number" &&
		Number.isInteger(m5chain.receive) &&
		m5chain.receive >= 0
	) {
		config.receive = m5chain.receive;
	}
	return config;
}

function resolveConnectionConfig(modConfig: unknown, appConfig: unknown, defaults: ConnectionConfig): ConnectionConfig {
	const modConnection = readConnectionConfig(modConfig);
	const appConnection = readConnectionConfig(appConfig);

	return {
		transmit: modConnection?.transmit ?? appConnection?.transmit ?? defaults.transmit,
		receive: modConnection?.receive ?? appConnection?.receive ?? defaults.receive,
	};
}

export { resolveConnectionConfig };
