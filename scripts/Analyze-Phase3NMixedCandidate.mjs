#!/usr/bin/env node
/**
 * Research-only native-driven candidate evaluation.
 * No renderer flags, no source rewrites; independent native evidence
 * is used exclusively AFTER prediction, for read-only comparison.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ProbeMixedAxisGrid } from "../.geometry-engine-test-build/SnapshotForTests.js";
import { ResolveAuthoredRectWithSize } from "../.geometry-engine-test-build/WidgetGeometry.js";

const s_Native = JSON.parse(readFileSync(new URL(
	"../tests/fixtures/workbench-grid/grid-server-browser-phase3n-native.json", import.meta.url), "utf8"));

function Key(name, parent) {
	return JSON.stringify([name, parent]);
}

export function AnalyzePhase3NMixedCandidate(source, reference = s_Native) {
	const document = new LayoutParser().Parse(source);
	const measured = MeasureLayoutTree(document.roots);
	if (!Array.isArray(reference.root) || reference.root.length !== 2)
		throw new Error("Invalid native viewport");

	const predicted = new Map();
	const candidateRoots = [];
	const [width, height] = reference.root;
	function Record(node, parentName, rect) {
		const key = Key(node.node.name, parentName);
		if (predicted.has(key))
			predicted.set(key, null);
		else
			predicted.set(key, [rect.x, rect.y, rect.width, rect.height]);
	}
	function Descend(node, rect, result) {
		const plan = result.plans.get(node);
		if (!plan)
			return;
		for (let i = 0; i < plan.participatingIndices.length; ++i) {
			const index = plan.participatingIndices[i];
			const child = node.children[index];
			const slot = plan.plan.rects[i];
			const childRect = {
				x: rect.x + slot.x, y: rect.y + slot.y,
				width: slot.width, height: slot.height
			};
			Record(child, node.node.name, childRect);
			if (result.plans.has(child))
				Descend(child, childRect, result);
		}
	}

	function Visit(node, parent, parentRect, isManagedParent) {
		if (!isManagedParent && node.strategy.kind === "grid"
			&& (node.unresolvedContentWidth || node.unresolvedContentHeight)) {
			const candidate = ProbeMixedAxisGrid(node, parentRect.width, parentRect.height);
			if (candidate) {
				const local = ResolveAuthoredRectWithSize(node.authored,
					{ width: parentRect.width, height: parentRect.height },
					{ width: candidate.root.plan.width, height: candidate.root.plan.height });
				const rect = { x: parentRect.x + local.x, y: parentRect.y + local.y,
					width: local.width, height: local.height };
				Record(node, parent?.node.name ?? "", rect);
				candidateRoots.push({ name: node.node.name, size: [rect.width, rect.height],
					nestedCount: candidate.nestedCount });
				Descend(node, rect, candidate);
				return;
			}
		}
		for (const child of node.children)
			Visit(child, node, parentRect, node.strategy.requiresArrangement);
	}
	for (const node of measured.roots) {
		// Standalone WindowWidget root fills this captured native viewport.
		// No generic Frame/Window ancestor layout is inferred.
		if (node.strategy.requiresArrangement)
			continue;
		const rect = { x: 0, y: 0, width, height };
		for (const child of node.children)
			Visit(child, node, rect, false);
	}

	const rows = [];
	const hidden = new Set(reference.keyRects.filter(entry => !entry[4]).map(entry => entry[0]));
	for (const [name, parent, ordinal, native, visible] of reference.keyRects) {
		if (!visible || hidden.has(parent))
			continue;
		const studio = predicted.get(Key(name, parent));
		if (!studio)
			continue;
		const delta = studio.map((value, i) => +(value - native[i]).toFixed(3));
		const maxDelta = Math.max(...delta.map(Math.abs));
		rows.push({ name, parent, ordinal, native, candidate: studio, delta,
			status: maxDelta <= 0.025 ? "within-tolerance" : "mismatch" });
	}
	return {
		phase: "3N",
		status: "READ_ONLY_MIXED_AXIS_CANDIDATE_NOT_PRODUCTION",
		candidateRoots, compared: rows.length,
		matched: rows.filter(row => row.status === "within-tolerance").length,
		mismatched: rows.filter(row => row.status === "mismatch").length,
		rows,
		warning: "No native fixture values were used to calculate the candidate. Results do not establish general DayZ or Workbench parity; hidden branches and other manager topologies are unsupported."
	};
}

export function FormatPhase3NMixedCandidate(report) {
	const lines = [
		"# Phase 3N — Read-only mixed-axis candidate",
		"Status: " + report.status,
		"Root candidates: " + report.candidateRoots.map(root =>
			root.name + " " + root.size.join("x") + " (" + root.nestedCount + " nested)").join("; "),
		"Compared=" + report.compared + " matched=" + report.matched + " mismatched=" + report.mismatched,
		""
	];
	for (const row of report.rows)
		lines.push(row.status + " " + row.name + " native=" + row.native.join(",")
			+ " candidate=" + row.candidate.join(",") + " delta=" + row.delta.join(","));
	return [...lines, "", report.warning].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== "--json")) {
		console.error("Usage: node scripts/Analyze-Phase3NMixedCandidate.mjs <local-vanilla-layout> [--json]");
		process.exitCode = 2;
	} else {
		try {
			const report = AnalyzePhase3NMixedCandidate(readFileSync(resolve(args[0]), "utf8"));
			console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : FormatPhase3NMixedCandidate(report));
		} catch (error) {
			console.error("Mixed-axis candidate failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
