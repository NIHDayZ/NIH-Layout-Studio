/**
 * Executes NIH Layout Studio's actual TypeScript parser against private DayZ
 * source files. Never prints or writes complete source. No third-party assets
 * are bundled with the public repository.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";

async function* Walk(folder) {
	for (const entry of await readdir(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory())
			yield* Walk(full);
		else if (entry.isFile() && entry.name.toLowerCase().endsWith(".layout"))
			yield full;
	}
}

function Descendants(nodes, parentPath = "") {
	const out = [];
	for (const node of nodes) {
		const current = parentPath + "/" + node.type;
		const isWidget = node.type.toLowerCase().includes("widgetclass");
		out.push({ type: node.type, path: current, idless: node.sourceHasNoIdentifier === true, isWidget, sourceLine: node.line });
		out.push(...Descendants(node.children, current));
		out.push(...Descendants(node.sourceAuxiliaryBlocks ?? [], current));
	}
	return out;
}

function FirstMismatch(a, b, path = "roots") {
	if (Object.is(a, b))
		return null;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
			return path;
		for (let i = 0; i < a.length; ++i) {
			const diff = FirstMismatch(a[i], b[i], path + "[" + i + "]");
			if (diff)
				return diff;
		}
		return null;
	}
	if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
		for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
			if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key))
				return path + "." + key;
			const diff = FirstMismatch(a[key], b[key], path + "." + key);
			if (diff)
				return diff;
		}
		return null;
	}
	return path;
}

const args = process.argv.slice(2);
const expectArg = args.find(x => x.startsWith("--expect-files="));
const expectedFiles = expectArg ? Number(expectArg.slice("--expect-files=".length)) : null;
const folders = args.filter(x => !x.startsWith("--"));
if (folders.length === 0 || (expectedFiles !== null && (!Number.isSafeInteger(expectedFiles) || expectedFiles < 1))) {
	console.error("Usage: npm run test:layout-corpus -- <extracted-dir> [more dirs...] [--expect-files=333]");
	process.exit(2);
}

const totals = {
	files: 0, roots: 0, widgetDeclarations: 0, auxiliaryDeclarations: 0,
	idlessWidgets: 0, mismatchedTrees: 0, missingAuxiliary: 0,
	sourceMutations: 0, failures: 0
};
const failures = [];
for (const folder of folders) {
	for await (const filename of Walk(folder)) {
		++totals.files;
		try {
			const original = await readFile(filename, "utf8");
			const parser = new LayoutParser();
			const document = parser.Parse(original);
			const entries = Descendants(document.roots);
			const widgets = entries.filter(entry => entry.isWidget);
			const metadata = entries.filter(entry => !entry.isWidget);
			totals.roots += document.roots.length;
			totals.widgetDeclarations += widgets.length;
			totals.auxiliaryDeclarations += metadata.length;
			totals.idlessWidgets += widgets.filter(entry => entry.idless).length;

			if (document.source !== original) {
				++totals.sourceMutations;
				throw new Error("Parser source differs from input");
			}
			if (document.roots.length !== 1)
				throw new Error("Expected exactly one root; observed " + document.roots.length);
			// All metadata must stay outside geometry's node.children arrays.
			function VerifyWidgetSlots(nodes) {
				for (const node of nodes) {
					if (node.children.some(child => !child.type.toLowerCase().includes("widgetclass")))
						throw new Error("Non-widget declaration occupies widget child slot");
					VerifyWidgetSlots(node.children);
					VerifyWidgetSlots(node.sourceAuxiliaryBlocks ?? []);
				}
			}
			VerifyWidgetSlots(document.roots);
			const canonical = parser.Serialize(document);
			const roundDocument = new LayoutParser().Parse(canonical);
			const round = Descendants(roundDocument.roots);
			if (widgets.length !== round.filter(entry => entry.isWidget).length ||
				metadata.length !== round.filter(entry => !entry.isWidget).length ||
				document.roots.length !== roundDocument.roots.length) {
				++totals.mismatchedTrees;
				throw new Error("Parse/serialize changed widget or metadata counts");
			}
			if (metadata.length && !canonical.includes("ScriptParamsClass")) {
				++totals.missingAuxiliary;
				throw new Error("Canonical export lost script metadata");
			}
			const normalized = new LayoutParser().Serialize(roundDocument);
			if (normalized !== canonical)
				throw new Error("Canonical export is not stable after second parse");
			// Check that each class declaration survives in original ordering.
			const order = items => items.slice().sort((a,b) => a.sourceLine - b.sourceLine).map(x => x.type).join("|");
			if (order(entries) !== order(round))
				throw new Error("Canonical export reordered class declarations");
			// Preserve authored declaration identifiers including duplicate IDs,
			// and preserve exact property names and values through the AST.
			function Shape(nodes) {
				return nodes.map(node => ({
					type: node.type,
					idless: node.sourceHasNoIdentifier === true,
					// Source-line-based UI labels are not authored identifiers.
					name: node.sourceHasNoIdentifier ? (node.properties.find(p => p.name.toLowerCase() === "name")?.value ?? null) : node.name,
					properties: node.properties.map(p => [p.rawName, p.rawValue]),
					sequence: [...node.children, ...(node.sourceAuxiliaryBlocks ?? [])]
						.sort((a,b) => a.line - b.line).map(child => child.type),
					widgets: Shape(node.children),
					metadata: Shape(node.sourceAuxiliaryBlocks ?? [])
				}));
			}
			const diff = FirstMismatch(Shape(document.roots), Shape(roundDocument.roots));
			if (diff) {
				++totals.mismatchedTrees;
				throw new Error("Canonical export changed hierarchy, authored identifiers or properties at " + diff);
			}
		} catch (error) {
			++totals.failures;
			if (failures.length < 50)
				failures.push({ file: filename, error: String(error) });
		}
	}
}
if (expectedFiles !== null && totals.files !== expectedFiles) {
	++totals.failures;
	failures.push({ error: "Incomplete corpus", expectedFiles, actualFiles: totals.files });
}
console.log(JSON.stringify({ totals, failures, omittedFailures: Math.max(0, totals.failures - failures.length) }, null, 2));
if (totals.files === 0 || totals.failures)
	process.exitCode = 1;
