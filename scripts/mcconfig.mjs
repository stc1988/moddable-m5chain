import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MODES = ["build", "debug", "xsdb"];

export function createMcconfigArgs(mode, platform) {
	if (!MODES.includes(mode)) {
		throw new RangeError(`Unknown mcconfig mode: ${mode}`);
	}
	if (!platform || platform.startsWith("-")) {
		throw new TypeError("A platform name such as esp32/m5atom_matrix is required.");
	}

	const args = [mode === "xsdb" ? "-dl" : "-d", "-m", "-p", platform];
	if (mode === "build") {
		args.push("-t", "build");
	}
	return args;
}

function main(argv) {
	const [mode, platform, ...extra] = argv;
	if (extra.length > 0) {
		throw new RangeError(`Unexpected arguments: ${extra.join(" ")}`);
	}

	const result = spawnSync("mcconfig", createMcconfigArgs(mode, platform), {
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	try {
		main(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
