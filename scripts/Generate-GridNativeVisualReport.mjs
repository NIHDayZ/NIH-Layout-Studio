import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import {
	MeasureLayoutTree,
	ArrangeMeasuredGeometry
} from "../.geometry-engine-test-build/SnapshotForTests.js";

/**
 * Phase 2N: offline native getter comparison, not a visual Workbench screenshot
 * test. Uses the SAME shared snapshot engine as the Phase 2M tests.
 * Does not enable experimental Canvas geometry.
 */
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/workbench-grid");
const layout = readFileSync(resolve(fixtureRoot, "NIH_Grid_Complex_Matrix.layout"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(fixtureRoot, "grid-complex-phase2l-cases.json"), "utf8"));
const native = JSON.parse(readFileSync(resolve(fixtureRoot, "grid-complex-phase2l-native.json"), "utf8")).native;
const root = new LayoutParser().Parse(layout).roots[0];
if (!root || manifest.cases.length !== 20)
	throw new Error("Missing or incomplete Phase 2L layout fixture");
const prepared = MeasureLayoutTree([root]);
const contexts = [
	{ label: "1920 × 1080 (native create)", width: 1920, height: 1080 },
	{ label: "1120 × 720 (native resize)", width: 1120, height: 720 }
];

function AsArray(rect) {
	return [rect.x, rect.y, rect.width, rect.height];
}

function CollectGrid(snapshot, gridNode, x, y, records) {
	const entry = native[gridNode.name];
	if (!entry)
		throw new Error("Missing native getter evidence: " + gridNode.name);
	const gridResult = snapshot.byId.get(gridNode.id);
	if (!gridResult)
		throw new Error("Missing Studio snapshot grid: " + gridNode.name);
	const [size, childRects] = entry;
	records.push({
		name: gridNode.name,
		type: "GridSpacer",
		native: [x, y, size[0], size[1]],
		studio: AsArray(gridResult.absoluteRect)
	});
	if (childRects.length !== gridNode.children.length)
		throw new Error("Mismatched native child count: " + gridNode.name);
	for (let i = 0; i < gridNode.children.length; ++i) {
		const child = gridNode.children[i];
		const expected = childRects[i];
		const studio = snapshot.byId.get(child.id);
		if (!studio)
			throw new Error("Missing Studio snapshot child: " + child.name);
		if (expected === null) {
			records.push({
				name: child.name,
				type: "Excluded from native managed placement",
				native: null,
				studio: AsArray(studio.absoluteRect)
			});
			continue;
		}
		const [cx, cy, width, height] = expected;
		const childX = x + cx;
		const childY = y + cy;
		if (native[child.name] && child.type === "GridSpacerWidgetClass") {
			CollectGrid(snapshot, child, childX, childY, records);
			continue;
		}
		records.push({
			name: child.name,
			type: "PanelWidget",
			native: [childX, childY, width, height],
			studio: AsArray(studio.absoluteRect)
		});
	}
}

const cases = manifest.cases.map(sample => {
	const node = root.children.find(child => child.name === sample.name);
	if (!node)
		throw new Error("Missing authored case: " + sample.name);
	return {
		name: sample.name,
		views: contexts.map(context => {
			const snapshot = ArrangeMeasuredGeometry(prepared, {
				x: 0, y: 0, width: context.width, height: context.height
			}, 1, { constrainedGrid: true, gridRelativeContentPrototype: true });
			const records = [];
			CollectGrid(snapshot, node, sample.position[0], sample.position[1], records);
			let compared = 0;
			let mismatches = 0;
			let maxDelta = 0;
			for (const record of records) {
				if (!record.native)
					continue;
				++compared;
				for (let axis = 0; axis < 4; ++axis) {
					const delta = Math.abs(record.native[axis] - record.studio[axis]);
					if (!Number.isFinite(delta))
						throw new Error("Nonfinite rectangle in " + record.name);
					maxDelta = Math.max(maxDelta, delta);
					if (delta > 0.00001)
						++mismatches;
				}
			}
			return { viewport: context.label, records, compared, mismatches, maxDelta };
		})
	};
});
const matchCount = cases.reduce((sum, c) => sum + c.views.reduce((n, v) => n + v.compared, 0), 0);
const mismatchCount = cases.reduce((sum, c) => sum + c.views.reduce((n, v) => n + v.mismatches, 0), 0);
if (matchCount !== 212)
	throw new Error("Expected 106 unique native rectangles at each of two viewports, got " + matchCount);

