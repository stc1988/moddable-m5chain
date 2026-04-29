import HasKey from "hasKey";
import HasLed from "hasLed";
import { assertKnownConfigurationOptions, withDeviceFeatures } from "m5chainDevice";
import type { DeviceConfiguration, DeviceConfigurationSnapshot } from "types";

export { KEY_EVENT, KEY_MODE, KEY_STATUS, type KeyEvent, type KeyMode, type KeyStatus } from "hasKey";

class M5ChainKey extends withDeviceFeatures(HasLed, HasKey) {
	static DEVICE_TYPE = 0x0003;

	async configure(options: DeviceConfiguration = {}): Promise<void> {
		assertKnownConfigurationOptions(options, ["led", "key"]);
		await super.configure(options);
	}

	async readConfiguration(): Promise<DeviceConfigurationSnapshot> {
		return await super.readConfiguration();
	}
}

export default M5ChainKey;
