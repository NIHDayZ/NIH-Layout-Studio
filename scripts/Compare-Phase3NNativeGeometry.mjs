#!/usr/bin/env node
/**
 * Phase 3N: compare five-flag Studio geometry to independently captured
 * DayZ client rectangles. Read-only; native evidence is never inferred
 * from Studio, and hidden native ancestor branches are excluded from parity.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Reference = JSON.parse(readFileSync(new URL(
	"../tests/fixtures/workbench-grid/grid-server-browser-phase3n-native.json",
	import.meta.url), "utf8"));
const s_FiveFlags = {
	constrainedGrid: true,
	gridRelativeContentPrototype: true,
	gridAllocatedParentRelativePrototype: true,
	gridAllocatedParentSingleAxisPrototype: true,
	gridNestedAllocationPrototype: true
};

function Key(name, parent, ordinal) {
	return JSON.stringify([name, parent, ordinal]);
}

function IndexDocument(nodes) {
	const index = new Map();
	function Walk(node, parent, ordinal, ancestorNames) {
		const key = Key(node.name, parent, ordinal);
		const candidates = index.get(key) ?? [];
		candidates.push({ node, ancestorNames });
		index.set(key, candidates);
		for (let i = 0; i < node.children.length; ++i)
			Walk(node.children[i], node.name, i, [...ancestorNames, node.name]);
	}
	for (const root of nodes)
		Walk(root, "", -1, []);
	return index;
}

function CompareRect(actual, expected) {
	return actual.map((value, index) => +(value - expected[index]).toFixed(3));
}

/**
 * Source ID is resolved on each parse, NEVER stored or assumed stable.
 * Native matches use parent/name/ordinal because widget IDs may be absent.
 */
export function ComparePhase3NNative(source, reference = s_Reference) {
	if (!Array.isArray(reference.root) || reference.root.length !== 2
		|| !Array.isArray(reference.keyRects))
		throw new Error("Invalid native evidence fixture");
	const document = new LayoutParser().Parse(source);
	if (!document.roots.length)
		throw new Error("Layout has no roots");
	const nodes = IndexDocument(document.roots);
	const prepared = MeasureLayoutTree(document.roots);
	const [width, height] = reference.root;
	const snapshot = ArrangeMeasuredGeometry(prepared,
		{ x: 0, y: 0, width, height }, 1, s_FiveFlags);
	const referenceRows = reference.keyRects.map(([name,parent,ordinal,screen,visible]) =>
		({ name,parent,ordinal,screen,visible }));
	const hiddenNames = new Set(referenceRows.filter(row => !row.visible).map(row => row.name));
	const rows = referenceRows.map(row => {
		const candidates = nodes.get(Key(row.name, row.parent, row.ordinal)) ?? [];
		if (!candidates.length)
			return { ...row, status: "source-missing" };
		if (candidates.length > 1)
			return { ...row, status: "source-ambiguous" };
		const candidate = candidates[0];
		const arranged = snapshot.byId.get(candidate.node.id);
		if (!arranged)
			return { ...row, status: "snapshot-missing" };
		const rect = arranged.absoluteRect;
		const studio = [rect.x, rect.y, rect.width, rect.height];
		if (!row.visible)
			return { ...row, studio, status: "native-hidden" };
		if (candidate.ancestorNames.some(name => hiddenNames.has(name)))
			return { ...row, studio, status: "hidden-ancestor" };
		if (row.screen[2] <= 0 || row.screen[3] <= 0)
			return { ...row, studio, status: "native-zero-area" };
		const delta = CompareRect(studio, row.screen);
		const maxDelta = Math.max(...delta.map(Math.abs));
		return { ...row, studio, delta, maxDelta, status: maxDelta <= 0.025 ? "within-tolerance" : "mismatch" };
	});
	const compared = rows.filter(row => row.status === "within-tolerance" || row.status === "mismatch");
	return {
		phase: "3N",
		status: "STUDIO_SNAPSHOT_VS_INDEPENDENT_DAYZ_RUNTIME",
		referenceKind: reference.kind, root: reference.root,
		nativePhases: reference.phases,
		nativePhaseDifferences: reference.observationDifferencesAcrossPhases,
		compared: compared.length,
		withinTolerance: compared.filter(row => row.status === "within-tolerance").length,
		mismatches: compared.filter(row => row.status === "mismatch").length,
		appliedStrategies: snapshot.appliedStrategies.filter(item => item.mode === "grid-nested-allocation-prototype").length,
		issues: snapshot.issues.length,
		rows,
		warning: "The native source was a standalone DayZ client widget root, not the assembled server browser or a Workbench capture. Descendants of hidden ancestors cannot be scored as parity."
	};
}

export function FormatPhase3NNative(report) {
	const lines = [
		"# Phase 3N — Independent native vs Studio snapshot",
		"Viewport: " + report.root.join(" x "),
		"Native lifecycle differences: " + report.nativePhaseDifferences,
		"Compared=" + report.compared + " matched=" + report.withinTolerance
			+ " mismatched=" + report.mismatches,
		"Five-flag nested strategies=" + report.appliedStrategies + " snapshot issues=" + report.issues,
		""
	];
	for (const row of report.rows) {
		lines.push(row.status + " | " + row.name);
		if (row.delta)
			lines.push("  native=" + row.screen.join(",") + " studio=" + row.studio.join(",")
				+ " delta=" + row.delta.join(","));
	}
	lines.push("", report.warning);
	return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const files = args.filter(arg => !arg.startsWith("--"));
	const flags = args.filter(arg => arg.startsWith("--"));
	if (files.length !== 1 || flags.some(arg => arg !== "--json") || flags.length > 1) {
		console.error("Usage: node scripts/Compare-Phase3NNativeGeometry.mjs <local-vanilla-layout> [--json]");
		process.exitCode = 2;
	} else {
		try {
			const report = ComparePhase3NNative(readFileSync(resolve(files[0]), "utf8"));
			console.log(flags.includes("--json") ? JSON.stringify(report, null, 2) : FormatPhase3NNative(report));
		} catch (error) {
			console.error("Native geometry comparison failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
