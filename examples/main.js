import Modules from "modules";

if (Modules.has("mod")) {
	const mod = Modules.importNow("mod");
	await mod.main();
}
