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
import { MeasureLayoutTree, ArrangeMeasuredGeometry, ProbeMeasuredRelativeGrid, SelectManagedChildIndices } from "../.geometry-engine-test-build/SnapshotForTests.js";
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

/**
 * Explain why a measured GridSpacer did or did not enter an experimental path.
 * Read only: the same native eligibility helpers used by the snapshot are
 * called, but neither model's rectangles or scene widgets are modified.
 */
/**
 * Independent secondary gate: classify child topology even when an earlier
 * parent exact-size guard rejects the native relative-grid prototype.
 * This DOES NOT bypass the guard or call a planner with guessed dimensions.
 */
function InspectRelativeChildTopology(node, indices) {
	if (indices === null)
		return { reason: "unknown-ignore-invisible", blockingChild: null };
	if (!indices.length)
		return { reason: "no-eligible-children", blockingChild: null };
	for (const index of indices) {
		const child = node.children[index];
		const a = child.authored;
		if (a.sizeToContentWidth || a.sizeToContentHeight) {
			if (child.strategy.kind !== "grid" || !a.sizeToContentWidth
				|| !a.sizeToContentHeight)
				return { reason: "unsupported-nested-content-axis", blockingChild: child.node.name };
			if (!a.exactSizeX || !a.exactSizeY)
				return { reason: "nested-parent-size-not-exact", blockingChild: child.node.name };
			// The nested plan may still fail later. This is a structural probe only.
		} else if (child.strategy.requiresArrangement) {
			return { reason: "unresolved-managed-child", blockingChild: child.node.name };
		} else if (![a.sizeX, a.sizeY].every(Number.isFinite)
			|| a.sizeX < 0 || a.sizeY < 0) {
			return { reason: "invalid-child-size", blockingChild: child.node.name };
		}
	}
	return { reason: "no-obvious-child-topology-blocker", blockingChild: null };
}

