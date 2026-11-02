#!/usr/bin/env node
/** Phase 3N: read-only GridSpacer source dependency inventory; no native parity inferred. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, SelectManagedChildIndices } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { AnalyzeVanillaGeometry } from "./Analyze-NativeLayoutGeometry.mjs";

const s_DefaultFocus = [
	"server_list_root", "server_list_content_root", "basic_infoserver_list_content_header",
	"filters_root", "filters_content", "details_description_container",
	"details_description_content", "details_description_panel"
];
function HasContentAxis(node) {
	return node.unresolvedContentWidth || node.unresolvedContentHeight;
}
function ClassifyNestedRoot(node, depth = 0) {
	if (depth > 8)
		return { status: "guard-hint", reason: "maximum-manager-depth", blocker: node.node.name };
	if (node.strategy.kind !== "grid" || !node.nativeGrid || !HasContentAxis(node))
		return { status: "not-root-candidate", reason: "not-a-content-sized-grid", blocker: node.node.name };
	const indices = SelectManagedChildIndices(node.children, node.nativeIgnoreInvisible);
	if (indices === null)
		return { status: "guard-hint", reason: "unknown-managed-visibility", blocker: node.node.name };
	if (!indices.length)
		return { status: "guard-hint", reason: "no-managed-children", blocker: node.node.name };
	const selected = indices.map(index => node.children[index]);
	const nested = selected.filter(child => child.strategy.kind === "grid" && HasContentAxis(child));
	if (!nested.length)
		return { status: "not-root-candidate", reason: "no-direct-nested-content-grid", blocker: null };
	for (const child of selected) {
		const a = child.authored;
		if (![a.sizeX, a.sizeY].every(Number.isFinite) || a.sizeX < 0 || a.sizeY < 0)
			return { status: "guard-hint", reason: "invalid-managed-size", blocker: child.node.name };
		const isNested = child.strategy.kind === "grid" && HasContentAxis(child);
		if (child.strategy.kind === "grid" && !isNested)
			return { status: "guard-hint", reason: "non-content-grid-descendant", blocker: child.node.name };
		if (!isNested && (child.strategy.requiresArrangement || a.sizeToContentWidth || a.sizeToContentHeight))
			return { status: "guard-hint", reason: "unsupported-managed-or-content-child", blocker: child.node.name };
		if (!isNested && (!a.exactSizeX || !a.exactSizeY))
			return { status: "guard-hint", reason: "relative-ordinary-sibling", blocker: child.node.name };
	}
	for (const child of nested) {
		const result = ClassifyNestedRoot(child, depth + 1);
		// A leaf without a further nested child is an expected end of the chain.
		if (result.status === "guard-hint")
			return { status: "guard-hint", reason: "nested-" + result.reason, blocker: result.blocker };
	}
	return { status: "structural-candidate", reason: "requires-allocated-parent-and-planner-verification", blocker: null };
}
function DescribeChild(child, index, managedIndices) {
	const a = child.authored;
	return {
		index, name: child.node.name, type: child.node.type,
		managed: managedIndices === null ? null : managedIndices.includes(index),
		strategy: child.strategy.kind,
		contentWidth: child.unresolvedContentWidth, contentHeight: child.unresolvedContentHeight,
		exactWidth: a.exactSizeX, exactHeight: a.exactSizeY,
		sizeX: a.sizeX, sizeY: a.sizeY,
		isNestedContentGrid: child.strategy.kind === "grid" && HasContentAxis(child)
	};
}
export function AnalyzePhase3NDependencies(source, options = {}) {
	const document = new LayoutParser().Parse(source);
	if (!document.roots.length)
		throw new Error("Cannot analyze a layout without root widgets");
	const measured = MeasureLayoutTree(document.roots);
	const baseline = AnalyzeVanillaGeometry(source);
	const modes = new Map(baseline.nestedSnapshotAppliedStrategies.map(item => [item.id, item.mode]));
	const legacy = new Map(baseline.gridEligibility.items.map(item => [item.id, item]));
	const grids = [];
	function Visit(node, ancestry = []) {
		if (node.strategy.kind === "grid") {
			const managedIndices = SelectManagedChildIndices(node.children, node.nativeIgnoreInvisible);
			const children = node.children.map((child, index) => DescribeChild(child, index, managedIndices));
			grids.push({
				id: node.node.id, name: node.node.name, ancestry,
				contentWidth: node.unresolvedContentWidth, contentHeight: node.unresolvedContentHeight,
				exactWidth: node.authored.exactSizeX, exactHeight: node.authored.exactSizeY,
				authoredSize: { x: node.authored.sizeX, y: node.authored.sizeY },
				ignoreInvisible: node.nativeIgnoreInvisible,
				childCount: children.length, managedCount: managedIndices?.length ?? null,
				children,
				phase3mApplied: modes.get(node.node.id) === "grid-nested-allocation-prototype",
				strategyMode: modes.get(node.node.id) ?? null,
				phase3mRootGuardHint: ClassifyNestedRoot(node),
				legacyEligibilityReason: legacy.get(node.node.id)?.relativeReason ?? null,
				legacyChildTopologyReason: legacy.get(node.node.id)?.childTopologyReason ?? null
			});
		}
		for (const child of node.children)
			Visit(child, [...ancestry, node.node.name]);
	}
	for (const node of measured.roots)
		Visit(node);
	const focus = options.focus ?? s_DefaultFocus;
	const focused = grids.filter(item => focus.some(name => item.name.toLowerCase() === name.toLowerCase()));
	return {
		phase: "3N", status: "OFFLINE_DEPENDENCY_DIAGNOSTIC_NOT_NATIVE_PARITY",
		root: baseline.root, gridCount: grids.length,
		phase3mAppliedCount: grids.filter(item => item.phase3mApplied).length,
		phase3mGeometryDelta: baseline.nestedVsSingleAxis,
		focused, grids,
		warning: "Guard hints are structural observations, not exact runtime failure causes. A nested descendant can receive a cached Phase 3M plan even though it is not an independent root candidate. No native Workbench geometry is inferred."
	};
}
export function FormatPhase3NDependencies(report) {
	const lines = [
		"# Phase 3N — GridSpacer dependency inventory (read-only)",
		"Status: " + report.status,
		"Grids: " + report.gridCount + "; Phase 3M applied: " + report.phase3mAppliedCount,
		"Phase 3M changed rectangles: " + report.phase3mGeometryDelta.totalChanged, ""
	];
	for (const grid of report.focused) {
		const guard = grid.phase3mRootGuardHint;
		lines.push(grid.name + " | applied=" + grid.phase3mApplied + " | mode=" + (grid.strategyMode ?? "none"));
		lines.push("  hierarchy: " + [...grid.ancestry, grid.name].join(" > "));
		lines.push("  content H/V=" + grid.contentWidth + "/" + grid.contentHeight
			+ "; exact H/V=" + grid.exactWidth + "/" + grid.exactHeight
			+ "; children=" + grid.childCount + "; managed=" + grid.managedCount);
		lines.push("  Phase3M root guard hint: " + guard.status + "/" + guard.reason
			+ (guard.blocker ? " [" + guard.blocker + "]" : ""));
		lines.push("  Older relative diagnostic: " + grid.legacyEligibilityReason + "/" + grid.legacyChildTopologyReason);
		for (const child of grid.children) {
			lines.push("    " + (child.managed === true ? "[M]" : child.managed === false ? "[ ]" : "[?]")
				+ " " + child.name + " (" + child.strategy + ")"
				+ " content=" + child.contentWidth + "/" + child.contentHeight
				+ " exact=" + child.exactWidth + "/" + child.exactHeight
				+ " size=" + child.sizeX + "/" + child.sizeY);
		}
		lines.push("");
	}
	lines.push("Model changes (five flags versus four):");
	for (const item of report.phase3mGeometryDelta.firstChanges)
		lines.push("  " + item.name + " local=" + item.localChanged + " delta=" + JSON.stringify(item.delta));
	lines.push("", report.warning);
	return lines.join("\n");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const files = args.filter(item => !item.startsWith("--"));
	const flags = args.filter(item => item.startsWith("--"));
	const invalid = flags.some(item => item !== "--json" && !item.startsWith("--focus="));
	if (files.length !== 1 || invalid || flags.filter(item => item === "--json").length > 1) {
		console.error("Usage: node scripts/Analyze-Phase3NDependencies.mjs <layout-file> [--json] [--focus=name1,name2]");
		process.exitCode = 2;
	} else {
		try {
			const focusFlag = flags.find(item => item.startsWith("--focus="));
			const focus = focusFlag ? focusFlag.slice(8).split(",").map(item => item.trim()).filter(Boolean) : undefined;
			if (focusFlag && (!focus?.length || focus.some(item => item.length > 128)))
				throw new Error("focus must specify one or more widget names (at most 128 characters each)");
			const source = readFileSync(resolve(files[0]), "utf8");
			const report = AnalyzePhase3NDependencies(source, { focus });
			console.log(flags.includes("--json") ? JSON.stringify(report, null, 2) : FormatPhase3NDependencies(report));
		} catch (error) {
			console.error("Phase 3N analysis failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
