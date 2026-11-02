import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	AnalyzeRelativeParentResolution,
	FormatRelativeParentResolution
} from "../scripts/Analyze-RelativeParentGrid.mjs";

const s_SourceFile = new URL("./fixtures/workbench-grid/NIH_Grid_RelativeParent_Axis_Matrix.layout", import.meta.url);
const s_EvidenceFile = new URL("./fixtures/workbench-grid/grid-relative-parent-phase3h-screenshot-observations.json", import.meta.url);
const s_Source = readFileSync(s_SourceFile, "utf8");
const s_Evidence = JSON.parse(readFileSync(s_EvidenceFile, "utf8"));

test("Phase 3I independent native screenshot offsets are stable across four exact/relative modes", () => {
	assert.equal(s_Evidence.phase, "3H");
	assert.equal(s_Evidence.records.length, 8);
	for (const group of ["Direct", "Nested"]) {
		const entries = s_Evidence.records.filter(item => item.group === group);
		assert.equal(entries.length, 4);
		const first = entries[0];
		for (const entry of entries) {
			assert.ok(Math.abs((entry.workbench.orange.x - entry.workbench.blue.x)
				- (first.workbench.orange.x - first.workbench.blue.x)) <= 1);
			assert.equal(entry.workbench.green.y - entry.workbench.blue.y,
				first.workbench.green.y - first.workbench.blue.y);
			assert.ok(Math.abs(entry.workbench.orange.width - first.workbench.orange.width) <= 1);
			assert.ok(Math.abs(entry.workbench.blue.width - first.workbench.blue.width) <= 1);
			assert.ok(Math.abs(entry.workbench.green.width - first.workbench.green.width) <= 1);
			assert.ok(Math.abs(entry.studio.orange.x - entry.studio.blue.x) <= 1);
		}
	}
});

test("Phase 3I resolves relative authorship to baseline parent rect without weakening native strategy guards", () => {
	const report = AnalyzeRelativeParentResolution(s_Source, s_Evidence);
	assert.equal(report.phase, "3I");
	assert.equal(report.status, "RESEARCH_ONLY_PROJECTION_NOT_WORKBENCH_GEOMETRY");
	assert.equal(report.tested, 8);
	assert.equal(report.candidatePlans, 8);
	assert.equal(report.offsetMatchesWithinOneScreenshotPixel, 8);
	assert.equal(report.orangeWidthsWithinTwoScreenshotPixels, 8);
	assert.ok(report.warning.includes("does not validate general native parent allocation"));
	for (const item of report.results) {
		assert.equal(item.status, "HYPOTHESIS_CANDIDATE");
		assert.equal(item.predictedChildren.length, 3);
		const byName = new Map(item.predictedChildren.map(c => [c.name.slice(-4), c.rect]));
		const blue = item.predictedChildren.find(c => c.name.endsWith("Blue")).rect;
		const orange = item.predictedChildren.find(c => c.name.endsWith("Orange")).rect;
		const green = item.predictedChildren.find(c => c.name.endsWith("Green")).rect;
		assert.equal(blue.x, 8);
		assert.equal(blue.y, 8);
		assert.equal(orange.x, 90);
		assert.equal(orange.y, 8);
		assert.equal(green.x, 8);
		assert.equal(green.y, 48);
		assert.ok(item.comparison.absoluteErrors.orangeDx <= 1);
		assert.ok(item.comparison.absoluteErrors.greenDy <= 1);
	}
});

test("Phase 3I matching starting parent dimensions predict the same content sizes regardless of exact axes", () => {
	const r = AnalyzeRelativeParentResolution(s_Source, s_Evidence);
	for (const group of ["Direct", "Nested"]) {
		const rows = r.results.filter(item => item.group === group);
		assert.equal(rows.length, 4);
		const exact = rows[0];
		for (const row of rows) {
			assert.ok(Math.abs(row.resolvedBeforeContent[0] - exact.resolvedBeforeContent[0]) < 0.00001);
			assert.ok(Math.abs(row.resolvedBeforeContent[1] - exact.resolvedBeforeContent[1]) < 0.00001);
			assert.ok(Math.abs(row.predictedContentSize[0] - exact.predictedContentSize[0]) < 0.00001);
			assert.ok(Math.abs(row.predictedContentSize[1] - exact.predictedContentSize[1]) < 0.00001);
		}
	}
	assert.ok(r.results.some(item => item.parentExactAxes.every(x => !x)));
	assert.ok(r.results.some(item => item.parentExactAxes.every(Boolean)));
});

test("Phase 3I CLI prints the native screenshot offset comparison and fails closed on non-fixture files", () => {
	const script = fileURLToPath(new URL("../scripts/Analyze-RelativeParentGrid.mjs", import.meta.url));
	const filename = fileURLToPath(s_SourceFile);
	const output = execFileSync(process.execPath, [script, filename, "--json"], { encoding: "utf8" });
	const report = JSON.parse(output);
	assert.equal(report.candidatePlans, 8);
	assert.equal(report.offsetMatchesWithinOneScreenshotPixel, 8);
	assert.match(FormatRelativeParentResolution(report), /Candidate plans: 8\/8/);
	assert.match(FormatRelativeParentResolution(report), /Predicted orange X delta/);
	for (const args of [[filename, "--bad"], ["--json"], [filename, "--json", "--json"]]) {
		const failed = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
		assert.equal(failed.status, 2);
	}
	assert.throws(() => AnalyzeRelativeParentResolution("not a layout", s_Evidence),
		/No parseable widget root/);
	assert.throws(() => AnalyzeRelativeParentResolution(s_Source, { phase: "3H", records: [] }),
		/Expected independent Phase 3H/);
});
