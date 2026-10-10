import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.join(root, "tests", "xs");
const moddable = process.env.MODDABLE;

if (!moddable || !existsSync(path.join(moddable, "tools", "testmc", "manifest_common.json"))) {
	console.error("MODDABLE must point to a current Moddable SDK checkout.");
	process.exit(1);
}
if (!existsSync(path.join(moddable, "tools", "xsbug-log", "node_modules"))) {
	console.error(`Install xsdb dependencies first: npm install --prefix ${path.join(moddable, "tools", "xsbug-log")}`);
	process.exit(1);
}

const xsdbProject = mkdtempSync(path.join(tmpdir(), "m5chain-xsdb-"));
const child = spawn("mcconfig", ["-dl", "-m", "-p", "sim"], {
	cwd: project,
	env: { ...process.env, XSBUG_PROJECT: xsdbProject },
	stdio: ["pipe", "pipe", "pipe"],
});

let output = "";
let commandsSent = false;
let summary;
let timeout;

function finish(code, message) {
	clearTimeout(timeout);
	if (message) console.error(message);
	if (!child.killed) child.stdin.write("quit\n");
	process.exitCode = code;
}

function consume(text) {
	process.stdout.write(text);
	output += text;
	if (!commandsSent && output.includes("(xsdb)")) {
		commandsSent = true;
		child.stdin.write("set output json\n");
		child.stdin.write("set exceptions silent\n");
		child.stdin.write("set test timeout 15\n");
		child.stdin.write("set test log off\n");
		child.stdin.write(`test ${path.join(project, "cases")}\n`);
	}

	const matches = [...output.matchAll(/"event"\s*:\s*"test_summary"[\s\S]*?"data"\s*:\s*\{([\s\S]*?)\n\s*\}\s*\}/g)];
	if (matches.length && !summary) {
		const block = matches.at(-1)[0];
		const failed = Number(block.match(/"failed"\s*:\s*(\d+)/)?.[1]);
		const passed = Number(block.match(/"passed"\s*:\s*(\d+)/)?.[1]);
		const skipped = Number(block.match(/"skipped"\s*:\s*(\d+)/)?.[1]);
		const total = Number(block.match(/"total"\s*:\s*(\d+)/)?.[1]);
		summary = { failed, passed, skipped, total };
		console.log(`XS runtime tests: ${passed} passed, ${failed} failed, ${skipped} skipped`);
		finish(failed === 0 && skipped === 0 && total > 0 ? 0 : 1);
	}
	if (output.length > 200_000) output = output.slice(-100_000);
}

child.stdout.on("data", (chunk) => consume(chunk.toString()));
child.stderr.on("data", (chunk) => consume(chunk.toString()));
child.on("error", (error) => finish(1, `Unable to start mcconfig: ${error.message}`));
child.on("exit", (code) => {
	clearTimeout(timeout);
	rmSync(xsdbProject, { recursive: true, force: true });
	rmSync(path.join(project, ".xsdb.json"), { force: true });
	if (!summary) {
		console.error(`XS runtime tests ended without a summary (mcconfig exit ${code ?? "unknown"}).`);
		process.exitCode = 1;
	}
});

timeout = setTimeout(() => finish(1, "XS runtime tests timed out."), 120_000);
