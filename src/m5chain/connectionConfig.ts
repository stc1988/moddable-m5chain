export type ConnectionConfig = {
	transmit: number;
	receive: number;
};

type PartialConnectionConfig = Partial<ConnectionConfig>;

function readConnectionConfig(value: unknown): PartialConnectionConfig | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

	const m5chain = (value as { m5chain?: unknown }).m5chain;
	if (!m5chain || typeof m5chain !== "object" || Array.isArray(m5chain)) return undefined;

	const config = m5chain as PartialConnectionConfig;
	return {
		transmit: config.transmit,
		receive: config.receive,
	};
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
