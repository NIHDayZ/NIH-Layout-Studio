#!/usr/bin/env node
/**
 * General native screen-rectangle comparator for ordinary-widget hierarchies.
 * Predicts through the shared *authored* measurement/arrangement engine.
 * Synthetic or missing observations never count as native parity passes.
 *
 * This is deliberately not a pixel/color/clip comparator and does not support
 * managed layout, content sizing, or unsupported native geometry transforms.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree } from "../.geometry-engine-test-build/LayoutMeasurement.js";
import { ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/GeometrySnapshot.js";

const RECT_FIELDS = ["x", "y", "width", "height"];
const EVIDENCE_FIELDS = ["captureMethod", "nativeBuild", "evidenceFile", "viewportSource"];

function ValidRect(rect) {
	return rect && typeof rect === "object" && !Array.isArray(rect)
		&& RECT_FIELDS.every(field => Number.isFinite(rect[field]))
		&& rect.width > 0 && rect.height > 0;
}

function NamedNodes(roots) {
	const named = new Map();
	const ids = new Set();
	function Walk(nodes) {
		for (const node of nodes) {
			if (named.has(node.name) || ids.has(node.id))
				throw new Error("Native parity fixture requires unique widget names and IDs");
			named.set(node.name, node.id);
			ids.add(node.id);
			Walk(node.children);
		}
	}
	Walk(roots);
	return named;
}

/**
 * Root viewport must come from independent native workspace/capture data.
 * Rectangles are keyed by original layout widget NAME, not parser-assigned ID.
 */
export function CompareCommonGeometryCaptures(data, roots) {
	if (!data || data.schemaVersion !== 1 || !Array.isArray(data.cases) || !data.cases.length)
		throw new Error("Expected schemaVersion=1 and a nonempty cases array");
	if (!Array.isArray(roots) || !roots.length)
		throw new Error("Missing parsed native layout roots");
	const named = NamedNodes(roots);
	const tree = MeasureLayoutTree(roots);
	if (tree.managedContainerCount !== 0 || tree.unresolvedContentSizeCount !== 0)
		throw new Error("Common authored geometry comparator refuses managed/content-sized layouts");

	const reports = [];
	const caseIds = new Set();
	for (const item of data.cases) {
		if (!item || typeof item.id !== "string" || !item.id.trim() || caseIds.has(item.id))
			throw new Error("Missing or duplicate capture case ID");
		caseIds.add(item.id);
		const tolerance = item.tolerance ?? 0.5;
		if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 5)
			throw new Error("Invalid comparison tolerance: " + item.id);
		if (item.observed == null) {
			reports.push({id:item.id, status:"pending", matched:0, total:named.size, errors:[]});
			continue;
		}
		if (!item.provenance || EVIDENCE_FIELDS.some(field =>
			typeof item.provenance[field] !== "string" || !item.provenance[field].trim()))
			throw new Error("Observed geometry lacks native capture provenance: " + item.id);
		if (item.provenance.captureMethod === "synthetic") {
			reports.push({id:item.id, status:"synthetic", matched:0, total:named.size, errors:[]});
			continue;
		}
		if (!ValidRect(item.viewport)) {
			reports.push({id:item.id, status:"pending", matched:0, total:named.size,
				errors:["Native root/parent viewport was not independently measured"]});
			continue;
		}
		if (!item.observed || typeof item.observed !== "object" || Array.isArray(item.observed))
			throw new Error("Invalid observed screen rectangle dictionary: " + item.id);
		const arranged = ArrangeMeasuredGeometry(tree, item.viewport);
		if (arranged.issues.length || arranged.appliedStrategies.length
			|| arranged.appliedIntrinsics.length || arranged.appliedParentContent.length
			|| arranged.appliedConstrainedText.length || arranged.appliedWrapContent.length)
			throw new Error("Unresolved or prototype-managed native behavior: " + item.id);
		const errors = [];
		let matched = 0;
		let missing = 0;
		for (const [name, id] of named) {
			const actual = item.observed[name];
			if (!actual) {
				++missing;
				continue;
			}
			const expected = arranged.byId.get(id)?.absoluteRect;
			if (!expected)
				throw new Error("Missing arranged geometry: " + name);
			for (const field of RECT_FIELDS) {
				if (!Number.isFinite(actual[field]))
					errors.push(name + "." + field + ": invalid native value");
				else if (Math.abs(expected[field] - actual[field]) > tolerance)
					errors.push(name + "." + field + ": predicted " + expected[field] + ", observed " + actual[field]);
			}
			if (RECT_FIELDS.every(field => Number.isFinite(actual[field])
				&& Math.abs(expected[field] - actual[field]) <= tolerance))
				++matched;
		}
		for (const name of Object.keys(item.observed)) {
			if (!named.has(name))
				errors.push("Unrecognized native widget name: " + name);
		}
		const status = errors.length ? "fail" : missing ? "pending" : "pass";
		if (missing && !errors.length)
			errors.push(missing + " widgets lack independently measured screen rectangles");
		reports.push({id:item.id, status, matched, total:named.size, errors});
	}
	return {
		summary:{
			pass:reports.filter(r => r.status === "pass").length,
			fail:reports.filter(r => r.status === "fail").length,
			pending:reports.filter(r => r.status === "pending").length,
			synthetic:reports.filter(r => r.status === "synthetic").length
		},
		reports
	};
}

const directly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directly) {
	const capturePath = process.argv[2];
	const layoutPath = process.argv[3] ?? "tests/fixtures/workbench-common/NIH_Common_Geometry_Parity.layout";
	if (!capturePath) {
		console.error("Usage: node scripts/compare-workbench-common.mjs <capture.json> [layout.layout] [--allow-pending]");
		process.exitCode = 2;
	} else {
		try {
			const data = JSON.parse(readFileSync(capturePath, "utf8"));
			const roots = new LayoutParser().Parse(readFileSync(layoutPath, "utf8")).roots;
			const report = CompareCommonGeometryCaptures(data, roots);
			for (const item of report.reports) {
				console.log(item.status.toUpperCase() + " " + item.id + " (" + item.matched + "/" + item.total + ")");
				for (const error of item.errors)
					console.log("  " + error);
			}
			console.log(JSON.stringify(report.summary));
			if (report.summary.fail)
				process.exitCode = 1;
			else if (report.summary.pending && !process.argv.includes("--allow-pending"))
				process.exitCode = 2;
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
