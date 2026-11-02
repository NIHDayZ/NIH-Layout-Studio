#!/usr/bin/env node
/**
 * Evidence-scoped Workbench compatibility audit.
 * Never claim a widget family passes native parity just because a test exists.
 * Reads only public repository fixtures; private gui.pbo census is optional.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { WorkbenchWidgetTypes } from "../.geometry-engine-test-build/WidgetSchema.js";

const s_Root = fileURLToPath(new URL("../", import.meta.url));
const s_Manifest = "tests/fixtures/compatibility/baseline-evidence.json";
const s_Axes = ["geometry", "render", "interaction", "roundtrip"];

function ReadJson(path) {
	// Windows PowerShell 5.1 Set-Content -Encoding UTF8 writes a BOM.
	return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function FindLayoutFiles(folder) {
	if (!existsSync(folder))
		return [];
	const result = [];
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const path = join(folder, entry.name);
		if (entry.isDirectory())
			result.push(...FindLayoutFiles(path));
		else if (entry.isFile() && entry.name.toLowerCase().endsWith(".layout"))
			result.push(path);
	}
	return result.sort();
}

function ScanNodes(nodes, add) {
	for (const node of nodes) {
		if (node.type.endsWith("WidgetClass"))
			add(node.type);
		ScanNodes(node.children, add);
	}
}

function CheckManifest(root, manifest, catalog) {
	const grouped = Object.values(manifest.groups).flat();
	if (new Set(grouped).size !== grouped.length
		|| grouped.length !== catalog.length
		|| grouped.some(name => !catalog.includes(name)))
		throw new Error("Evidence groups must exactly cover the current Workbench widget catalogue");
	for (const [name, evidence] of Object.entries(manifest.evidence)) {
		if (!catalog.includes(name))
			throw new Error("Evidence names an unknown Workbench widget: " + name);
		for (const [axis, paths] of Object.entries(evidence.tests ?? {})) {
			if (!s_Axes.includes(axis))
				throw new Error("Unsupported evidence axis " + axis);
			for (const path of paths) {
				if (!existsSync(join(root, path)))
					throw new Error("Missing test reference: " + path);
			}
		}
		for (const record of [...(evidence.native ?? []), ...(evidence.pending ?? [])]) {
			if (!record.scope || ![...s_Axes, "runtime"].includes(record.area)
				|| !existsSync(join(root, record.path)))
				throw new Error("Invalid scoped native evidence reference: " + name);
		}
	}
	for (const value of Object.values(manifest.crossCutting)) {
		if (!existsSync(join(root, value.implementation))
			|| (value.test && !existsSync(join(root, value.test))))
			throw new Error("Cross-cutting implementation or test reference is missing");
	}
}

function ValidateCensus(census) {
	if (census === null)
		return null;
	if (!census || !Number.isSafeInteger(census.layoutFiles) || !Array.isArray(census.classes))
		throw new Error("Expected JSON from scripts/audit-workbench-widgets.mjs --json");
	const seen = new Set();
	for (const item of census.classes) {
		if (typeof item.name !== "string" || seen.has(item.name)
			|| !Number.isSafeInteger(item.count) || item.count < 0
			|| !Number.isSafeInteger(item.layoutCount) || item.layoutCount < 0)
			throw new Error("Census has an invalid or duplicate widget entry");
		seen.add(item.name);
	}
	return census;
}

function AxisStatus(item, axis) {
	if ((item.native ?? []).some(value => value.area === axis))
		return "scoped-native-measurement";
	if ((item.pending ?? []).some(value => value.area === axis))
		return "native-comparison-pending";
	if ((item.tests?.[axis] ?? []).length > 0)
		return "automated-evidence-only";
	return "not-demonstrated";
}

export function BuildNativeCompatibilityBaseline(options = {}) {
	const root = options.root ?? s_Root;
	const manifest = ReadJson(join(root, s_Manifest));
	const catalog = [...WorkbenchWidgetTypes];
	CheckManifest(root, manifest, catalog);
	const census = ValidateCensus(options.census ?? null);
	const nativeTypes = new Map((census?.classes ?? []).map(value => [value.name, value]));
	const typeGroups = new Map(Object.entries(manifest.groups)
		.flatMap(([family, types]) => types.map(name => [name, family])));
	const occurrences = new Map();
	const parser = new LayoutParser();
	const fixtureErrors = [];
	const paths = FindLayoutFiles(join(root, "tests", "fixtures"));
	for (const file of paths) {
		const fixture = relative(root, file).replaceAll("\\", "/");
		try {
			const document = parser.Parse(readFileSync(file, "utf8"));
			if (!document.roots.length) {
				fixtureErrors.push({ file: fixture, reason: "no parsed root" });
				continue;
			}
			const local = new Map();
			ScanNodes(document.roots, name => local.set(name, (local.get(name) ?? 0) + 1));
			for (const [name, count] of local) {
				const current = occurrences.get(name) ?? { count: 0, fixtures: [] };
				current.count += count;
				current.fixtures.push(fixture);
				occurrences.set(name, current);
			}
		} catch (error) {
			fixtureErrors.push({ file: fixture, reason: String(error?.message ?? error) });
		}
	}
	const classes = catalog.map(name => {
		const fixture = occurrences.get(name);
		const record = manifest.evidence[name] ?? {};
		const native = nativeTypes.get(name);
		return {
			name,
			family: typeGroups.get(name),
			fixtureDeclarations: fixture?.count ?? 0,
			fixtureFiles: fixture?.fixtures.length ?? 0,
			fixtureExamples: fixture?.fixtures.slice(0, 3) ?? [],
			nativeCensusDeclarations: native?.count ?? null,
			nativeCensusLayouts: native?.layoutCount ?? null,
			parser: fixture ? "parsed-in-repository-fixture" : "generic-parser-unverified-for-type",
			geometry: AxisStatus(record, "geometry"),
			render: AxisStatus(record, "render"),
			interaction: AxisStatus(record, "interaction"),
			roundtrip: AxisStatus(record, "roundtrip"),
			nativeEvidence: record.native ?? [],
			pendingEvidence: record.pending ?? [],
			automatedTests: record.tests ?? {}
		};
	});
	const unexpectedLocal = [...occurrences].filter(([name]) => !catalog.includes(name))
		.map(([name, value]) => ({ name, occurrences: value.count, fixtureFiles: value.fixtures.length }))
		.sort((left, right) => left.name.localeCompare(right.name));
	const additionalNative = (census?.classes ?? []).filter(item => !catalog.includes(item.name));
	const summary = {
		cataloguedClasses: classes.length,
		repositoryLayoutFixtures: paths.length,
		fixtureParseFailures: fixtureErrors.length,
		classesExercisedByFixtures: classes.filter(item => item.fixtureFiles > 0).length,
		classesWithScopedNativeEvidence: classes.filter(item => item.nativeEvidence.length > 0).length,
		classesWithAutomatedEvidence: classes.filter(item =>
			Object.values(item.automatedTests).some(paths => paths.length > 0)).length,
		classesWithPendingNativeComparisons: classes.filter(item => item.pendingEvidence.length > 0).length,
		nativeCensusProvided: census !== null,
		nativeCensusSource: census?.source ?? (census ? "gui.pbo-readable-payloads" : null),
		nativeLayoutFiles: census?.layoutFiles ?? null,
		nativeParsedLayoutFiles: census?.parsedLayoutFiles ?? null,
		nativeParseFailures: census?.parseFailures ?? null,
		nativeIdlessWidgetDeclarations: census?.idlessWidgetDeclarations ?? null,
		skippedCompressedNativeLayouts: census?.skippedCompressedLayouts ?? null,
		unknownLocalClasses: unexpectedLocal.length,
		unknownNativeClasses: additionalNative.length,
		overallParityPercentage: null,
		overallParityReason: "Native render, behavior, editing and export acceptance are not exhaustive"
	};
	return {
		schemaVersion: 1,
		summary,
		classes,
		fixtureErrors,
		unexpectedLocal,
		additionalNative,
		crossCutting: manifest.crossCutting,
		limitations: manifest.notes,
		warning: census === null
			? "No native widget census supplied; occurrence-weighted prioritization unavailable"
			: (census.parseFailures > 0
				? "Native extraction has parse failures: do not treat the counts as complete"
				: "Census counts indicate usage, not rendering or editing compatibility")
	};
}

export function FormatNativeCompatibilityMarkdown(report) {
	const s = report.summary;
	const out = [
		"# NIH Layout Studio — Workbench compatibility baseline",
		"",
		"Evidence inventory only. This report does NOT certify full Workbench parity.",
		"",
		"## Evidence coverage",
		"",
		"- Catalogued Workbench widget classes: " + s.cataloguedClasses,
		"- Repository layout fixtures: " + s.repositoryLayoutFixtures,
		"- Fixture parse failures: " + s.fixtureParseFailures,
		"- Classes present in local fixtures: " + s.classesExercisedByFixtures,
		"- Classes with scoped native measurements: " + s.classesWithScopedNativeEvidence,
		"- Classes with capability-specific tests: " + s.classesWithAutomatedEvidence,
		"- Classes with pending native comparisons: " + s.classesWithPendingNativeComparisons,
		"- Native gui.pbo census provided: " + (s.nativeCensusProvided ? "yes" : "no"),
		"- Native census input: " + (s.nativeCensusSource ?? "none"),
		"- Native extracted layout parse failures: " + (s.nativeParseFailures ?? "not measured"),
		"- Native ID-less widget declarations: " + (s.nativeIdlessWidgetDeclarations ?? "not measured"),
		"- Overall parity percentage: NOT MEASURABLE",
		"",
		"## Widget-family matrix",
		"",
		"| Widget type | Family | Fixture files | Native declarations | Geometry | Rendering | Interaction | Round-trip |",
		"|---|---|---:|---:|---|---|---|---|"
	];
	for (const item of report.classes) {
		out.push("| " + item.name + " | " + item.family + " | " + item.fixtureFiles +
			" | " + (item.nativeCensusDeclarations ?? "—") +
			" | " + item.geometry + " | " + item.render + " | " +
			item.interaction + " | " + item.roundtrip + " |");
	}
	out.push("", "## What the statuses mean", "",
		"- scoped-native-measurement: one named native behavior is measured, not universal parity.",
		"- automated-evidence-only: a specific automated test exists, not necessarily visual fidelity.",
		"- native-comparison-pending: recorded tests await completion of native comparison.",
		"- not-demonstrated: no scoped acceptance evidence is catalogued.",
		"- Fixture parsing alone does not prove native rendering or round-trip compatibility.",
		"",
		"## Unresolved scope and priorities", "",
		"- Validate actual Workbench screenshots for typography, images, nested clipping, and mixed widget trees.",
		"- Test native interactions and full import/edit/export/reload workflows across multiple widget families.",
		"- Ingest an independent native widget census to prioritize by real layout frequency.",
		"- Do not infer a product completion percentage from test counts or source-code presence.", "",
		"## Scoped native evidence", "");
	for (const item of report.classes) {
		if (!item.nativeEvidence.length && !item.pendingEvidence.length)
			continue;
		out.push("**" + item.name + "**");
		for (const evidence of item.nativeEvidence)
			out.push("- " + evidence.area + " captured: " + evidence.scope + " — " + evidence.path);
		for (const evidence of item.pendingEvidence)
			out.push("- " + evidence.area + " pending: " + evidence.scope + " — " + evidence.path);
		out.push("");
	}
	if (report.additionalNative.length) {
		out.push("## Native census classes missing from catalog", "");
		for (const item of report.additionalNative)
			out.push("- " + item.name + ": " + item.count + " declarations");
	}
	return out.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	if (args.some(arg => arg !== "--json" && !arg.startsWith("--census="))
		|| args.filter(arg => arg.startsWith("--census=")).length > 1) {
		console.error("Usage: node scripts/Generate-NativeCompatibilityBaseline.mjs [--json] [--census=report.json]");
		process.exitCode = 2;
	} else {
		const path = args.find(arg => arg.startsWith("--census="));
		const census = path ? ReadJson(resolve(path.slice("--census=".length))) : null;
		const result = BuildNativeCompatibilityBaseline({ census });
		console.log(args.includes("--json")
			? JSON.stringify(result, null, 2)
			: FormatNativeCompatibilityMarkdown(result));
	}
}
