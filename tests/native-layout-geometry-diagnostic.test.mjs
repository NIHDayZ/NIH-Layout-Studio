import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	AnalyzeVanillaGeometry,
	FormatVanillaGeometry
} from "../scripts/Analyze-NativeLayoutGeometry.mjs";

const realGridFixture = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_Complex_Matrix.layout", import.meta.url),
	"utf8"
);

test("Phase 3F compares three existing geometry models without claiming Workbench parity", () => {
	const report = AnalyzeVanillaGeometry(realGridFixture);
	assert.equal(report.phase, "3F");
	assert.equal(report.status, "OFFLINE_MODEL_COMPARISON_NOT_NATIVE_PARITY");
	assert.deepEqual(report.root, { x: 0, y: 0, width: 1920, height: 1080 });
	assert.ok(report.basicSnapshotWidgets > 5);
	assert.equal(report.basicSnapshotWidgets, report.relativeSnapshotWidgets);
	assert.ok(report.relativeSnapshotAppliedStrategies.length > 0);
	assert.ok(report.relativeVsBasic.totalChanged > 0);
	assert.ok(report.liveGridVsBasic.total > 0);
	assert.equal(report.relativeVsBasic.totalChanged,
		report.relativeVsBasic.localRectChanged + report.relativeVsBasic.inheritedOnly);
	assert.match(report.warning, /not independently measured Workbench geometry/);
});

test("Phase 3F root-cause table and local/inherited diagnostics have stable shape", () => {
	const report = AnalyzeVanillaGeometry(realGridFixture);
	for (const change of report.relativeVsBasic.firstChanges) {
		assert.equal(typeof change.id, "string");
		assert.equal(typeof change.name, "string");
		assert.equal(typeof change.type, "string");
		assert.ok(Array.isArray(change.ancestry));
		assert.equal(typeof change.localChanged, "boolean");
		assert.ok(Object.values(change.delta).every(Number.isFinite));
	}
	for (const item of report.liveGridVsBasic.firstChanges) {
		assert.ok(["ordinary", "managed", "managed-descendant"].includes(item.origin));
		assert.ok(["inherited-offset", "local-placement", "local-and-inherited"]
			.includes(item.classification));
	}
	const markdown = FormatVanillaGeometry(report);
	assert.match(markdown, /Offline model comparison/);
	assert.match(markdown, /Relative snapshot root causes/);
	assert.match(markdown, /Live Grid vs basic snapshot root causes/);
	assert.ok(!markdown.includes("native parity PASS"));
});

test("Phase 3F preserves original source, supports focused widget names and bounds output volume", () => {
	const before = realGridFixture;
	const report = AnalyzeVanillaGeometry(before, {
		focusPattern: /LSameRow/,
		maxFocused: 3,
		maxDiffs: 4
	});
	assert.equal(before, realGridFixture);
	assert.ok(report.focusedCount >= 1);
	assert.ok(report.focused.length <= 3);
	assert.ok(report.relativeVsBasic.firstChanges.length <= 4);
	assert.ok(report.liveGridVsBasic.firstChanges.length <= 4);
	assert.ok(report.focused.some(item => item.name === "LSameRow" ||
		item.ancestry.includes("LSameRow")));
});

test("Phase 3F CLI accepts a local layout and refuses malformed/no-root fixtures", () => {
	const dir = mkdtempSync(join(tmpdir(), "nih-phase3f-"));
	try {
		const filename = join(dir, "geometry.layout");
		writeFileSync(filename, realGridFixture);
		const script = fileURLToPath(new URL("../scripts/Analyze-NativeLayoutGeometry.mjs", import.meta.url));
		const result = JSON.parse(execFileSync(process.execPath,
			[script, filename, "--json", "--max-focused=5"], { encoding: "utf8" }));
		assert.equal(result.status, "OFFLINE_MODEL_COMPARISON_NOT_NATIVE_PARITY");
		assert.ok(result.focused.length <= 5);
		assert.equal(result.relativeSnapshotWidgets, result.basicSnapshotWidgets);
		assert.throws(() => AnalyzeVanillaGeometry("not a DayZ layout"),
			/Cannot analyze a layout without a root widget/);
		assert.throws(() => AnalyzeVanillaGeometry(realGridFixture,
			{ root: { x: 0, y: 0, width: 0, height: 100 } }),
			/Root viewport dimensions/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});


test("Phase 3F CLI accepts a bare Windows-compatible layout path and handles option validation separately", () => {
	const dir = mkdtempSync(join(tmpdir(), "nih-phase3f-args-"));
	try {
		const filename = join(dir, "geometry.layout");
		writeFileSync(filename, realGridFixture);
		const script = fileURLToPath(new URL("../scripts/Analyze-NativeLayoutGeometry.mjs", import.meta.url));

		// The originally reported regression: required path must not be treated as an unknown flag.
		const markdown = execFileSync(process.execPath, [script, filename], { encoding: "utf8" });
		assert.match(markdown, /Phase 3F/);
		assert.match(markdown, /Relative snapshot root causes/);

		// Optional focused limit should work without --json.
		const limited = execFileSync(process.execPath,
			[script, filename, "--max-focused=2"], { encoding: "utf8" });
		assert.match(limited, /Focused relevant widgets/);

		// Invalid, repeated, or missing flags and a missing source path fail with a usage error.
		for (const args of [
			[filename, "--unknown"],
			[filename, "--json", "--json"],
			[filename, "--max-focused=2", "--max-focused=3"],
			["--json"]
		]) {
			const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
			assert.equal(result.status, 2, "expected usage failure for " + args.join(" "));
			assert.match(result.stderr, /Usage: node scripts\/Analyze-NativeLayoutGeometry\.mjs/);
		}

		// Malformed numeric limits are analysis errors, not incorrectly rejected source paths.
		const invalidLimit = spawnSync(process.execPath,
			[script, filename, "--max-focused=0"], { encoding: "utf8" });
		assert.equal(invalidLimit.status, 1);
		assert.match(invalidLimit.stderr, /max-focused must be an integer from 1 to 200/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