function InspectGridEligibility(measured, basic, relative, allocated, names) {
	const items = [];
	const cache = new WeakMap();
	const modesById = new Map(relative.appliedStrategies.map(item => [item.id, item.mode]));
	const allocatedModesById = new Map(allocated.appliedStrategies.map(item => [item.id, item.mode]));
	function Walk(node) {
		if (node.strategy.kind === "grid") {
			const grid = node.nativeGrid;
			const a = node.authored;
			const contentSize = node.unresolvedContentWidth || node.unresolvedContentHeight;
			const indices = SelectManagedChildIndices(node.children, node.nativeIgnoreInvisible);
			const base = basic.byId.get(node.node.id);
			const relativePlan = ProbeMeasuredRelativeGrid(node, cache);
			const childTopology = InspectRelativeChildTopology(node, indices);
			let relativeReason = "relative-plan-available";
			if (!grid)
				relativeReason = "invalid-native-grid-settings";
			else if (!contentSize)
				relativeReason = "not-content-sized";
			else if (!a.exactSizeX || !a.exactSizeY)
				relativeReason = "parent-size-not-exact";
			else if (indices === null)
				relativeReason = "unknown-ignore-invisible";
			else if (indices.length === 0)
				relativeReason = "no-eligible-children";
			else {
				for (const index of indices) {
					const child = node.children[index];
					const authored = child.authored;
					if (authored.sizeToContentWidth || authored.sizeToContentHeight) {
						if (child.strategy.kind !== "grid" || !authored.sizeToContentWidth
							|| !authored.sizeToContentHeight || !authored.exactSizeX
							|| !authored.exactSizeY) {
							relativeReason = "unsupported-nested-content-child";
							break;
						}
						if (!ProbeMeasuredRelativeGrid(child, cache)) {
							relativeReason = "nested-relative-grid-rejected";
							break;
						}
					} else if (child.strategy.requiresArrangement) {
						relativeReason = "unresolved-managed-child";
						break;
					} else if (![authored.sizeX, authored.sizeY].every(Number.isFinite)
						|| authored.sizeX < 0 || authored.sizeY < 0) {
						relativeReason = "invalid-child-size";
						break;
					}
				}
				if (relativeReason === "relative-plan-available" && !relativePlan)
					relativeReason = "native-relative-plan-rejected";
			}

			let fixedReason = "fixed-grid-eligible";
			if (!grid)
				fixedReason = "invalid-native-grid-settings";
			else if (indices === null)
				fixedReason = "unknown-ignore-invisible";
			else if (indices.length === 0)
				fixedReason = "no-eligible-children";
			else if (contentSize)
				fixedReason = "content-size-requires-separate-strategy";
			else if (indices.length > grid.columns * grid.rows)
				fixedReason = "child-count-exceeds-fixed-grid-capacity";
			else if (!base || !Number.isFinite(base.localRect.width)
				|| !Number.isFinite(base.localRect.height)
				|| base.localRect.width < 0 || base.localRect.height < 0)
				fixedReason = "invalid-arranged-parent-rect";

			const allocatedMode = allocatedModesById.get(node.node.id) ?? null;
			let allocatedReason = "unresolved-after-eligibility-check";
			if (allocatedMode === "grid-allocated-parent-relative-prototype")
				allocatedReason = "allocated-parent-grid-applied";
			else if (allocatedMode === "grid-relative-content-prototype")
				allocatedReason = "existing-exact-grid-applied";
			else if (!grid)
				allocatedReason = "invalid-native-grid-settings";
			else if (!node.unresolvedContentWidth || !node.unresolvedContentHeight)
				allocatedReason = "single-axis-content-unsupported";
			else if (a.exactSizeX && a.exactSizeY)
				allocatedReason = "exact-grid-prototype-rejected";
			else if (indices === null)
				allocatedReason = "unknown-ignore-invisible";
			else if (indices.length === 0)
				allocatedReason = "no-eligible-children";
			else if (childTopology.reason !== "no-obvious-child-topology-blocker")
				allocatedReason = childTopology.reason;
			// This summary is diagnostic classification, not a proof of native
			// eligibility. Snapshot appliedStrategies is the authoritative
			// record of which experimental strategy actually executed.
			const source = names.get(node.node.id);
			items.push({
				id: node.node.id,
				name: source?.name ?? "",
				ancestry: source?.ancestry ?? [],
				childCount: node.children.length,
				eligibleChildCount: indices?.length ?? null,
				columns: grid?.columns ?? null,
				rows: grid?.rows ?? null,
				contentWidth: node.unresolvedContentWidth,
				contentHeight: node.unresolvedContentHeight,
				exactSizeX: a.exactSizeX,
				exactSizeY: a.exactSizeY,
				authoredSize: { x: a.sizeX, y: a.sizeY },
				basicLocalSize: base
					? { width: base.localRect.width, height: base.localRect.height } : null,
				contentSizingMode: node.unresolvedContentWidth
					? (node.unresolvedContentHeight ? "both-axes" : "width-only")
					: (node.unresolvedContentHeight ? "height-only" : "none"),
				childTopologyReason: childTopology.reason,
				childTopologyBlocker: childTopology.blockingChild,
				fixedReason,
				relativeReason,
				probeReturnedPlan: relativePlan !== null,
				appliedMode: modesById.get(node.node.id) ?? null,
				allocatedMode,
				allocatedReason
			});
		}
		for (const child of node.children)
			Walk(child);
	}
	for (const node of measured.roots)
		Walk(node);
	const Counts = key => {
		const result = {};
		for (const item of items)
			result[item[key]] = (result[item[key]] ?? 0) + 1;
		return result;
	};
	return {
		totalGridSpacers: items.length,
		fixedReasonCounts: Counts("fixedReason"),
		relativeReasonCounts: Counts("relativeReason"),
		childTopologyReasonCounts: Counts("childTopologyReason"),
		contentSizingModeCounts: Counts("contentSizingMode"),
		allocatedReasonCounts: Counts("allocatedReason"),
		allocatedStrategyCounts: Counts("allocatedMode"),
		exactParentSizeCount: items.filter(item => item.exactSizeX && item.exactSizeY).length,
		appliedStrategyCount: items.filter(item => item.appliedMode !== null).length,
		allocatedAppliedStrategyCount: items.filter(item => item.allocatedMode !== null).length,
		items
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
	const allocated = ArrangeMeasuredGeometry(measured, root, 1, {
		constrainedGrid: true,
		gridRelativeContentPrototype: true,
		gridAllocatedParentRelativePrototype: true
	});
	const names = IndexNames(document.roots).names;
	const changed = SnapshotComparison(basic, relative, names);
	const allocatedChanges = SnapshotComparison(relative, allocated, names);
	const live = CompareLiveToSnapshot(document.roots, root, {
		gridLayout: true,
		nativeConstrainedGrid: true,
		nativeWrapLayout: false
	});
	const filterPattern = options.focusPattern ?? /server_list_root|server_list_content_root|filter|server_list_header/i;
	const gridEligibility = InspectGridEligibility(measured, basic, relative, allocated, names);
	const focused = [];
	for (const item of basic.entries) {
		const n = names.get(item.id);
		if (!n || !(filterPattern.test(n.name) || n.ancestry.some(name => filterPattern.test(name))))
			continue;
		const relativeEntry = relative.byId.get(item.id);
		const allocatedEntry = allocated.byId.get(item.id);
		const liveEntry = live.differences.find(diff => diff.id === item.id);
		focused.push({
			id: item.id, name: n.name, type: n.type, ancestry: n.ancestry,
			basicLocal: item.localRect,
			relativeLocal: relativeEntry?.localRect ?? null,
			basicAbsolute: item.absoluteRect,
			relativeAbsolute: relativeEntry?.absoluteRect ?? null,
			allocatedLocal: allocatedEntry?.localRect ?? null,
			allocatedAbsolute: allocatedEntry?.absoluteRect ?? null,
			allocatedVsRelativeDelta: allocatedEntry && relativeEntry
				? Delta(allocatedEntry.localRect, relativeEntry.localRect) : null,
			relativeDelta: relativeEntry ? Delta(relativeEntry.localRect, item.localRect) : null,
			liveGridVsBasic: liveEntry ? ShortenLiveDifference(liveEntry) : null
		});
	}
	const applied = relative.appliedStrategies.map(item => ({
		id: item.id, name: names.get(item.id)?.name ?? "", mode: item.mode
	}));
	const allocatedApplied = allocated.appliedStrategies.map(item => ({
		id: item.id, name: names.get(item.id)?.name ?? "", mode: item.mode
	}));
	return {
		phase: "3F",
		status: "OFFLINE_MODEL_COMPARISON_NOT_NATIVE_PARITY",
		root,
		parsedRoots: document.roots.length,
		basicSnapshotWidgets: basic.entries.length,
		relativeSnapshotWidgets: relative.entries.length,
		allocatedSnapshotWidgets: allocated.entries.length,
		basicSnapshotIssues: basic.issues.map(issue => ({
			id: issue.id, name: names.get(issue.id)?.name ?? "", code: issue.code
		})),
		relativeSnapshotIssues: relative.issues.map(issue => ({
			id: issue.id, name: names.get(issue.id)?.name ?? "", code: issue.code
		})),
		relativeSnapshotAppliedStrategies: applied,
		allocatedSnapshotAppliedStrategies: allocatedApplied,
		allocatedSnapshotIssues: allocated.issues.map(issue => ({
			id: issue.id, name: names.get(issue.id)?.name ?? "", code: issue.code
		})),
		gridEligibility,
		allocatedVsRelative: {
			totalChanged: allocatedChanges.totalChanged,
			localRectChanged: allocatedChanges.localRectChanged,
			inheritedOnly: allocatedChanges.inheritedOnly,
			topRootCauses: allocatedChanges.topRootCauses,
			firstChanges: allocatedChanges.changed.slice(0, options.maxDiffs ?? 30)
		},
		focusSelection: options.focusLabel ?? "default server-list/filter ancestry",
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
		warning: "All rectangles are unzoomed Studio model coordinates. These are three Studio snapshot variants plus a live model, not independently measured Workbench geometry."
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
		"Allocated-parent experimental strategies applied: " +
			report.allocatedSnapshotAppliedStrategies.length,
		"New allocations vs legacy relative snapshot: " + report.allocatedVsRelative.totalChanged +
			" changed widgets (" + report.allocatedVsRelative.localRectChanged + " local, " +
			report.allocatedVsRelative.inheritedOnly + " inherited only)",
		"Measured GridSpacers: " + report.gridEligibility.totalGridSpacers,
		"Relative prototype skip reasons: " + JSON.stringify(report.gridEligibility.relativeReasonCounts),
		"Fixed-grid skip reasons: " + JSON.stringify(report.gridEligibility.fixedReasonCounts),
		"Child topology (independent second gate): " + JSON.stringify(report.gridEligibility.childTopologyReasonCounts),
		"Content sizing modes: " + JSON.stringify(report.gridEligibility.contentSizingModeCounts),
		"Parents with both exact-size flags: " + report.gridEligibility.exactParentSizeCount,
		"Allocated-parent eligibility / activation: " + JSON.stringify(report.gridEligibility.allocatedReasonCounts),
		"Focus: " + report.focusSelection,
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
	output.push("", "## Allocated-parent vs legacy relative snapshot root causes", "",
		"| Widget | Type | Affected | Local delta x/y/w/h |",
		"|---|---|---:|---|");
	for (const item of report.allocatedVsRelative.topRootCauses)
		output.push("| " + item.name + " | " + item.type + " | " + item.affected +
			" | " + Object.values(item.localDelta).join(" / ") + " |");
	output.push("", "## Live Grid vs basic snapshot root causes", "",
		"| Widget | Type | Affected | Local delta x/y/w/h |",
		"|---|---|---:|---|");
	for (const item of report.liveGridVsBasic.topRootCauses)
		output.push("| " + item.name + " | " + item.type + " | " + item.affectedWidgets +
			" | " + Object.values(item.localDelta).join(" / ") + " |");
	output.push("", "## GridSpacer native-strategy eligibility", "",
		"| GridSpacer | Child slots | Content W/H | Parent exact X/Y | Secondary child gate | Relative reason | Fixed reason | Legacy applied | Allocated applied | Allocated reason |",
		"|---|---:|---|---|---|---|---|---|---|---|");
	for (const item of report.gridEligibility.items)
		output.push("| " + item.name + " | " + item.eligibleChildCount + "/" + item.childCount +
			" | " + Number(item.contentWidth) + "/" + Number(item.contentHeight) +
			" | " + Number(item.exactSizeX) + "/" + Number(item.exactSizeY) +
			" | " + item.childTopologyReason + (item.childTopologyBlocker ? " (" + item.childTopologyBlocker + ")" : "") +
			" | " + item.relativeReason + " | " + item.fixedReason + " | " + (item.appliedMode ?? "none") +
			" | " + (item.allocatedMode ?? "none") + " | " + item.allocatedReason + " |");
	output.push("", "## Focused ancestry and rectangles", "");
	for (const item of report.focused)
		output.push("- " + [...item.ancestry, item.name].join(" > ") +
			" | basic=" + JSON.stringify(item.basicLocal) +
			" | relative=" + JSON.stringify(item.relativeLocal) +
			" | allocated=" + JSON.stringify(item.allocatedLocal) +
			" | allocated-minus-legacy=" + JSON.stringify(item.allocatedVsRelativeDelta) +
			" | live-basic-delta=" + JSON.stringify(item.liveGridVsBasic?.delta ?? null));
	output.push("", report.warning);
	return output.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const files = args.filter(arg => !arg.startsWith("--"));
	const flags = args.filter(arg => arg.startsWith("--"));
	const invalidFlags = flags.some(arg => arg !== "--json" && !arg.startsWith("--max-focused=")
		&& !arg.startsWith("--focus="));
	const duplicateFlags = flags.filter(arg => arg === "--json").length > 1
		|| flags.filter(arg => arg.startsWith("--max-focused=")).length > 1
		|| flags.filter(arg => arg.startsWith("--focus=")).length > 1;
	if (files.length !== 1 || invalidFlags || duplicateFlags) {
		console.error("Usage: node scripts/Analyze-NativeLayoutGeometry.mjs <layout-file> [--json] [--max-focused=N] [--focus=substring]");
		process.exitCode = 2;
	} else {
		try {
			const limit = args.find(arg => arg.startsWith("--max-focused="));
			const maxFocused = limit ? Number(limit.split("=")[1]) : 35;
			if (!Number.isInteger(maxFocused) || maxFocused < 1 || maxFocused > 200)
				throw new Error("max-focused must be an integer from 1 to 200");
			const focusFlag = flags.find(arg => arg.startsWith("--focus="));
			const focusLabel = focusFlag ? focusFlag.slice("--focus=".length) : null;
			if (focusLabel !== null && (focusLabel.length < 1 || focusLabel.length > 128))
				throw new Error("focus must be a nonempty substring up to 128 characters");
			const focusPattern = focusLabel ? { test(value) { return value.toLowerCase().includes(focusLabel.toLowerCase()); } } : undefined;
			const report = AnalyzeVanillaGeometry(readFileSync(resolve(files[0]), "utf8"), {
				maxFocused, focusPattern, focusLabel: focusLabel ?? undefined
			});
			console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : FormatVanillaGeometry(report));
		} catch (error) {
			console.error("Geometry analysis failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
