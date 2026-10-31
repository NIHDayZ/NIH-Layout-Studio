import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const script = new URL("../scripts/Generate-GridNativeVisualReport.mjs", import.meta.url);
const report = new URL("../.geometry-engine-test-build/Phase2N-Native-Comparison.html", import.meta.url);

test("Phase 2N offline report checks independent native getters against the shared snapshot", () => {
	const log = execFileSync(process.execPath, [script.pathname], {
		encoding: "utf8", timeout: 30000
	});
	assert.match(log, /Native rectangles compared: 212/);
	assert.match(log, /Differing coordinate axes \(> 0\.00001\): 0/);
	const html = readFileSync(report, "utf8");
	assert.match(html, /Phase 2N · Native vs\. shared snapshot/);
	assert.match(html, /id="case"/);
	assert.match(html, /id="viewport"/);
	assert.match(html, /gridRelativeContentPrototype/);
	assert.match(html, /Native DayZ getter outlines/);
	assert.match(html, /NIH shared geometry snapshot/);
	assert.match(html, /not a Workbench screenshot/);
});
