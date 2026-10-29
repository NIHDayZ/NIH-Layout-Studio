#!/usr/bin/env node
/**
 * Workbench ScrollWidget fixture comparator.
 *
 * Predicts evidence-labeled native scrollbar/offset arithmetic from a
 * fixture and compares it with independently captured native observations.
 * Missing observations or unknown native scale context are PENDING, never
 * silently treated as native parity. Reported native inputs are not
 * authenticated by this tool; the evidence record must be audited separately.
 *
 * Run after npm run test:geometry-engine:
 *   node scripts/compare-workbench-scroll.mjs tests/fixtures/workbench-scroll/capture.json
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { EstimateUnscaledScrollViewport, EstimateContextScaledScrollViewport } from "../.geometry-engine-test-build/ScrollSettings.js";
import { ProjectNativeScrollChildContext } from "../.geometry-engine-test-build/ScrollOffset.js";

const EXPECTED_SCHEMA = 1;
const RECT_FIELDS = ["x", "y", "width", "height"];
const EVIDENCE_FIELDS = ["captureMethod", "workbenchBuild", "evidenceFile"];
const NATIVE_INPUT_EVIDENCE_FIELDS = ["scaleBranchSource", "offsetSource"];

/**
 * A visible editor zoom or an unchecked Root DPI box cannot establish the
 * native branch or +0xC4/+0xCC context. Until explicitly observed, the old
 * unscaled prediction is preserved solely as a labeled hypothesis.
 */
function PredictNativeViewport(item) {
	const scale = item.nativeScale;
	if (scale == null) {
		return {
			viewport: EstimateUnscaledScrollViewport(item.container, item.settings, 1),
			basis: "unverified-unscaled-hypothesis",
			verified: false
		};
	}
	if (typeof scale !== "object" || Array.isArray(scale))
		throw new Error(`Invalid nativeScale for ${item.id}`);
	if (scale.mode === "unscaled") {
		if (Object.keys(scale).some(key => key !== "mode"))
			throw new Error(`Unexpected unscaled nativeScale fields in ${item.id}`);
		return {
			viewport: EstimateUnscaledScrollViewport(item.container, item.settings, 1),
			basis: "reported-native-unscaled-branch",
			verified: true
		};
	}
	if (scale.mode === "context-scaled") {
		if (!Number.isInteger(scale.numerator) || !Number.isInteger(scale.denominator)
			|| Object.keys(scale).some(key => !["mode", "numerator", "denominator"].includes(key)))
			throw new Error(`Invalid nativeScale context in ${item.id}`);
		return {
			viewport: EstimateContextScaledScrollViewport(item.container, item.settings, {
				numerator: scale.numerator,
				denominator: scale.denominator
			}),
			basis: "reported-native-context-fields",
			verified: true
		};
	}
	throw new Error(`Unknown nativeScale mode in ${item.id}`);
}

function RectNear(expected, observed, tolerance) {
	if (!observed || typeof observed !== "object")
		return null;
	const errors = [];
	for (const field of RECT_FIELDS) {
		if (!Number.isFinite(observed[field])) {
			errors.push(`${field}: missing/invalid Workbench measurement`);
		} else if (Math.abs(expected[field] - observed[field]) > tolerance) {
			errors.push(`${field}: expected ${expected[field]}, observed ${observed[field]}`);
		}
	}
	return errors;
}

export function CompareWorkbenchScrollFixtures(data) {
	if (!data || data.schemaVersion !== EXPECTED_SCHEMA || !Array.isArray(data.cases))
		throw new Error("Expected schemaVersion=1 with a cases array");
	if (data.cases.length === 0)
		throw new Error("No ScrollWidget fixture cases supplied");

	const ids = new Set();
	const results = [];
	for (const item of data.cases) {
		if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id))
			throw new Error("Missing or duplicate fixture id");
		ids.add(item.id);
		if (!item.container || !item.settings || !item.offsets)
			throw new Error(`Missing container/settings/offsets in ${item.id}`);
		for (const field of ["horizontal", "vertical", "verticalLeft"]) {
			if (typeof item.settings[field] !== "boolean")
				throw new Error(`Invalid ${field} flag in ${item.id}`);
		}
		if (!Number.isFinite(item.offsets.horizontal) || !Number.isFinite(item.offsets.vertical))
			throw new Error(`Invalid native offset samples in ${item.id}`);
		const tolerance = item.tolerance ?? 0.5;
		if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 5)
			throw new Error(`Invalid comparison tolerance in ${item.id}`);

		const estimate = PredictNativeViewport(item);
		const projected = estimate.viewport
			? ProjectNativeScrollChildContext(estimate.viewport.childViewport, item.offsets) : null;
		if (!estimate.viewport || !projected)
			throw new Error(`Unusable diagnostic inputs in ${item.id}`);

		const predicted = {
			childViewport: estimate.viewport.childViewport,
			childContext: projected.childContext
		};
		const observed = item.observed;
		if (observed == null) {
			results.push({ id: item.id, status: "pending", predicted, predictionBasis: estimate.basis, errors: [] });
			continue;
		}
		if (!item.provenance || EVIDENCE_FIELDS.some(field =>
			typeof item.provenance[field] !== "string" || !item.provenance[field].trim())) {
			throw new Error(`Case ${item.id} has measurements but no independently documented Workbench provenance`);
		}
		if (item.provenance.captureMethod === "synthetic") {
			results.push({ id: item.id, status: "synthetic", predicted, predictionBasis: estimate.basis, errors: [] });
			continue;
		}
		if (!estimate.verified) {
			results.push({
				id: item.id, status: "pending", predicted, predictionBasis: estimate.basis,
				errors: ["Native scrollbar scale branch/context is not independently established"]
			});
			continue;
		}
		if (NATIVE_INPUT_EVIDENCE_FIELDS.some(field =>
			typeof item.provenance[field] !== "string" || !item.provenance[field].trim())) {
			throw new Error(`Case ${item.id} lacks captured native scale/offset input provenance`);
		}
		const errors = [
			...(RectNear(predicted.childViewport, observed.childViewport, tolerance)
				?? ["childViewport: missing Workbench observation"]),
			...(RectNear(predicted.childContext, observed.childContext, tolerance)
				?? ["childContext: missing Workbench observation"])
		];
		results.push({ id: item.id, status: errors.length ? "fail" : "pass", predicted, predictionBasis: estimate.basis, errors });
	}
	const summary = {
		pass: results.filter(v => v.status === "pass").length,
		fail: results.filter(v => v.status === "fail").length,
		pending: results.filter(v => v.status === "pending").length,
		synthetic: results.filter(v => v.status === "synthetic").length
	};
	return { summary, results };
}

const invokedDirectly = process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
	const filename = process.argv[2];
	if (!filename) {
		console.error("Usage: node scripts/compare-workbench-scroll.mjs <capture.json> [--allow-pending]");
		process.exitCode = 2;
	} else {
		try {
			const report = CompareWorkbenchScrollFixtures(JSON.parse(readFileSync(filename, "utf8")));
			for (const result of report.results) {
				console.log(`${result.status.toUpperCase()} ${result.id} [${result.predictionBasis}]`);
				for (const problem of result.errors)
					console.log(`  ${problem}`);
			}
			console.log(JSON.stringify(report.summary));
			if (report.summary.fail > 0)
				process.exitCode = 1;
			else if (report.summary.pending > 0 && !process.argv.includes("--allow-pending"))
				process.exitCode = 2;
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
