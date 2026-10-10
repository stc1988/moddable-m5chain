import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultTarget = "esp32/m5atom_matrix";

export function parseArgs(argv) {
	const options = {
		target: defaultTarget,
		outputDirectory: path.join(root, "build"),
		modOnly: false,
		keepTemporaryFiles: false,
		snapshot: false,
	};

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		switch (argument) {
			case "--target":
				options.target = requireValue(argv, ++index, argument);
				break;
			case "--output-dir":
				options.outputDirectory = path.resolve(requireValue(argv, ++index, argument));
				break;
			case "--mod-only":
				options.modOnly = true;
				break;
			case "--keep-temp":
				options.keepTemporaryFiles = true;
				break;
			case "--snapshot":
				options.snapshot = true;
				break;
			case "--help":
				options.help = true;
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}

	return options;
}

function requireValue(argv, index, argument) {
	const value = argv[index];
	if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
	return value;
}

export function formatBytes(bytes) {
	return `${bytes.toLocaleString("en-US")} B`;
}

export function snapshotReportName(target, build) {
	return `${target.replaceAll("/", "-")}-${build}`;
}

export function createMarkdown(report) {
	const lines = [
		"# M5Chain size report",
		"",
		`Generated: ${report.generatedAt}`,
		`Target: \`${report.target}\``,
		`Build: \`${report.build}\``,
		`Moddable SDK: \`${report.moddable.version}\` (\`${report.moddable.revision}\`${
			report.moddable.dirty ? ", dirty" : ""
		})`,
		`M5Chain: \`${report.m5chain.revision}\`${report.m5chain.dirty ? " (dirty)" : ""}`,
		"",
	];

	if (report.host) {
		lines.push(
			"## Host",
			"",
			"| Build | Size | Increment |",
			"| --- | ---: | ---: |",
			`| Baseline | ${formatBytes(report.host.baselineBytes)} | — |`,
			`| M5Chain core | ${formatBytes(report.host.withM5ChainBytes)} | ${formatSignedBytes(
				report.host.incrementalBytes,
			)} |`,
			"",
		);
	}

	lines.push(
		"## Mods",
		"",
		"Each increment is measured against the same `mod-base` archive.",
		"",
		"| Mod | Archive size | Increment |",
		"| --- | ---: | ---: |",
		`| mod-base | ${formatBytes(report.mods.baselineBytes)} | — |`,
	);
	for (const device of report.mods.devices) {
		lines.push(
			`| ${device.name} | ${formatBytes(device.archiveBytes)} | ${formatSignedBytes(device.incrementalBytes)} |`,
		);
	}
	lines.push(
		`| all devices | ${formatBytes(report.mods.allDevices.archiveBytes)} | ${formatSignedBytes(
			report.mods.allDevices.incrementalBytes,
		)} |`,
		"",
	);

	return `${lines.join("\n")}\n`;
}

function formatSignedBytes(bytes) {
	const sign = bytes >= 0 ? "+" : "−";
	return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? root,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr.on("data", (chunk) => {
			output += chunk;
		});
		child.on("error", (error) => reject(new Error(`Unable to start ${command}: ${error.message}`)));
		child.on("exit", (code) => {
			if (code === 0) resolve(output);
			else reject(new Error(`${command} exited with code ${code}.\n${output}`));
		});
	});
}

function git(directory, ...args) {
	return run("git", ["-C", directory, ...args]).then((output) => output.trim());
}

function sdkTool(moddable, name) {
	const host = { darwin: "mac", linux: "lin", win32: "win" }[process.platform];
	if (!host) throw new Error(`Unsupported build host: ${process.platform}`);
	const executable = path.join(moddable, "build", "bin", host, "release", `${name}${host === "win" ? ".exe" : ""}`);
	if (!existsSync(executable)) {
		throw new Error(`Build the Moddable SDK tools first; ${executable} was not found.`);
	}
	return executable;
}

