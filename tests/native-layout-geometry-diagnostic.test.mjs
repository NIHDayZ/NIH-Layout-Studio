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



test("Phase 3F eligibility report distinguishes intentionally gated relative Grid prototypes from fixed-grid candidates", () => {
	const report = AnalyzeVanillaGeometry(realGridFixture);
	const eligibility = report.gridEligibility;
	assert.ok(eligibility.totalGridSpacers > 0);
	assert.equal(eligibility.items.length, eligibility.totalGridSpacers);
	assert.equal(Object.values(eligibility.relativeReasonCounts).reduce((a, b) => a + b, 0),
		eligibility.totalGridSpacers);
	assert.equal(Object.values(eligibility.fixedReasonCounts).reduce((a, b) => a + b, 0),
		eligibility.totalGridSpacers);
	assert.equal(eligibility.appliedStrategyCount, report.relativeSnapshotAppliedStrategies.length);
	for (const item of eligibility.items) {
		assert.equal(typeof item.name, "string");
		assert.ok(Array.isArray(item.ancestry));
		assert.equal(typeof item.relativeReason, "string");
		assert.equal(typeof item.fixedReason, "string");
		assert.ok(item.eligibleChildCount === null || item.eligibleChildCount <= item.childCount);
		if (item.relativeReason === "not-content-sized")
			assert.equal(item.contentWidth || item.contentHeight, false);
	}
	const markdown = FormatVanillaGeometry(report);
	assert.match(markdown, /GridSpacer native-strategy eligibility/);
	assert.match(markdown, /Relative prototype skip reasons/);
});

