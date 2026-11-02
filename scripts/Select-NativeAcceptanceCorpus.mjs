#!/usr/bin/env node
/**
 * Select a small, varied native GUI acceptance corpus from extracted DayZ
 * .layout files. The actual parser is used; source bodies and widget names
 * are not emitted. Deterministic greedy selection covers five workflows.
 *
 * This tool selects validation candidates, not compatibility PASS results.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

const s_Roles = [
	{ id: "images-styles", target: ["ImageWidgetClass"],
		weights: { ImageWidgetClass: 12, PanelWidgetClass: 2, FrameWidgetClass: 1 } },
	{ id: "typography", target: ["TextWidgetClass", "MultilineTextWidgetClass", "RichTextWidgetClass"],
		weights: { TextWidgetClass: 10, RichTextWidgetClass: 10, MultilineTextWidgetClass: 8, PanelWidgetClass: 1 } },
	{ id: "managed-layout", target: ["GridSpacerWidgetClass", "WrapSpacerWidgetClass"],
		weights: { GridSpacerWidgetClass: 12, WrapSpacerWidgetClass: 8, FrameWidgetClass: 1 } },
	{ id: "controls", target: ["ButtonWidgetClass", "EditBoxWidgetClass", "CheckBoxWidgetClass", "SliderWidgetClass"],
		weights: { ButtonWidgetClass: 10, EditBoxWidgetClass: 8, CheckBoxWidgetClass: 7, SliderWidgetClass: 7 } },
	{ id: "scroll-clipping", target: ["ScrollWidgetClass"],
		weights: { ScrollWidgetClass: 15, WrapSpacerWidgetClass: 5, PanelWidgetClass: 2 } }
];
const s_Common = [
	"ImageWidgetClass", "PanelWidgetClass", "TextWidgetClass",
	"FrameWidgetClass", "GridSpacerWidgetClass", "ButtonWidgetClass"
];

function ScanFiles(folder) {
	const files = [];
	function Walk(dir) {
		for (const item of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, item.name);
			if (item.isDirectory())
				Walk(path);
			else if (item.isFile() && item.name.toLowerCase().endsWith(".layout"))
				files.push(path);
		}
	}
	Walk(folder);
	return files.sort();
}

function ScanNodes(nodes, counts, state) {
	for (const node of nodes) {
		if (node.type.endsWith("WidgetClass")) {
			counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
			++state.count;
			if (node.sourceHasNoIdentifier === true)
				++state.idless;
		}
		ScanNodes(node.children, counts, state);
	}
}

function CreateInventory(folder) {
	if (!existsSync(folder) || !statSync(folder).isDirectory())
		throw new Error("Expected an existing extracted DayZ GUI directory");
	const files = ScanFiles(folder);
	if (!files.length)
		throw new Error("No .layout files found in extracted GUI directory");
	const parser = new LayoutParser();
	const entries = [];
	const failures = [];
	const allClasses = new Set();
	let declarations = 0;
	let idless = 0;
	for (const path of files) {
		const name = relative(folder, path).replaceAll("\\", "/");
		try {
			const parsed = parser.Parse(readFileSync(path, "utf8"));
			if (!parsed.roots.length)
				throw new Error("No parseable root declaration");
			const counts = new Map();
			const state = { count: 0, idless: 0 };
			ScanNodes(parsed.roots, counts, state);
			for (const key of counts.keys())
				allClasses.add(key);
			declarations += state.count;
			idless += state.idless;
			entries.push({ file: name, counts, declarations: state.count,
				idless: state.idless, distinctClasses: counts.size });
		} catch (error) {
			failures.push({ file: name, reason: String(error?.message ?? error) });
		}
	}
	return {
		entries, failures, files: files.length, declarations, idless,
		distinctClassCount: allClasses.size,
		allClasses: [...allClasses].sort()
	};
}

function Score(entry, role, alreadyCovered) {
	if (!role.target.some(type => (entry.counts.get(type) ?? 0) > 0))
		return -1;
	let weighted = 0;
	for (const [type, weight] of Object.entries(role.weights))
		weighted += Math.log2(1 + (entry.counts.get(type) ?? 0)) * weight;
	const newKinds = [...entry.counts.keys()].filter(type => !alreadyCovered.has(type)).length;
	const common = s_Common.filter(type => (entry.counts.get(type) ?? 0) > 0).length;
	return weighted + 0.75 * newKinds + 0.35 * common;
}

function Present(entry, role, rankScore) {
	const widgetTypes = [...entry.counts].sort((a, b) =>
		b[1] - a[1] || a[0].localeCompare(b[0]));
	return {
		role: role.id,
		path: entry.file,
		score: +rankScore.toFixed(3),
		widgetDeclarations: entry.declarations,
		distinctClasses: entry.distinctClasses,
		idlessDeclarations: entry.idless,
		targetDeclarations: role.target.reduce((count, type) =>
			count + (entry.counts.get(type) ?? 0), 0),
		mainTypes: widgetTypes.slice(0, 8).map(([name, count]) => ({ name, count }))
	};
}

export function SelectNativeAcceptanceCorpus(folder, options = {}) {
	const root = resolve(folder);
	const inventory = CreateInventory(root);
	const limit = options.limit ?? 5;
	if (!Number.isInteger(limit) || limit < 1 || limit > 5)
		throw new Error("Acceptance corpus limit must be an integer from 1 to 5");
	const selected = [];
	const selectedPaths = new Set();
	const coveredTypes = new Set();
	const unfilledRoles = [];
	for (const role of s_Roles.slice(0, limit)) {
		const eligible = inventory.entries.map(entry => ({
			entry, score: Score(entry, role, coveredTypes)
		})).filter(item => item.score >= 0 && !selectedPaths.has(item.entry.file))
			.sort((left, right) =>
				right.score - left.score || left.entry.file.localeCompare(right.entry.file));
		if (!eligible.length) {
			unfilledRoles.push(role.id);
			continue;
		}
		const chosen = eligible[0];
		selectedPaths.add(chosen.entry.file);
		for (const type of chosen.entry.counts.keys())
			coveredTypes.add(type);
		selected.push(Present(chosen.entry, role, chosen.score));
	}
	const commonCounts = Object.fromEntries(s_Common.map(type => [
		type, inventory.entries.reduce((total, entry) => total +
			(entry.counts.get(type) ?? 0), 0)
	]));
	return {
		schemaVersion: 1,
		status: inventory.failures.length ? "PARTIAL_EXTRACTION" : "CANDIDATES_ONLY",
		selectionMethod: "deterministic greedy role-specific log-weighted coverage; no rendering claims",
		rootInspectedLocally: true,
		corpus: {
			layoutFiles: inventory.files,
			parsedLayoutFiles: inventory.entries.length,
			parseFailures: inventory.failures.length,
			widgetDeclarations: inventory.declarations,
			idlessDeclarations: inventory.idless,
			distinctClasses: inventory.distinctClassCount,
			topSixDeclarations: commonCounts,
			otherParseFailures: inventory.failures.slice(0, 20)
		},
		requestedRoles: s_Roles.slice(0, limit).map(role => role.id),
		unfilledRoles,
		selected,
		selectedDistinctClasses: coveredTypes.size,
		representedTypes: [...coveredTypes].sort(),
		warning: "File paths are local relative paths. Candidate selection is not native compatibility validation. Do not commit extracted DayZ layouts."
	};
}

export function FormatAcceptanceCorpus(report) {
	const out = [
		"# NIH Layout Studio — native acceptance candidates",
		"",
		"Deterministic suggestions only; no compatibility PASS claims.",
		"",
		"Layouts: " + report.corpus.layoutFiles + "; parsed: " +
			report.corpus.parsedLayoutFiles + "; parser failures: " +
			report.corpus.parseFailures + "; widget declarations: " +
			report.corpus.widgetDeclarations + "; classes: " + report.corpus.distinctClasses,
		"",
		"| Priority role | Selected relative layout | Declarations | Distinct classes | Role-target declarations |",
		"|---|---|---:|---:|---:|"
	];
	for (const item of report.selected)
		out.push("| " + item.role + " | " + item.path.replaceAll("|", "\\|") +
			" | " + item.widgetDeclarations + " | " + item.distinctClasses +
			" | " + item.targetDeclarations + " |");
	out.push("", "Unfilled roles: " +
		(report.unfilledRoles.length ? report.unfilledRoles.join(", ") : "none"),
		"Selected files cover " + report.selectedDistinctClasses +
		" distinct widget classes from the parsed source corpus.",
		"",
		"## Acceptance gates for each selected file",
		"",
		"1. Load the original source in Studio; ensure the widget tree and declared properties survive parsing.",
		"2. Compare root and nested geometry, images/fonts/styles and clipping to native Workbench.",
		"3. Change one known-supported property; save/export; verify preservation of unrelated source properties.",
		"4. Reopen the exported layout in Workbench and compare again.",
		"5. Mark any missing renderer or native behavior as pending, not a parity pass.",
		"",
		"Do not commit proprietary native layout contents to the repository."
	);
	return out.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const paths = args.filter(arg => !arg.startsWith("--"));
	const json = args.includes("--json");
	const limitArgs = args.filter(arg => arg.startsWith("--limit="));
	if (paths.length !== 1 || args.some(arg => arg.startsWith("--")
		&& arg !== "--json" && !arg.startsWith("--limit=")) || limitArgs.length > 1) {
		console.error("Usage: node scripts/Select-NativeAcceptanceCorpus.mjs <extracted-gui-directory> [--json] [--limit=5]");
		process.exitCode = 2;
	} else {
		try {
			const limit = limitArgs.length ? Number(limitArgs[0].slice("--limit=".length)) : 5;
			const report = SelectNativeAcceptanceCorpus(paths[0], { limit });
			console.log(json ? JSON.stringify(report, null, 2) : FormatAcceptanceCorpus(report));
		} catch (error) {
			console.error("Native acceptance selection failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