async function repositoryIdentity(directory, version) {
	const [revision, describe, status] = await Promise.all([
		git(directory, "rev-parse", "HEAD"),
		git(directory, "describe", "--tags", "--always", "--dirty"),
		git(directory, "status", "--short"),
	]);
	return {
		...(version ? { version } : {}),
		revision,
		describe,
		dirty: status.length > 0,
	};
}

function writeProject(directory, name, manifest) {
	mkdirSync(directory, { recursive: true });
	writeFileSync(path.join(directory, "probe.js"), "export default function () {}\n");
	writeFileSync(
		path.join(directory, "manifest.json"),
		`${JSON.stringify({ build: { NAME: name }, ...manifest }, null, "\t")}\n`,
	);
}

function findArtifacts(directory, fileName) {
	const matches = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) matches.push(...findArtifacts(entryPath, fileName));
		else if (entry.name === fileName) matches.push(entryPath);
	}
	return matches;
}

async function buildArchive(tool, workDirectory, target, name, includes) {
	const projectDirectory = path.join(workDirectory, "projects", name);
	const outputDirectory = path.join(workDirectory, "outputs", name);
	writeProject(projectDirectory, name, {
		include: includes,
		modules: { "*": "./probe" },
	});
	mkdirSync(outputDirectory, { recursive: true });

	console.log(`Building mod ${name}...`);
	await run(tool, [
		"-dn",
		"-m",
		"-p",
		target,
		"-t",
		"build",
		"-o",
		outputDirectory,
		path.join(projectDirectory, "manifest.json"),
	]);
	const artifacts = findArtifacts(outputDirectory, `${name}.xsa`);
	if (artifacts.length !== 1) throw new Error(`Expected one ${name}.xsa, found ${artifacts.length}.`);
	return statSync(artifacts[0]).size;
}

async function buildHost(tool, workDirectory, target, name, includes) {
	if (!target.startsWith("esp32/")) {
		throw new Error("Host measurement currently supports esp32 targets. Use --mod-only for another target.");
	}

	const projectDirectory = path.join(workDirectory, "projects", name);
	const outputDirectory = path.join(workDirectory, "outputs", name);
	writeProject(projectDirectory, name, {
		include: includes,
		defines: { XS_MODS: 1, main: { async: 1 } },
		config: { startupSound: false, startupVibration: false },
		creation: { heap: { initial: 8192, incremental: 0 } },
		modules: { "*": "./probe" },
		strip: [],
	});
	mkdirSync(outputDirectory, { recursive: true });

	console.log(`Building host ${name}...`);
	await run(tool, [
		"-dn",
		"-m",
		"-p",
		target,
		"-t",
		"build",
		"-o",
		outputDirectory,
		path.join(projectDirectory, "manifest.json"),
	]);
	const artifacts = findArtifacts(outputDirectory, "xs_esp32.bin").filter(
		(artifact) => path.relative(outputDirectory, artifact).split(path.sep)[0] === "bin",
	);
	if (artifacts.length !== 1) throw new Error(`Expected one xs_esp32.bin, found ${artifacts.length}.`);
	return statSync(artifacts[0]).size;
}

