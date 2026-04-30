import Modules from "modules";

interface ModModule {
	main(): Promise<void> | void;
}

if (Modules.has("basic")) {
	const mod = Modules.importNow("basic") as ModModule;
	await mod.main();
} else {
	trace("No module found.\n");
}
