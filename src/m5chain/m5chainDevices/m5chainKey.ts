import HasKey, { type HasKeyMethods } from "hasKey";
import HasLed, { type HasLedMethods } from "hasLed";
import { assertKnownConfigurationOptions, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot } from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Runtime mixins install the merged feature methods.
class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static DEVICE_TYPE = 0x0003;
	readonly kind = "key" as const;

	async configure(options: DeviceConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["key"]);
		await super.configure(options);
	}

	async readConfiguration(): Promise<DeviceConfigurationSnapshot> {
		return await super.readConfiguration();
	}
}

interface M5ChainKey extends HasLedMethods, HasKeyMethods {}

export default M5ChainKey;
