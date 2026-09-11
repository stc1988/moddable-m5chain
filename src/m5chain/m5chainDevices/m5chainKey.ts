import HasKey from "hasKey";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, withDeviceFeatures } from "m5chainDevice";
import type { KeyDeviceConfiguration, KeyDeviceConfigurationSnapshot } from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static readonly DEVICE_TYPE = 0x0003;
	override readonly kind = "key" as const;

	override async configure(options: KeyDeviceConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["key"]);
		await super.configure(options);
	}

	override async readConfiguration(): Promise<KeyDeviceConfigurationSnapshot> {
		return await super.readConfiguration();
	}
}

export default M5ChainKey;
