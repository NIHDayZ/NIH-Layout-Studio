#!/usr/bin/env node
/**
 * Analyze extracted DayZ .layout sources with NIH Layout Studio's real parser.
 * Only aggregate widget counts, parse failures and relative fixture names are output.
 * Source layout bodies and authored widget identifiers are never serialized.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

function FindLayouts(root) {
	const files = [];
	function Walk(folder) {
		for (const entry of readdirSync(folder, { withFileTypes: true })) {
			const path = join(folder, entry.name);
			if (entry.isDirectory())
				Walk(path);
			else if (entry.isFile() && entry.name.toLowerCase().endsWith(".layout"))
				files.push(path);
		}
	}
	Walk(root);
	return files.sort();
}

function CountWidgets(nodes, counts, seenInFile, stats) {
	for (const node of nodes) {
		if (node.type.endsWith("WidgetClass")) {
			counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
			seenInFile.add(node.type);
			++stats.widgetDeclarations;
			if (node.sourceHasNoIdentifier === true)
				++stats.idlessWidgetDeclarations;
		}
		CountWidgets(node.children, counts, seenInFile, stats);
		// Auxiliary non-widget blocks are source metadata, not rendered children.
	}
}

export function CensusExtractedLayouts(root, options = {}) {
	const directory = resolve(root);
	if (!existsSync(directory) || !statSync(directory).isDirectory())
		throw new Error("Expected a directory of extracted DayZ .layout files");
	const paths = FindLayouts(directory);
	if (paths.length === 0)
		throw new Error("No .layout files found under the supplied directory");
	const parser = new LayoutParser();
	const totals = { widgetDeclarations: 0, idlessWidgetDeclarations: 0 };
	const counts = new Map();
	const layouts = new Map();
	const examples = new Map();
	const failures = [];
	let countedLayoutFiles = 0;
	for (const path of paths) {
		const file = relative(directory, path).replaceAll("\\", "/");
		try {
			const parsed = parser.Parse(readFileSync(path, "utf8"));
			if (!parsed.roots.length)
				throw new Error("No parseable root declaration");
			const typesInFile = new Set();
			CountWidgets(parsed.roots, counts, typesInFile, totals);
			for (const type of typesInFile) {
				layouts.set(type, (layouts.get(type) ?? 0) + 1);
				const seen = examples.get(type) ?? [];
				if (seen.length < 3)
					seen.push(file);
				examples.set(type, seen);
			}
			++countedLayoutFiles;
		} catch (error) {
			failures.push({ file, reason: String(error?.message ?? error) });
		}
	}
	const classes = [...counts.entries()].map(([name, count]) => ({
		name, count, layoutCount: layouts.get(name) ?? 0,
		examples: examples.get(name) ?? []
	})).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
	return {
		source: "local-extracted-layouts",
		layoutFiles: paths.length,
		parsedLayoutFiles: countedLayoutFiles,
		parseFailures: failures.length,
		failures: failures.slice(0, options.maxFailures ?? 50),
		widgetDeclarations: totals.widgetDeclarations,
		idlessWidgetDeclarations: totals.idlessWidgetDeclarations,
		distinctClasses: classes.length,
		skippedCompressedLayouts: 0,
		classes,
		warning: "Counts cover extracted readable layout files only; missing or failed extraction is not represented."
	};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const root = args.find(arg => arg !== "--json");
	if (!root || args.some(arg => arg !== "--json" && arg !== root)) {
		console.error("Usage: node scripts/Census-ExtractedNativeLayouts.mjs <layout-folder> [--json]");
		process.exitCode = 2;
	} else {
		try {
			const result = CensusExtractedLayouts(root);
			if (args.includes("--json"))
				console.log(JSON.stringify(result, null, 2));
			else {
				console.log("Layouts: " + result.layoutFiles + "; parsed: " + result.parsedLayoutFiles +
					"; widget declarations: " + result.widgetDeclarations + "; ID-less: " + result.idlessWidgetDeclarations);
				for (const item of result.classes)
					console.log(item.name.padEnd(43) + String(item.count).padStart(8) + " " + String(item.layoutCount).padStart(8));
			}
		} catch (error) {
			console.error("Native layout census failed: " + String(error?.message ?? error));
			process.exitCode = 1;
		}
	}
}
