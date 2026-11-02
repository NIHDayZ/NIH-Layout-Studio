#!/usr/bin/env node
/**
 * Offline source-round-trip preflight for extracted native DayZ .layout files.
 *
 * Parse -> Serialize -> Parse using Studio's production LayoutParser. This does
 * not write any layout file, does not validate DayZ's own loader/rendering, and
 * does not consider cosmetic formatting changes to be semantic failures.
 *
 * Native layout file bodies, author-assigned widget identifiers, and property
 * contents are NEVER included in the report.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, relative, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

function ReadJson(path) {
	return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function FindSelectedFiles(root, candidates) {
	if (!candidates || !Array.isArray(candidates.selected)
		|| candidates.selected.length === 0)
		throw new Error("Candidate report requires a nonempty selected array");
	const seen = new Set();
	return candidates.selected.map(item => {
		const filename = item?.path;
		if (typeof filename !== "string" || !filename.toLowerCase().endsWith(".layout")
			|| isAbsolute(filename) || filename.includes("\\")
			|| filename.split("/").some(part => part === ".." || part === "")) {
			throw new Error("Invalid candidate relative layout path");
		}
		const full = resolve(root, filename);
		if (!full.startsWith(root + sep))
			throw new Error("Candidate layout path escapes the extracted source directory");
		if (seen.has(full))
			throw new Error("Duplicate candidate layout path");
		seen.add(full);
		if (!existsSync(full) || !statSync(full).isFile())
			throw new Error("Candidate layout file not found: " + filename);
		return { relative: filename, full, role: typeof item.role === "string" ? item.role : "unspecified" };
	});
}

function SourceEvents(node) {
	const events = [];
	for (let index = 0; index < node.properties.length; ++index) {
		const property = node.properties[index];
		events.push({ line: property.line, ordinal: index, event: ["property", index] });
	}

	const children = [...node.children, ...(node.sourceAuxiliaryBlocks ?? [])];
	children.sort((left, right) => left.line - right.line);
	const groups = new Map();
	const ungrouped = [];
	for (const child of children) {
		const owned = child.sourceGroupParentId === node.id;
		if (!owned || !Number.isSafeInteger(child.sourceGroupLine) || child.sourceGroupLine <= 0) {
			ungrouped.push(child);
			continue;
		}
		const groupLine = child.sourceGroupLine;
		const group = groups.get(groupLine) ?? [];
		group.push(child);
		groups.set(groupLine, group);
	}
	let ordinal = node.properties.length;
	for (const [line, group] of groups) {
		events.push({ line, ordinal: ordinal++, event: [
			"child-group",
			group.map(child => [child.type, child.sourceHasNoIdentifier === true ? null : child.name])
		] });
	}
	if (ungrouped.length) {
		events.push({ line: Number.MAX_SAFE_INTEGER, ordinal, event: [
			"unresolved-group",
			ungrouped.map(child => [child.type, child.sourceHasNoIdentifier === true ? null : child.name])
		] });
	}
	events.sort((left, right) => left.line - right.line || left.ordinal - right.ordinal);
	return events.map(item => item.event);
}

function WidgetShape(node) {
	return {
		type: node.type,
		declarationIdentifier: node.sourceHasNoIdentifier === true ? null : node.name,
		properties: node.properties.map(item => [item.rawName, item.rawValue]),
		sourceOrder: SourceEvents(node),
		children: node.children.map(WidgetShape),
		auxiliaryBlocks: (node.sourceAuxiliaryBlocks ?? []).map(WidgetShape)
	};
}

function ShapeDocument(document) {
	return document.roots.map(WidgetShape);
}

function CountNodes(nodes, tally) {
	for (const node of nodes) {
		++tally.allDeclarations;
		if (node.type.endsWith("WidgetClass"))
			++tally.widgets;
		else
			++tally.auxiliary;
		if (node.sourceHasNoIdentifier === true)
			++tally.idless;
		tally.properties += node.properties.length;
		CountNodes(node.children, tally);
		CountNodes(node.sourceAuxiliaryBlocks ?? [], tally);
	}
}

function FirstDifferencePath(left, right, path = "roots") {
	if (isDeepStrictEqual(left, right))
		return null;
	if (typeof left !== typeof right || left === null || right === null)
		return path;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
			return path + ".length";
		for (let i = 0; i < left.length; ++i) {
			const mismatch = FirstDifferencePath(left[i], right[i], path + "[" + i + "]");
			if (mismatch)
				return mismatch;
		}
		return path;
	}
	if (typeof left === "object") {
		const keys = Object.keys(left);
		if (keys.length !== Object.keys(right).length)
			return path + ".keys";
		for (const key of keys) {
			if (!Object.hasOwn(right, key))
				return path + "." + key;
			const mismatch = FirstDifferencePath(left[key], right[key], path + "." + key);
			if (mismatch)
				return mismatch;
		}
	}
	return path;
}

export function CheckSourceRoundTrip(source) {
	const parser = new LayoutParser();
	const original = parser.Parse(source);
	if (!original.roots.length)
		return { status: "PARSE_FAILURE", reason: "no-root-declarations" };

	const before = ShapeDocument(original);
	const serialized = parser.Serialize(original);
	const reparsed = parser.Parse(serialized);
	const after = ShapeDocument(reparsed);

	const counts = { widgets: 0, auxiliary: 0, properties: 0, idless: 0, allDeclarations: 0 };
	CountNodes(original.roots, counts);

	const roundTripEqual = isDeepStrictEqual(before, after);
	const stableSecondSerialization = parser.Serialize(reparsed) === serialized;
	const result = {
		status: roundTripEqual && stableSecondSerialization
			? "SOURCE_ROUNDTRIP_PASS" : "SOURCE_ROUNDTRIP_FAIL",
		originalRootCount: original.roots.length,
		reparsedRootCount: reparsed.roots.length,
		...counts,
		semanticStructureEqual: roundTripEqual,
		serializationIdempotent: stableSecondSerialization,
		sourceByteIdentical: source === serialized,
		nativeWorkbenchLoadValidated: false
	};
	if (!roundTripEqual)
		result.firstDifferencePath = FirstDifferencePath(before, after);
	if (!stableSecondSerialization)
		result.nonIdempotentCanonicalWriter = true;
	return result;
}

export function PreflightNativeAcceptanceCorpus(root, candidates) {
	const directory = resolve(root);
	if (!existsSync(directory) || !statSync(directory).isDirectory())
		throw new Error("Expected the extracted native .layout directory");
	const selected = FindSelectedFiles(directory, candidates);
	const results = [];
	for (const item of selected) {
		try {
			const source = readFileSync(item.full, "utf8").replace(/^\uFEFF/, "");
			const result = CheckSourceRoundTrip(source);
			results.push({ role: item.role, path: item.relative, ...result });
		} catch (error) {
			results.push({
				role: item.role, path: item.relative, status: "PREFLIGHT_ERROR",
				reason: error instanceof Error ? error.name : "unknown-error",
				nativeWorkbenchLoadValidated: false
			});
		}
	}
	const passed = results.filter(item => item.status === "SOURCE_ROUNDTRIP_PASS").length;
	const failed = results.filter(item => item.status !== "SOURCE_ROUNDTRIP_PASS").length;
	return {
		schemaVersion: 1,
		status: failed === 0 ? "SOURCE_PREFLIGHT_PASS" : "SOURCE_PREFLIGHT_HAS_FAILURES",
		method: "parse -> canonical serialize -> parse; compare declaration identifiers, properties, child hierarchy, auxiliary blocks and source order",
		selectedFiles: selected.length,
		sourceRoundTripsPassed: passed,
		sourceRoundTripsFailed: failed,
		files: results,
		nativeWorkbenchLoadValidated: false,
		warning: "This preflight does not prove Workbench import, visual parity, editor changes, or native round-trip compatibility. Source files are not modified."
	};
}

export function FormatSourcePreflight(report) {
	const lines = [
		"# NIH Layout Studio — original vanilla layout source round-trip preflight",
		"",
		"Offline source-level check only; NOT native Workbench import/export certification.",
		"",
		"Status: " + report.status,
		"Source round-trips: " + report.sourceRoundTripsPassed + " passed; " +
			report.sourceRoundTripsFailed + " failed",
		"",
		"| Role | Layout | Widgets | Properties | ID-less | Round-trip |",
		"|---|---|---:|---:|---:|---|"
	];
	for (const item of report.files) {
		const filename = item.path.replaceAll("|", "\\|");
		lines.push("| " + item.role + " | " + filename + " | " +
			(item.widgets ?? "—") + " | " + (item.properties ?? "—") + " | " +
			(item.idless ?? "—") + " | " + item.status + " |");
		if (item.firstDifferencePath)
			lines.push("- First divergence for " + filename + ": " + item.firstDifferencePath);
	}
	lines.push("", report.warning);
	return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const rootArgs = args.filter(arg => !arg.startsWith("--"));
	const candidateArgs = args.filter(arg => arg.startsWith("--candidates="));
	const allowed = arg => arg === "--json" || arg.startsWith("--candidates=");
	if (rootArgs.length !== 1 || candidateArgs.length !== 1
		|| args.some(arg => arg.startsWith("--") && !allowed(arg))) {
		console.error("Usage: node scripts/Preflight-NativeAcceptanceCorpus.mjs <extracted-gui-directory> --candidates=selected.json [--json]");
		process.exitCode = 2;
	} else {
		try {
			const candidates = ReadJson(resolve(candidateArgs[0].slice("--candidates=".length)));
			const report = PreflightNativeAcceptanceCorpus(rootArgs[0], candidates);
			console.log(args.includes("--json")
				? JSON.stringify(report, null, 2) : FormatSourcePreflight(report));
			if (report.sourceRoundTripsFailed > 0)
				process.exitCode = 1;
		} catch (error) {
			console.error("Source preflight failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