const data = JSON.stringify({ cases, matchCount, mismatchCount }).replace(/</g, "\\u003c");
const html = [
'<!doctype html>',
'<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>NIH Layout Studio — Phase 2N Native Grid Comparison</title>',
'<style>',
':root { color-scheme:dark; font:14px/1.5 Inter,system-ui,sans-serif; background:#11151b; color:#e5e9ef; }',
'body { margin:0 auto; padding:26px; max-width:1500px; }',
'h1 { font-size:24px; margin:0 0 8px; }',
'p { color:#acb6c4; max-width:1050px; }',
'.controls { display:flex; flex-wrap:wrap; gap:14px; align-items:end; padding:16px 0 22px; }',
'label { display:grid; gap:6px; color:#9eabba; font-size:12px; }',
'select { background:#252c36; color:#f1f4f8; border:1px solid #3e4857; border-radius:7px; padding:10px; min-width:240px; }',
'.metric { padding:9px 14px; border:1px solid #3a4754; border-radius:8px; }',
'.metric strong { display:block; color:#fff; font-size:20px; font-variant-numeric:tabular-nums; }',
'.views { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:18px; }',
'.view { border:1px solid #364252; background:#1b222c; padding:14px; border-radius:10px; min-width:0; }',
'.view h2 { margin:0 0 12px; font-size:15px; }',
'svg { display:block; width:100%; height:340px; background:#10151d; border:1px solid #343e4d; border-radius:5px; }',
'.native rect { stroke:#78cee0; fill:#78cee010; stroke-width:1.7; }',
'.studio rect { stroke:#e9b86c; fill:#e9b86c0b; stroke-width:1.7; stroke-dasharray:5 3; }',
'.root rect { stroke-width:3; }',
'table { width:100%; border-collapse:collapse; margin-top:16px; font-size:12px; font-variant-numeric:tabular-nums; }',
'th,td { border-bottom:1px solid #343e4c; padding:8px 10px; text-align:left; }',
'th { color:#a7b8ca; }',
'.ok { color:#8fd5b5; } .warn { color:#e9b86c; }',
'.legend { font-size:12px; color:#a4b0bd; }',
'</style></head><body>',
'<h1>Phase 2N · Native vs. shared snapshot</h1>',
'<p>This is a rectangle comparison derived from actual DayZ client getters, not a Workbench screenshot or a claim of visual pixel parity. The Studio side uses the Phase 2M opt-in snapshot engine. The normal editor is not affected.</p>',
'<div class="controls"><label>Grid scenario<select id="case"></select></label>',
'<label>Native capture viewport<select id="viewport"></select></label>',
'<div class="metric">Compared rectangles<strong id="count"></strong></div>',
'<div class="metric">Maximum axis difference<strong id="delta"></strong></div>',
'<div class="metric">Different axes<strong id="mismatches"></strong></div>',
'</div>',
'<div class="views"><section class="view"><h2>Native DayZ getter outlines</h2><svg id="native" xmlns="http://www.w3.org/2000/svg"></svg></section>',
'<section class="view"><h2>NIH shared geometry snapshot</h2><svg id="studio" xmlns="http://www.w3.org/2000/svg"></svg></section></div>',
'<p class="legend">Native outlines are cyan. Studio outlines are dashed amber. Both panes use the same absolute coordinate bounds. The source-hidden child excluded from layout has no native managed rectangle and is omitted from the diagram.</p>',
'<table><thead><tr><th>Widget name</th><th>Kind</th><th>Native x,y,w,h</th><th>Studio x,y,w,h</th><th>Max delta</th></tr></thead><tbody id="rows"></tbody></table>',
'<script type="application/json" id="data">' + data + '</script>',
'<script>',
'(function () {',
'  "use strict";',
'  const report = JSON.parse(document.getElementById("data").textContent);',
'  const caseBox = document.getElementById("case");',
'  const viewportBox = document.getElementById("viewport");',
'  for (let i = 0; i < report.cases.length; ++i) {',
'    const option = document.createElement("option"); option.value = String(i); option.textContent = report.cases[i].name; caseBox.append(option);',
'  }',
'  const contexts = report.cases[0].views;',
'  for (let i = 0; i < contexts.length; ++i) {',
'    const option = document.createElement("option"); option.value = String(i); option.textContent = contexts[i].viewport; viewportBox.append(option);',
'  }',
'  const round = x => Number(x.toFixed(4)).toString();',
'  const format = r => r ? r.map(round).join(", ") : "Not allocated";',
'  function draw(id, records, field, bounds) {',
'    const svg = document.getElementById(id);',
'    svg.textContent = "";',
'    svg.setAttribute("viewBox", bounds.join(" "));',
'    for (let i = 0; i < records.length; ++i) {',
'      const data = records[i][field]; if (!data) continue;',
'      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");',
'      group.setAttribute("class", field + (i === 0 ? " root" : ""));',
'      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");',
'      rect.setAttribute("x", data[0]); rect.setAttribute("y", data[1]);',
'      rect.setAttribute("width", Math.max(data[2], 0.1)); rect.setAttribute("height", Math.max(data[3], 0.1));',
'      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");',
'      title.textContent = records[i].name + ": " + format(data);',
'      group.append(rect, title); svg.append(group);',
'    }',
'  }',
'  function render() {',
'    const selected = report.cases[Number(caseBox.value)];',
'    const view = selected.views[Number(viewportBox.value)];',
'    const records = view.records;',
'    const extents = records.filter(x => x.native).flatMap(x => [x.native, x.studio]);',
'    const minX = Math.min(...extents.map(x => x[0])) - 12;',
'    const minY = Math.min(...extents.map(x => x[1])) - 12;',
'    const maxX = Math.max(...extents.map(x => x[0] + x[2])) + 12;',
'    const maxY = Math.max(...extents.map(x => x[1] + x[3])) + 12;',
'    const bounds = [minX, minY, Math.max(20, maxX - minX), Math.max(20, maxY - minY)];',
'    draw("native", records, "native", bounds); draw("studio", records, "studio", bounds);',
'    document.getElementById("count").textContent = String(view.compared);',
'    document.getElementById("delta").textContent = round(view.maxDelta) + " px";',
'    document.getElementById("mismatches").textContent = String(view.mismatches);',
'    const tbody = document.getElementById("rows"); tbody.textContent = "";',
'    for (const record of records) {',
'      const delta = record.native ? Math.max(...record.native.map((n, i) => Math.abs(n - record.studio[i]))) : null;',
'      const row = document.createElement("tr");',
'      for (const value of [record.name, record.type, format(record.native), format(record.studio), delta === null ? "Excluded" : round(delta) + " px"]) {',
'        const cell = document.createElement("td"); cell.textContent = value; row.append(cell);',
'      }',
'      row.lastChild.className = delta !== null && delta <= 0.00001 ? "ok" : "warn";',
'      tbody.append(row);',
'    }',
'  }',
'  caseBox.addEventListener("change", render); viewportBox.addEventListener("change", render); render();',
'})();',
'</script></body></html>'
].join("\n");

const output = resolve(repositoryRoot, ".geometry-engine-test-build/Phase2N-Native-Comparison.html");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, "utf8");
console.log("Phase 2N report: " + output);
console.log("Native rectangles compared: " + matchCount);
console.log("Differing coordinate axes (> 0.00001): " + mismatchCount);
if (mismatchCount !== 0)
	process.exitCode = 1;
