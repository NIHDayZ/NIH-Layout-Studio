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
// Native build is required to certify a version-pinned PASS, but geometry
// differences must still be checked when the runtime log lacks that metadata.
const EVIDENCE_FIELDS = ["captureMethod", "evidenceFile", "viewportSource"];
const SYNTHETIC_METHODS = new Set(["synthetic", "unit-test-double"]);

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
 * The fixture ROOT is a runtime-resized harness viewport, not a
 * comparison target. Read its actual GetScreenPos/GetScreenSize and compare
 * the authored descendants relative to that measured root rectangle.
 * Rectangles are keyed by original layout widget NAME, not parser IDs.
 */
export function CompareCommonGeometryCaptures(data, roots) {
	if (!data || data.schemaVersion !== 1 || !Array.isArray(data.cases) || !data.cases.length)
		throw new Error("Expected schemaVersion=1 and a nonempty cases array");
	if (!Array.isArray(roots) || roots.length !== 1 || !roots[0].children?.length)
		throw new Error("Expected one harness root with native geometry descendants");
	// The runtime probe calls SetScreenSize on the fixture root. Treat its
	// observed screen rectangle as the input constraint, not a prediction.
	// This prevents the authored root's relative size from being mistaken
	// for the native runtime override or the physical workspace dimensions.
	const descendants = roots[0].children;
	const named = NamedNodes(descendants);
	const tree = MeasureLayoutTree(descendants);
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
		if (SYNTHETIC_METHODS.has(item.provenance.captureMethod)) {
			reports.push({id:item.id, status:"synthetic", matched:0, total:named.size, errors:[]});
			continue;
		}
		// Never infer the DayZ client build from the Addon Builder version or
		// accept a placeholder as native build provenance. Missing versions
		// downgrade matching geometry to PENDING, not PASS.
		const nativeBuild = item.provenance.nativeBuild;
		const buildKnown = typeof nativeBuild === "string" && nativeBuild.trim().length > 0
			&& !/^(unknown|unrecorded|not[ _-]?captured|pending|mock|test[- _]?only)$/i.test(nativeBuild.trim());
		if (!ValidRect(item.viewport)) {
			reports.push({id:item.id, status:"pending", matched:0, total:named.size,
				errors:["Native fixture root screen rectangle was not independently measured"]});
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
		// Preserve useful numeric evidence even if build provenance is missing.
		// A real mismatch always FAILS, including on an unversioned capture.
		const status = errors.length ? "fail" : missing || !buildKnown ? "pending" : "pass";
		if (missing && !errors.length)
			errors.push(missing + " widgets lack independently measured screen rectangles");
		if (!buildKnown && !errors.length)
			errors.push("Native DayZ client build identifier was not captured; numeric geometry matched but parity is not version-pinned");
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
