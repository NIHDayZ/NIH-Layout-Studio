#!/usr/bin/env node
/**
 * Phase 3F: read-only geometry comparison for a local DayZ .layout source.
 * Reports geometry and applied native-derived strategies only. No file writes.
 * A disagreement between two Studio models is not proof of Workbench behavior.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { CompareLiveToSnapshot } from "../.geometry-engine-test-build/GeometryComparison.js";

const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_Tolerance = 0.01;

function Delta(a, b) {
	return {
		x: +(a.x - b.x).toFixed(3),
		y: +(a.y - b.y).toFixed(3),
		width: +(a.width - b.width).toFixed(3),
		height: +(a.height - b.height).toFixed(3)
	};
}

function Different(a, b) {
	return Object.values(Delta(a, b)).some(value => Math.abs(value) > s_Tolerance);
}

function IndexNames(nodes) {
	const names = new Map();
	const parents = new Map();
	function Walk(node, parentId = null, ancestry = []) {
		names.set(node.id, { name: node.name, type: node.type, ancestry: [...ancestry] });
		parents.set(node.id, parentId);
		for (const child of node.children)
			Walk(child, node.id, [...ancestry, node.name]);
	}
	for (const node of nodes)
		Walk(node);
	return { names, parents };
}

function SnapshotComparison(baseline, candidate, names) {
	const changed = [];
	const localChangeIds = new Set();
	const byId = new Map();
	for (const item of baseline.entries) {
		const other = candidate.byId.get(item.id);
		if (!other)
			continue;
		if (!Different(item.localRect, other.localRect)
			&& !Different(item.absoluteRect, other.absoluteRect))
			continue;
		const delta = Delta(other.localRect, item.localRect);
		const localChanged = Different(item.localRect, other.localRect);
		if (localChanged)
			localChangeIds.add(item.id);
		const name = names.get(item.id);
		const change = {
			id: item.id,
			name: name?.name ?? "",
			type: name?.type ?? "",
			parentId: item.parentId,
			ancestry: name?.ancestry ?? [],
			localChanged,
			baselineLocal: item.localRect,
			experimentalLocal: other.localRect,
			baselineAbsolute: item.absoluteRect,
			experimentalAbsolute: other.absoluteRect,
			delta
		};
		changed.push(change);
		byId.set(item.id, change);
	}
	const counts = new Map();
	for (const item of changed) {
		let current = item;
		const seen = new Set();
		while (!current.localChanged && current.parentId && byId.has(current.parentId)
			&& !seen.has(current.parentId)) {
			seen.add(current.parentId);
			current = byId.get(current.parentId);
		}
		const existing = counts.get(current.id) ?? { id: current.id, name: current.name,
			type: current.type, ancestry: current.ancestry, affected: 0,
			localDelta: current.delta };
		++existing.affected;
		counts.set(current.id, existing);
	}
	return {
		totalChanged: changed.length,
		localRectChanged: localChangeIds.size,
		inheritedOnly: changed.length - localChangeIds.size,
		topRootCauses: [...counts.values()].sort((a, b) => b.affected - a.affected).slice(0, 15),
		changed
	};
}

function ShortenLiveDifference(diff) {
	return {
		id: diff.id, name: diff.name, type: diff.type,
		rootCauseId: diff.rootCauseId, classification: diff.classification,
		origin: diff.origin, delta: diff.delta,
		liveLocal: diff.liveLocal, basicSnapshotLocal: diff.snapshotLocal
	};
}

export function AnalyzeVanillaGeometry(source, options = {}) {
	const parser = new LayoutParser();
	const document = parser.Parse(source);
	if (!document.roots.length)
		throw new Error("Cannot analyze a layout without a root widget");
	const root = options.root ?? s_Root;
	if (!Number.isFinite(root.width) || root.width <= 0
		|| !Number.isFinite(root.height) || root.height <= 0)
		throw new Error("Root viewport dimensions must be positive finite numbers");
	const measured = MeasureLayoutTree(document.roots);
	const basic = ArrangeMeasuredGeometry(measured, root);
	const relative = ArrangeMeasuredGeometry(measured, root, 1, {
		constrainedGrid: true,
		gridRelativeContentPrototype: true
	});
	const names = IndexNames(document.roots).names;
	const changed = SnapshotComparison(basic, relative, names);
	const live = CompareLiveToSnapshot(document.roots, root, {
		gridLayout: true,
		nativeConstrainedGrid: true,
		nativeWrapLayout: false
	});
	const filterPattern = options.focusPattern ?? /server_list_root|server_list_content_root|filter|server_list_header/i;
	const focused = [];
	for (const item of basic.entries) {
		const n = names.get(item.id);
		if (!n || !(filterPattern.test(n.name) || n.ancestry.some(name => filterPattern.test(name))))
			continue;
		const relativeEntry = relative.byId.get(item.id);
		const liveEntry = live.differences.find(diff => diff.id === item.id);
		focused.push({
			id: item.id, name: n.name, type: n.type, ancestry: n.ancestry,
			basicLocal: item.localRect,
			relativeLocal: relativeEntry?.localRect ?? null,
			basicAbsolute: item.absoluteRect,
			relativeAbsolute: relativeEntry?.absoluteRect ?? null,
			relativeDelta: relativeEntry ? Delta(relativeEntry.localRect, item.localRect) : null,
			liveGridVsBasic: liveEntry ? ShortenLiveDifference(liveEntry) : null
		});
	}
	const applied = relative.appliedStrategies.map(item => ({
		id: item.id, name: names.get(item.id)?.name ?? "", mode: item.mode
	}));
	return {
		phase: "3F",
		status: "OFFLINE_MODEL_COMPARISON_NOT_NATIVE_PARITY",
		root,
		parsedRoots: document.roots.length,
		basicSnapshotWidgets: basic.entries.length,
		relativeSnapshotWidgets: relative.entries.length,
		basicSnapshotIssues: basic.issues.map(issue => ({
			id: issue.id, name: names.get(issue.id)?.name ?? "", code: issue.code
		})),
		relativeSnapshotIssues: relative.issues.map(issue => ({
			id: issue.id, name: names.get(issue.id)?.name ?? "", code: issue.code
		})),
		relativeSnapshotAppliedStrategies: applied,
		relativeVsBasic: {
			totalChanged: changed.totalChanged,
			localRectChanged: changed.localRectChanged,
			inheritedOnly: changed.inheritedOnly,
			topRootCauses: changed.topRootCauses,
			firstChanges: changed.changed.slice(0, options.maxDiffs ?? 30)
		},
		liveGridVsBasic: {
			total: live.total,
			matched: live.matched,
			differenceCount: live.differences.length,
			localPlacementDifferences: live.localPlacementDifferences,
			inheritedOffsetDifferences: live.inheritedOffsetDifferences,
			topRootCauses: live.rootCauses.slice(0, 15),
			firstChanges: live.differences.slice(0, options.maxDiffs ?? 30).map(ShortenLiveDifference),
			unresolved: live.unresolved.map(issue => ({
				id: issue.id, code: issue.code
			}))
		},
		focusedCount: focused.length,
		focused: focused.slice(0, options.maxFocused ?? 35),
		warning: "All rectangles are unzoomed Studio model coordinates. These are two Studio models, not independently measured Workbench geometry."
	};
}

export function FormatVanillaGeometry(report) {
	const output = [
		"# NIH Phase 3F — Actual layout geometry model comparison",
		"",
		"Offline model comparison, NOT a Workbench native parity result.",
		"",
		"Root: " + report.root.width + " × " + report.root.height +
			"; measured widgets: " + report.basicSnapshotWidgets,
		"Live Grid vs basic snapshot: " + report.liveGridVsBasic.differenceCount + " differences",
		"Relative snapshot vs basic snapshot: " + report.relativeVsBasic.totalChanged +
			" differences (" + report.relativeVsBasic.localRectChanged + " local, " +
			report.relativeVsBasic.inheritedOnly + " inherited only)",
		"Relative native-derived strategies applied: " +
			report.relativeSnapshotAppliedStrategies.length,
		"Focused relevant widgets: " + report.focusedCount,
		"",
		"## Relative snapshot root causes",
		"",
		"| Widget | Type | Affected | Local delta x/y/w/h |",
		"|---|---|---:|---|"
	];
	for (const item of report.relativeVsBasic.topRootCauses)
		output.push("| " + item.name + " | " + item.type + " | " + item.affected +
			" | " + Object.values(item.localDelta).join(" / ") + " |");
	output.push("", "## Live Grid vs basic snapshot root causes", "",
		"| Widget | Type | Affected | Local delta x/y/w/h |",
		"|---|---|---:|---|");
	for (const item of report.liveGridVsBasic.topRootCauses)
		output.push("| " + item.name + " | " + item.type + " | " + item.affectedWidgets +
			" | " + Object.values(item.localDelta).join(" / ") + " |");
	output.push("", "## Focused ancestry and rectangles", "");
	for (const item of report.focused.slice(0, 18))
		output.push("- " + [...item.ancestry, item.name].join(" > ") +
			" | basic=" + JSON.stringify(item.basicLocal) +
			" | relative=" + JSON.stringify(item.relativeLocal) +
			" | live-basic-delta=" + JSON.stringify(item.liveGridVsBasic?.delta ?? null));
	output.push("", report.warning);
	return output.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const files = args.filter(arg => !arg.startsWith("--"));
	const flags = args.filter(arg => arg.startsWith("--"));
	const invalidFlags = flags.some(arg => arg !== "--json" && !arg.startsWith("--max-focused="));
	const duplicateFlags = flags.filter(arg => arg === "--json").length > 1
		|| flags.filter(arg => arg.startsWith("--max-focused=")).length > 1;
	if (files.length !== 1 || invalidFlags || duplicateFlags) {
		console.error("Usage: node scripts/Analyze-NativeLayoutGeometry.mjs <layout-file> [--json] [--max-focused=N]");
		process.exitCode = 2;
	} else {
		try {
			const limit = args.find(arg => arg.startsWith("--max-focused="));
			const maxFocused = limit ? Number(limit.split("=")[1]) : 35;
			if (!Number.isInteger(maxFocused) || maxFocused < 1 || maxFocused > 200)
				throw new Error("max-focused must be an integer from 1 to 200");
			const report = AnalyzeVanillaGeometry(readFileSync(resolve(files[0]), "utf8"), { maxFocused });
			console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : FormatVanillaGeometry(report));
		} catch (error) {
			console.error("Geometry analysis failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
