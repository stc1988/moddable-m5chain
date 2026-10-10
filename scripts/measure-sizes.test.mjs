import assert from "node:assert/strict";
import test from "node:test";

import { createMarkdown, formatBytes, parseArgs, snapshotReportName } from "./measure-sizes.mjs";

test("parses size measurement options", () => {
	const options = parseArgs([
		"--target",
		"esp32/m5atom_s3",
		"--output-dir",
		"reports",
		"--mod-only",
		"--keep-temp",
		"--snapshot",
	]);

	assert.equal(options.target, "esp32/m5atom_s3");
	assert.equal(options.outputDirectory.endsWith("/reports"), true);
	assert.equal(options.modOnly, true);
	assert.equal(options.keepTemporaryFiles, true);
	assert.equal(options.snapshot, true);
});

test("rejects unknown size measurement options", () => {
	assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/);
	assert.throws(() => parseArgs(["--target"]), /requires a value/);
});

test("formats byte counts", () => {
	assert.equal(formatBytes(12345), "12,345 B");
	assert.equal(snapshotReportName("esp32/m5atom_matrix", "debug"), "esp32-m5atom_matrix-debug");
});

test("renders host and mod measurements", () => {
	const markdown = createMarkdown({
		generatedAt: "2026-10-10T00:00:00.000Z",
		target: "esp32/m5atom_matrix",
		build: "debug",
		moddable: { version: "10.0.0", revision: "sdk-revision", dirty: false },
		m5chain: { revision: "library-revision", dirty: true },
		host: { baselineBytes: 1000, withM5ChainBytes: 1250, incrementalBytes: 250 },
		mods: {
			baselineBytes: 100,
			devices: [{ name: "angle", archiveBytes: 140, incrementalBytes: 40 }],
			allDevices: { archiveBytes: 200, incrementalBytes: 100 },
		},
	});

	assert.match(markdown, /M5Chain core \| 1,250 B \| \+250 B/);
	assert.match(markdown, /angle \| 140 B \| \+40 B/);
	assert.match(markdown, /M5Chain: `library-revision` \(dirty\)/);
});
