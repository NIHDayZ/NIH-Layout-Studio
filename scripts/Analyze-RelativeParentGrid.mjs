#!/usr/bin/env node
/**
 * Phase 3I: OFFLINE HYPOTHESIS ONLY. Resolve authored relative parent dimensions
 * to a pre-content base rectangle, then invoke the already-tested pure native
 * GridSpacer planner. Never patch the production bridge or Canvas from this.
 *
 * This matches source-relative swatch offsets against the *independently
 * captured* Phase 3H Workbench screenshot: source stays unchanged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import {
	MeasureLayoutTree, ArrangeMeasuredGeometry, SelectManagedChildIndices,
	PlanNativeRelativeGrid
} from "../.geometry-engine-test-build/SnapshotForTests.js";

const s_Root = { x: 0, y: 0, width: 1920, height: 1080 };
const s_SupportedSuffixes = ["ExactBoth", "RelativeWidth", "RelativeHeight", "RelativeBoth"];
const s_DirectGroups = ["Direct", "Nested"];

function FindNodes(measured) {
	const result = new Map();
	function Walk(node) {
		result.set(node.node.name, node);
		for (const child of node.children)
			Walk(child);
	}
	for (const node of measured.roots)
		Walk(node);
	return result;
}

function CandidateFromResolvedParent(node, baseline) {
	const authored = node.authored;
	const grid = node.nativeGrid;
	const base = baseline.byId.get(node.node.id);
	if (!grid || node.strategy.kind !== "grid"
		|| !node.unresolvedContentWidth || !node.unresolvedContentHeight)
		return { status: "UNSUPPORTED_CONTENT_MODE" };
	if (!base || !Number.isFinite(base.localRect.width) || !Number.isFinite(base.localRect.height)
		|| base.localRect.width < 0 || base.localRect.height < 0)
		return { status: "UNRESOLVED_BASE_RECT" };

	const indices = SelectManagedChildIndices(node.children, node.nativeIgnoreInvisible);
	if (!indices || indices.length === 0)
		return { status: "UNRESOLVED_PARTICIPATION" };
	const children = [];
	for (const index of indices) {
		const child = node.children[index];
		const a = child.authored;
		if (a.sizeToContentWidth || a.sizeToContentHeight || child.strategy.requiresArrangement)
			return { status: "UNSUPPORTED_NESTED_MANAGED_CHILD", name: child.node.name };
		if (![a.sizeX, a.sizeY].every(Number.isFinite) || a.sizeX < 0 || a.sizeY < 0)
			return { status: "INVALID_CHILD_SIZE" };
		children.push({
			width: a.sizeX, height: a.sizeY,
			exactWidth: a.exactSizeX, exactHeight: a.exactSizeY
		});
	}
	const plan = PlanNativeRelativeGrid({
		columns: grid.columns,
		rows: grid.rows,
		padding: grid.padding,
		margin: grid.margin,
		authoredWidth: base.localRect.width,
		authoredHeight: base.localRect.height,
		contentWidth: true,
		contentHeight: true,
		children
	});
	if (!plan)
		return { status: "PLANNER_REJECTED" };

	return {
		status: "HYPOTHESIS_CANDIDATE",
		parentExactAxes: [authored.exactSizeX, authored.exactSizeY],
		authoredParentSize: [authored.sizeX, authored.sizeY],
		resolvedBeforeContent: [base.localRect.width, base.localRect.height],
		predictedContentSize: [plan.width, plan.height],
		predictedChildren: indices.map((index, i) => ({
			name: node.children[index].node.name,
			rect: plan.rects[i]
		}))
	};
}

function CompareScreenshot(record, plan, zoom) {
	const rects = new Map(plan.predictedChildren.map(x => [x.name.slice(-6).toLowerCase(), x.rect]));
	const blue = plan.predictedChildren.find(x => x.name.endsWith("Blue"))?.rect;
	const orange = plan.predictedChildren.find(x => x.name.endsWith("Orange"))?.rect;
	const green = plan.predictedChildren.find(x => x.name.endsWith("Green"))?.rect;
	if (!blue || !orange || !green)
		return null;
	const observed = record.workbench;
	const predicted = {
		orangeDx: (orange.x - blue.x) * zoom,
		greenDy: (green.y - blue.y) * zoom,
		orangeWidth: orange.width * zoom
	};
	const actual = {
		orangeDx: observed.orange.x - observed.blue.x,
		greenDy: observed.green.y - observed.blue.y,
		orangeWidth: observed.orange.width
	};
	const absoluteErrors = Object.fromEntries(
		Object.keys(actual).map(key => [key, +(Math.abs(predicted[key] - actual[key])).toFixed(3)])
	);
	return { predicted, actual, absoluteErrors };
}

export function AnalyzeRelativeParentResolution(source, screenshotEvidence) {
	const document = new LayoutParser().Parse(source);
	if (!document.roots.length)
		throw new Error("No parseable widget root");
	if (screenshotEvidence?.phase !== "3H" || screenshotEvidence?.records?.length !== 8)
		throw new Error("Expected independent Phase 3H eight-case screenshot evidence");
	const measured = MeasureLayoutTree(document.roots);
	const baseline = ArrangeMeasuredGeometry(measured, s_Root);
	const names = FindNodes(measured);
	const results = [];
	for (const group of s_DirectGroups) {
		for (const mode of s_SupportedSuffixes) {
			const name = "Grid" + group + mode;
			const node = names.get(name);
			if (!node)
				throw new Error("Missing preregistered GridSpacer case: " + name);
			const record = screenshotEvidence.records.find(item =>
				item.group === group && item.mode === mode);
			if (!record)
				throw new Error("Missing independently measured Workbench case: " + name);
			const candidate = CandidateFromResolvedParent(node, baseline);
			const comparison = candidate.status === "HYPOTHESIS_CANDIDATE"
				? CompareScreenshot(record, candidate, screenshotEvidence.nativeScreenshot.displayZoom) : null;
			results.push({ name, group, mode, ...candidate, comparison });
		}
	}
	const candidates = results.filter(item => item.status === "HYPOTHESIS_CANDIDATE");
	const matchedOffsets = candidates.filter(item =>
		item.comparison?.absoluteErrors.orangeDx <= 1
		&& item.comparison?.absoluteErrors.greenDy <= 1);
	const withinWidthTolerance = candidates.filter(item =>
		item.comparison?.absoluteErrors.orangeWidth <= 2);
	return {
		phase: "3I",
		status: "RESEARCH_ONLY_PROJECTION_NOT_WORKBENCH_GEOMETRY",
		independentScreenshotSource: screenshotEvidence.nativeScreenshot.conversationUpload,
		selection: "Only eight preregistered direct/nested content-sized simple-child GridSpacers",
		model: "pre-content Studio base rectangle -> existing Phase 2L content-sized native-derived planner",
		tested: results.length,
		candidatePlans: candidates.length,
		offsetMatchesWithinOneScreenshotPixel: matchedOffsets.length,
		orangeWidthsWithinTwoScreenshotPixels: withinWidthTolerance.length,
		results,
		warning: "Offset/width screenshot agreement does not validate general native parent allocation, clipping, nested managed children, or production renderer behavior."
	};
}

export function FormatRelativeParentResolution(report) {
	const lines = [
		"# Phase 3I — Controlled relative-parent normalization hypothesis",
		"",
		"Diagnostic only; no native engine rule or production renderer was changed.",
		"",
		"Candidate plans: " + report.candidatePlans + "/" + report.tested,
		"Observed orange/green offset matches (<= 1 screenshot px): " + report.offsetMatchesWithinOneScreenshotPixel + "/" + report.tested,
		"Observed orange width matches (<= 2 screenshot px): " + report.orangeWidthsWithinTwoScreenshotPixels + "/" + report.tested,
		"",
		"| GridSpacer | Exact X/Y | Base W/H | Content W/H prediction | Native orange X delta | Predicted orange X delta | Native green Y delta | Predicted green Y delta |",
		"|---|---|---|---|---:|---:|---:|---:|"
	];
	for (const item of report.results) {
		if (!item.comparison)
			continue;
		const c = item.comparison;
		lines.push("| " + item.name + " | " + item.parentExactAxes.map(Number).join("/") +
			" | " + item.resolvedBeforeContent.map(x => x.toFixed(3)).join("/") +
			" | " + item.predictedContentSize.map(x => x.toFixed(3)).join("/") +
			" | " + c.actual.orangeDx + " | " + c.predicted.orangeDx.toFixed(2) +
			" | " + c.actual.greenDy + " | " + c.predicted.greenDy.toFixed(2) + " |");
	}
	lines.push("", report.warning);
	return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const files = args.filter(arg => !arg.startsWith("--"));
	const flags = args.filter(arg => arg.startsWith("--"));
	if (files.length !== 1 || flags.some(arg => arg !== "--json") || flags.length > 1) {
		console.error("Usage: node scripts/Analyze-RelativeParentGrid.mjs <layout-file> [--json]");
		process.exitCode = 2;
	} else {
		try {
			const evidence = JSON.parse(readFileSync(
				new URL("../tests/fixtures/workbench-grid/grid-relative-parent-phase3h-screenshot-observations.json",
					import.meta.url), "utf8"));
			const result = AnalyzeRelativeParentResolution(readFileSync(resolve(files[0]), "utf8"), evidence);
			console.log(flags.includes("--json")
				? JSON.stringify(result, null, 2) : FormatRelativeParentResolution(result));
		} catch (error) {
			console.error("Relative-parent diagnostic failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