test("Phase 3F optional focus selects literal ancestry/descendant subtree and respects count limit", () => {
	const root = mkdtempSync(join(tmpdir(), "nih-phase3f-focus-"));
	try {
		const filename = join(root, "source.layout");
		writeFileSync(filename, realGridFixture);
		const script = fileURLToPath(new URL("../scripts/Analyze-NativeLayoutGeometry.mjs", import.meta.url));
		const response = JSON.parse(execFileSync(process.execPath, [
			script, filename, "--json", "--focus=LSameRow", "--max-focused=3"
		], { encoding: "utf8" }));
		assert.equal(response.focusSelection, "LSameRow");
		assert.ok(response.focusedCount > 0);
		assert.ok(response.focused.length <= 3);
		assert.ok(response.focused.every(item => item.name.toLowerCase().includes("lsamerow")
			|| item.ancestry.some(name => name.toLowerCase().includes("lsamerow"))));
		const literal = JSON.parse(execFileSync(process.execPath, [
			script, filename, "--json", "--focus=LSameRow["
		], { encoding: "utf8" }));
		assert.equal(literal.focusedCount, 0, "brackets in a focus substring are treated literally");

		for (const args of [["--focus="], ["--focus=x", "--focus=y"]]) {
			const outcome = spawnSync(process.execPath, [script, filename, ...args], { encoding: "utf8" });
			assert.equal(outcome.status, args.length === 1 ? 1 : 2);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});



test("Phase 3G captures authored relative parent size separately from independent child topology", () => {
	const example = [
		"FrameWidgetClass Root {",
		"	size 1920 1080",
		"	hexactsize 1",
		"	vexactsize 1",
		"	{",
		"		GridSpacerWidgetClass RelativeParent {",
		"			size 0.5 0.5",
		"			hexactsize 0",
		"			vexactsize 0",
		'			"Size To Content H" 1',
		'			"Size To Content V" 1',
		'			"Columns" 2',
		'			"Rows" 1',
		"			{",
		"				PanelWidgetClass FixedChild {",
		"					size 40 20",
		"					hexactsize 1",
		"					vexactsize 1",
		"				}",
		"			}",
		"		}",
		"	}",
		"}"
	].join("\n");
	const report = AnalyzeVanillaGeometry(example);
	assert.equal(report.gridEligibility.totalGridSpacers, 1);
	assert.equal(report.gridEligibility.exactParentSizeCount, 0);
	assert.equal(report.gridEligibility.relativeReasonCounts["parent-size-not-exact"], 1);
	assert.equal(report.gridEligibility.childTopologyReasonCounts["no-obvious-child-topology-blocker"], 1);
	assert.equal(report.gridEligibility.contentSizingModeCounts["both-axes"], 1);
	const parent = report.gridEligibility.items[0];
	assert.deepEqual(parent.authoredSize, { x: 0.5, y: 0.5 });
	assert.equal(parent.exactSizeX, false);
	assert.equal(parent.exactSizeY, false);
	assert.deepEqual(parent.basicLocalSize, { width: 960, height: 540 });
	assert.equal(parent.probeReturnedPlan, false);
	assert.equal(parent.appliedMode, null);
	assert.equal(report.relativeVsBasic.totalChanged, 0);
});

test("Phase 3G secondary topology diagnosis exposes managed children after blocked relative parent", () => {
	const example = [
		"FrameWidgetClass Root {",
		"	size 1920 1080",
		"	hexactsize 1",
		"	vexactsize 1",
		"	{",
		"		GridSpacerWidgetClass RelativeParent {",
		"			size 0.5 0.5",
		"			hexactsize 0",
		"			vexactsize 0",
		'			"Size To Content H" 1',
		'			"Size To Content V" 1',
		"			{",
		"				ScrollWidgetClass NestedScroll {",
		"					size 50 50",
		"					hexactsize 1",
		"					vexactsize 1",
		"				}",
		"			}",
		"		}",
		"	}",
		"}"
	].join("\n");
	const report = AnalyzeVanillaGeometry(example);
	const parent = report.gridEligibility.items[0];
	assert.equal(parent.relativeReason, "parent-size-not-exact");
	assert.equal(parent.childTopologyReason, "unresolved-managed-child");
	assert.equal(parent.childTopologyBlocker, "NestedScroll");
	assert.equal(report.gridEligibility.childTopologyReasonCounts["unresolved-managed-child"], 1);
	assert.equal(report.gridEligibility.appliedStrategyCount, 0);
	assert.match(FormatVanillaGeometry(report), /Child topology \(independent second gate\)/);
	assert.match(FormatVanillaGeometry(report), /NestedScroll/);
});



test("Phase 3J reports allocated-parent activation separately from legacy grid strategies for all eight native cases", () => {
	const matrix = readFileSync(new URL(
		"./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout",
		import.meta.url), "utf8");
	const report = AnalyzeVanillaGeometry(matrix, {
		focusPattern: /GridDirectRelativeBoth/,
		maxFocused: 10
	});
	assert.equal(report.gridEligibility.totalGridSpacers, 8);
	assert.equal(report.relativeSnapshotAppliedStrategies.length, 2);
	assert.equal(report.allocatedSnapshotAppliedStrategies.length, 8);
	assert.equal(report.allocatedSnapshotWidgets, report.relativeSnapshotWidgets);
	assert.equal(report.allocatedSnapshotAppliedStrategies.filter(item =>
		item.mode === "grid-allocated-parent-relative-prototype").length, 6);
	assert.equal(report.allocatedSnapshotAppliedStrategies.filter(item =>
		item.mode === "grid-relative-content-prototype").length, 2);
	assert.equal(report.gridEligibility.allocatedReasonCounts["allocated-parent-grid-applied"], 6);
	assert.equal(report.gridEligibility.allocatedReasonCounts["existing-exact-grid-applied"], 2);
	assert.ok(report.allocatedVsRelative.totalChanged > 0);
	assert.equal(report.allocatedVsRelative.totalChanged,
		report.allocatedVsRelative.localRectChanged +
		report.allocatedVsRelative.inheritedOnly);
	const caseItem = report.gridEligibility.items.find(item =>
		item.name === "GridDirectRelativeBoth");
	assert.equal(caseItem.relativeReason, "parent-size-not-exact");
	assert.equal(caseItem.allocatedReason, "allocated-parent-grid-applied");
	assert.equal(caseItem.allocatedMode, "grid-allocated-parent-relative-prototype");
	assert.equal(report.focused[0].name, "GridDirectRelativeBoth");
	assert.ok(report.focused[0].allocatedLocal);
	assert.ok(report.focused[0].allocatedVsRelativeDelta);
});

test("Phase 3J keeps unsupported single-axis and nested managed GridSpacers explicitly unactivated", () => {
	const source = [
		"FrameWidgetClass Root {",
		"\tsize 1920 1080",
		"\thexactsize 1",
		"\tvexactsize 1",
		"\t{",
		"\t\tGridSpacerWidgetClass OneAxis {",
		"\t\t\tsize 0.5 0.5",
		'\t\t\t"Columns" 2',
		'\t\t\t"Rows" 2',
		'\t\t\t"Size To Content H" 1',
		"\t\t\t{",
		"\t\t\t\tPanelWidgetClass FixedChild {",
		"\t\t\t\t\tsize 20 20",
		"\t\t\t\t\thexactsize 1",
		"\t\t\t\t\tvexactsize 1",
		"\t\t\t\t}",
		"\t\t\t}",
		"\t\t}",
		"\t\tGridSpacerWidgetClass NestedParent {",
		"\t\t\tsize 0.5 0.5",
		'\t\t\t"Columns" 2',
		'\t\t\t"Rows" 2',
		'\t\t\t"Size To Content H" 1',
		'\t\t\t"Size To Content V" 1',
		"\t\t\t{",
		"\t\t\t\tScrollWidgetClass ChildScroll {",
		"\t\t\t\t\tsize 20 20",
		"\t\t\t\t}",
		"\t\t\t}",
		"\t\t}",
		"\t}",
		"}"
	].join("\n");
	const report = AnalyzeVanillaGeometry(source);
	assert.equal(report.gridEligibility.totalGridSpacers, 2);
	assert.equal(report.allocatedSnapshotAppliedStrategies.length, 0);
	assert.equal(report.allocatedVsRelative.totalChanged, 0);
	const a = report.gridEligibility.items.find(item => item.name === "OneAxis");
	const b = report.gridEligibility.items.find(item => item.name === "NestedParent");
	assert.equal(a.allocatedReason, "single-axis-content-unsupported");
	assert.equal(b.allocatedReason, "unresolved-managed-child");
	assert.equal(b.childTopologyBlocker, "ChildScroll");
});

test("Phase 3J CLI exposes scoped allocated-parent differences without certifying Workbench parity", () => {
	const matrix = readFileSync(new URL(
		"./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout",
		import.meta.url), "utf8");
	const dir = mkdtempSync(join(tmpdir(), "nih-phase3j-cli-"));
	try {
		const file = join(dir, "grid.layout");
		writeFileSync(file, matrix);
		const script = fileURLToPath(new URL(
			"../scripts/Analyze-NativeLayoutGeometry.mjs", import.meta.url));
		const result = JSON.parse(execFileSync(process.execPath, [
			script, file, "--json", "--focus=GridDirectRelativeBoth", "--max-focused=3"
		], { encoding: "utf8" }));
		assert.equal(result.status, "OFFLINE_MODEL_COMPARISON_NOT_NATIVE_PARITY");
		assert.equal(result.focusSelection, "GridDirectRelativeBoth");
		assert.equal(result.allocatedSnapshotAppliedStrategies.length, 8);
		assert.ok(result.focused.length <= 3);
		const md = FormatVanillaGeometry(result);
		assert.match(md, /Allocated-parent vs legacy relative snapshot root causes/);
		assert.match(md, /Allocated-parent eligibility \/ activation/);
		assert.match(md, /allocated-parent-grid-applied/);
		assert.match(md, /not independently measured Workbench geometry/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});


test("Phase 3K diagnostic reports six new four-flag single-axis GridSpacers without altering three-flag evidence", () => {
	const source = readFileSync(new URL(
		"./fixtures/workbench-grid/NIH_Grid_SingleAxis_Content_Matrix.layout",
		import.meta.url), "utf8");
	const report = AnalyzeVanillaGeometry(source);
	assert.equal(report.allocatedSnapshotAppliedStrategies.length, 2);
	assert.equal(report.singleAxisSnapshotAppliedStrategies.length, 8);
	assert.equal(report.gridEligibility.singleAxisStrategyCounts["grid-allocated-parent-single-axis-prototype"], 6);
	assert.equal(report.gridEligibility.singleAxisStrategyCounts["grid-relative-content-prototype"], 2);
	assert.equal(report.singleAxisSnapshotWidgets, report.allocatedSnapshotWidgets);
	assert.ok(report.singleAxisVsAllocated.totalChanged > 0);
	assert.equal(report.singleAxisVsAllocated.totalChanged,
		report.singleAxisVsAllocated.localRectChanged +
		report.singleAxisVsAllocated.inheritedOnly);
	assert.match(FormatVanillaGeometry(report), /Four-flag single-axis vs three-flag allocated snapshot root causes/);
});

test("Phase 3K fourth flag preserves both-axis native GridSpacer strategies", () => {
	const source = readFileSync(new URL(
		"./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout",
		import.meta.url), "utf8");
	const report = AnalyzeVanillaGeometry(source);
	assert.equal(report.allocatedSnapshotAppliedStrategies.length, 8);
	assert.equal(report.singleAxisSnapshotAppliedStrategies.length, 8);
	assert.equal(report.singleAxisVsAllocated.totalChanged, 0);
	assert.ok(report.singleAxisSnapshotAppliedStrategies.every(item =>
		item.mode !== "grid-allocated-parent-single-axis-prototype"));
});
