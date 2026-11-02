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
	const byParentName = new Map();
	function Walk(node, parent, ordinal, ancestorNames) {
		const key = Key(node.name, parent, ordinal);
		const candidates = index.get(key) ?? [];
		const entry = { node, ancestorNames, ordinal };
		candidates.push(entry);
		index.set(key, candidates);
		const nameKey = JSON.stringify([node.name, parent]);
		const byName = byParentName.get(nameKey) ?? [];
		byName.push(entry);
		byParentName.set(nameKey, byName);
		for (let i = 0; i < node.children.length; ++i)
			Walk(node.children[i], node.name, i, [...ancestorNames, node.name]);
	}
	for (const root of nodes)
		Walk(root, "", -1, []);
	return { exact: index, byParentName };
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
	const nativeByName = new Map();
	for (const row of referenceRows) {
		const candidates = nativeByName.get(row.name) ?? [];
		candidates.push(row);
		nativeByName.set(row.name, candidates);
	}
	const rows = referenceRows.map(row => {
		let candidates = nodes.exact.get(Key(row.name, row.parent, row.ordinal)) ?? [];
		// Native sibling enumeration may differ from parsed document order.
		// Recover only an unambiguous name+parent match; report the discrepancy.
		if (!candidates.length)
			candidates = nodes.byParentName.get(JSON.stringify([row.name, row.parent])) ?? [];
		if (!candidates.length)
			return { ...row, status: "source-missing" };
		if (candidates.length > 1)
			return { ...row, status: "source-ambiguous" };
		const candidate = candidates[0];
		const sourceOrdinal = candidate.ordinal;
		const sourceOrderDifference = sourceOrdinal !== row.ordinal;
		const arranged = snapshot.byId.get(candidate.node.id);
		if (!arranged)
			return { ...row, status: "snapshot-missing" };
		const rect = arranged.absoluteRect;
		const studio = [rect.x, rect.y, rect.width, rect.height];
		const identity = { ...row, sourceOrdinal, sourceOrderDifference, studio };
		if (!row.visible)
			return { ...identity, status: "native-hidden" };
		if (candidate.ancestorNames.some(name => hiddenNames.has(name)))
			return { ...identity, status: "hidden-ancestor" };
		if (row.screen[2] <= 0 || row.screen[3] <= 0)
			return { ...identity, status: "native-zero-area" };
		const delta = CompareRect(studio, row.screen);
		const maxDelta = Math.max(...delta.map(Math.abs));
		const nativeParents = nativeByName.get(row.parent) ?? [];
		const nativeParent = nativeParents.length === 1 ? nativeParents[0] : null;
		const nativeLocal = nativeParent ? [
			row.screen[0] - nativeParent.screen[0],
			row.screen[1] - nativeParent.screen[1],
			row.screen[2], row.screen[3]
		] : null;
		const local = arranged.localRect;
		const studioLocal = [local.x, local.y, local.width, local.height];
		const localDelta = nativeLocal ? CompareRect(studioLocal, nativeLocal) : null;
		return { ...identity, delta, maxDelta, nativeLocal, studioLocal, localDelta,
			status: maxDelta <= 0.025 ? "within-tolerance" : "mismatch" };
	});
	const compared = rows.filter(row => row.status === "within-tolerance" || row.status === "mismatch");
	const mismatches = compared.filter(row => row.status === "mismatch");
	const byName = new Map(rows.map(row => [row.name, row]));
	const firstMismatchRoots = new Map();
	for (const row of mismatches) {
		let ancestor = row.parent;
		let root = row.name;
		const visited = new Set();
		while (ancestor && !visited.has(ancestor)) {
			visited.add(ancestor);
			const parentRow = byName.get(ancestor);
			if (!parentRow || parentRow.status !== "mismatch")
				break;
			root = parentRow.name;
			ancestor = parentRow.parent;
		}
		firstMismatchRoots.set(root, (firstMismatchRoots.get(root) ?? 0) + 1);
	}
	return {
		phase: "3N",
		status: "STUDIO_SNAPSHOT_VS_INDEPENDENT_DAYZ_RUNTIME",
		referenceKind: reference.kind, root: reference.root,
		nativePhases: reference.phases,
		nativePhaseDifferences: reference.observationDifferencesAcrossPhases,
		compared: compared.length,
		withinTolerance: compared.filter(row => row.status === "within-tolerance").length,
		mismatches: mismatches.length,
		mismatchRoots: Array.from(firstMismatchRoots, ([name, affected]) => ({ name, affected }))
			.sort((a, b) => b.affected - a.affected),
		sourceOrderDifferences: rows.filter(row => row.sourceOrderDifference)
			.map(row => ({ name: row.name, parent: row.parent,
				nativeOrdinal: row.ordinal, sourceOrdinal: row.sourceOrdinal })),
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
		"First mismatched ancestors: " + report.mismatchRoots.map(row => row.name + " (" + row.affected + ")").join(", "),
		"Native/source sibling-order differences: " + report.sourceOrderDifferences.length,
		""
	];
	for (const row of report.rows) {
		lines.push(row.status + " | " + row.name);
		if (row.delta)
			lines.push("  native=" + row.screen.join(",") + " studio=" + row.studio.join(",")
				+ " delta=" + row.delta.join(","));
		if (row.status === "mismatch" && row.localDelta)
			lines.push("  localDelta=" + row.localDelta.join(","));
		if (row.sourceOrderDifference)
			lines.push("  native ordinal=" + row.ordinal + " source ordinal=" + row.sourceOrdinal);
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