function printHelp() {
	console.log(`Usage: npm run size -- [options]

Options:
  --target <platform>     Build target (default: ${defaultTarget})
  --output-dir <path>     Report directory (default: build)
  --mod-only              Skip the M5Chain host firmware comparison
  --keep-temp             Preserve temporary projects and build output
  --snapshot              Update the tracked report for the selected target
  --help                  Show this help`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const moddable = process.env.MODDABLE;
	if (!moddable || !existsSync(path.join(moddable, "AGENTS.md"))) {
		throw new Error("MODDABLE must point to a current Moddable SDK checkout.");
	}

	const sdkVersionPath = path.join(moddable, "tools", "VERSION");
	const sdkVersion = existsSync(sdkVersionPath) ? readFileSync(sdkVersionPath, "utf8").trim() : "unknown";
	const mcrun = sdkTool(moddable, "mcrun");
	const mcconfig = options.modOnly ? undefined : sdkTool(moddable, "mcconfig");
	const workDirectory = mkdtempSync(path.join(tmpdir(), "m5chain-size-"));
	console.log(`Measuring debug builds for ${options.target}.`);

	try {
		const manifestMod = path.join(moddable, "examples", "manifest_mod.json");
		const manifestTypings = path.join(moddable, "examples", "manifest_typings.json");
		const modBase = path.join(root, "manifests", "mod-base.json");
		const deviceDirectory = path.join(root, "manifests", "devices");
		const deviceNames = readdirSync(deviceDirectory)
			.filter((name) => name.endsWith(".json") && name !== "all.json")
			.map((name) => path.basename(name, ".json"))
			.sort();

		const modBaselineBytes = await buildArchive(mcrun, workDirectory, options.target, "m5chain-size-mod-base", [
			manifestMod,
			manifestTypings,
			modBase,
		]);
		const devices = [];
		for (const name of deviceNames) {
			const archiveBytes = await buildArchive(mcrun, workDirectory, options.target, `m5chain-size-mod-${name}`, [
				manifestMod,
				manifestTypings,
				modBase,
				path.join(deviceDirectory, `${name}.json`),
			]);
			devices.push({ name, archiveBytes, incrementalBytes: archiveBytes - modBaselineBytes });
		}
		const allArchiveBytes = await buildArchive(mcrun, workDirectory, options.target, "m5chain-size-mod-all", [
			manifestMod,
			manifestTypings,
			path.join(root, "manifests", "mod-all.json"),
		]);

		let host;
		if (!options.modOnly) {
			const hostBaseIncludes = [
				path.join(moddable, "examples", "manifest_base.json"),
				path.join(moddable, "modules", "base", "modules"),
			];
			const baselineBytes = await buildHost(
				mcconfig,
				workDirectory,
				options.target,
				"m5chain-size-host-base",
				hostBaseIncludes,
			);
			const withM5ChainBytes = await buildHost(mcconfig, workDirectory, options.target, "m5chain-size-host-core", [
				...hostBaseIncludes,
				path.join(root, "manifests", "host.json"),
			]);
			host = {
				artifact: "xs_esp32.bin",
				baselineBytes,
				withM5ChainBytes,
				incrementalBytes: withM5ChainBytes - baselineBytes,
			};
		}

		const packageMetadata = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
		const report = {
			schemaVersion: 1,
			generatedAt: new Date().toISOString(),
			target: options.target,
			build: "debug",
			moddable: await repositoryIdentity(moddable, sdkVersion),
			m5chain: {
				version: packageMetadata.version,
				...(await repositoryIdentity(root)),
			},
			...(host ? { host } : {}),
			mods: {
				artifact: "xsa",
				baselineBytes: modBaselineBytes,
				devices,
				allDevices: {
					archiveBytes: allArchiveBytes,
					incrementalBytes: allArchiveBytes - modBaselineBytes,
				},
			},
		};

		const outputDirectory = options.snapshot ? path.join(root, "measurements") : options.outputDirectory;
		const reportName = options.snapshot ? snapshotReportName(options.target, report.build) : "size-report";
		mkdirSync(outputDirectory, { recursive: true });
		const jsonPath = path.join(outputDirectory, `${reportName}.json`);
		const markdownPath = path.join(outputDirectory, `${reportName}.md`);
		writeFileSync(jsonPath, `${JSON.stringify(report, null, "\t")}\n`);
		writeFileSync(markdownPath, createMarkdown(report));
		console.log(`Wrote ${jsonPath}`);
		console.log(`Wrote ${markdownPath}`);
	} finally {
		if (options.keepTemporaryFiles) console.log(`Kept temporary files at ${workDirectory}`);
		else rmSync(workDirectory, { recursive: true, force: true });
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
