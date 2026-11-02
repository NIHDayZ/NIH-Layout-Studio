import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AnalyzePhase3NDependencies, FormatPhase3NDependencies } from "../scripts/Analyze-Phase3NDependencies.mjs";

const s_Source = readFileSync(new URL(
	"./fixtures/workbench-grid/NIH_Grid_Nested_Dependency_Matrix.layout", import.meta.url), "utf8");

test("Phase 3N inventory preserves Phase 3M activations and root versus descendant roles", () => {
	const report = AnalyzePhase3NDependencies(s_Source);
	assert.equal(report.phase, "3N");
	assert.equal(report.status, "OFFLINE_DEPENDENCY_DIAGNOSTIC_NOT_NATIVE_PARITY");
	assert.equal(report.phase3mAppliedCount, 15);
	const outer = report.grids.find(item => item.name === "OuterHeightOuter");
	const inner = report.grids.find(item => item.name === "InnerHeightOuter");
	assert.ok(outer?.phase3mApplied);
	assert.equal(outer.phase3mRootGuardHint.status, "structural-candidate");
	assert.ok(inner?.phase3mApplied);
	assert.equal(inner.phase3mRootGuardHint.reason, "no-direct-nested-content-grid");
	assert.equal(outer.children.filter(item => item.managed).length, 2);
	assert.ok(report.phase3mGeometryDelta.totalChanged > 0);
});

test("Phase 3N focus does not alter the complete inventory and runs deterministically", () => {
	const report = AnalyzePhase3NDependencies(s_Source, { focus: ["OuterWidthOuterWidthLeaf"] });
	assert.equal(report.focused.length, 1);
	assert.equal(report.focused[0].name, "OuterWidthOuterWidthLeaf");
	assert.ok(report.grids.length > report.focused.length);
	assert.deepEqual(report, AnalyzePhase3NDependencies(s_Source, { focus: ["OuterWidthOuterWidthLeaf"] }));
});

test("Phase 3N text output distinguishes guard hints from native measurements", () => {
	const report = AnalyzePhase3NDependencies(s_Source, { focus: ["OuterHeightOuter"] });
	const output = FormatPhase3NDependencies(report);
	assert.match(output, /OFFLINE_DEPENDENCY_DIAGNOSTIC_NOT_NATIVE_PARITY/);
	assert.match(output, /OuterHeightOuter/);
	assert.match(output, /structural-candidate/);
	assert.match(output, /Guard hints are structural observations/);
});
