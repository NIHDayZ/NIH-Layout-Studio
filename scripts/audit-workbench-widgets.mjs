#!/usr/bin/env node
/**
 * Non-executing census of DayZ Workbench resources.
 *
 * Usage:
 *   node scripts/audit-workbench-widgets.mjs "<path>/gui.pbo" ["<path>/WorkbenchApp.exe"] [--json]
 *
 * Reports declarations, not rendering parity. Does not unpack or commit
 * copyrighted GUI resources. RTTI strings are candidates, not verified vtables.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function ReadString(buffer, state) {
	const end = buffer.indexOf(0, state.offset);
	if (end < 0)
		throw new Error("Unterminated PBO header string");
	const value = buffer.toString("utf8", state.offset, end);
	state.offset = end + 1;
	return value;
}

export function CensusPboWidgets(buffer) {
	const state = { offset: 0 };
	const entries = [];
	while (state.offset < buffer.length) {
		const name = ReadString(buffer, state);
		if (state.offset + 20 > buffer.length)
			throw new Error("Truncated PBO header");
		const method = buffer.readUInt32LE(state.offset);
		const size = buffer.readUInt32LE(state.offset + 16);
		state.offset += 20;
		if (!name) {
			if (method === 0x56657273) {
				// BIS extended-header metadata: NUL-terminated key/value pairs.
				while (true) {
					const key = ReadString(buffer, state);
					if (!key)
						break;
					ReadString(buffer, state);
				}
				continue;
			}
			break;
		}
		entries.push({ name, method, size });
	}
	const counts = new Map();
	const layoutCounts = new Map();
	const examples = new Map();
	let layoutFiles = 0;
	let widgetDeclarations = 0;
	let skippedCompressedLayouts = 0;
	for (const entry of entries) {
		if (state.offset + entry.size > buffer.length)
			throw new Error("PBO payload extends beyond file");
		const start = state.offset;
		state.offset += entry.size;
		if (!entry.name.toLowerCase().endsWith(".layout"))
			continue;
		++layoutFiles;
		if (entry.method !== 0) {
			++skippedCompressedLayouts;
			continue;
		}
		const source = buffer.toString("utf8", start, state.offset);
		const seen = new Set();
		const pattern = /^\s*([A-Za-z][A-Za-z0-9_]*)\s+(?:"[^"]+"|[^\s{}]+)\s*\{/gm;
		for (const match of source.matchAll(pattern)) {
			const type = match[1];
			if (!type.endsWith("WidgetClass"))
				continue;
			counts.set(type, (counts.get(type) ?? 0) + 1);
			++widgetDeclarations;
			seen.add(type);
			const samples = examples.get(type) ?? [];
			if (samples.length < 3)
				samples.push(entry.name.replaceAll("\\", "/"));
			examples.set(type, samples);
		}
		for (const type of seen)
			layoutCounts.set(type, (layoutCounts.get(type) ?? 0) + 1);
	}
	const classes = Array.from(counts, ([name, count]) => ({
		name, count, layoutCount: layoutCounts.get(name) ?? 0,
		examples: examples.get(name) ?? []
	})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	return { layoutFiles, widgetDeclarations, distinctClasses: classes.length, skippedCompressedLayouts, classes };
}

export function CandidateWidgetRttiNames(buffer) {
	// RTTI string presence alone does not establish a native class hierarchy
	// or validate a virtual-table address.
	const names = new Set();
	const source = buffer.toString("latin1");
	for (const match of source.matchAll(/\.\?AV([A-Za-z0-9_@]+)@@/g)) {
		if (match[1].includes("Widget"))
			names.add(match[1]);
	}
	return [...names].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const paths = args.filter((arg) => arg !== "--json");
	if (!paths.length || paths.length > 2) {
		console.error("Usage: node scripts/audit-workbench-widgets.mjs <gui.pbo> [WorkbenchApp.exe] [--json]");
		process.exitCode = 2;
	} else {
		const result = CensusPboWidgets(readFileSync(paths[0]));
		if (paths[1])
			result.rttiCandidates = CandidateWidgetRttiNames(readFileSync(paths[1]));
		if (args.includes("--json"))
			console.log(JSON.stringify(result, null, 2));
		else {
			console.log(`Layouts: ${result.layoutFiles}; widget declarations: ${result.widgetDeclarations}; distinct classes: ${result.distinctClasses}`);
			console.log("Class                                    Occurrences  Layouts");
			for (const item of result.classes)
				console.log(`${item.name.padEnd(41)}${String(item.count).padStart(8)}  ${String(item.layoutCount).padStart(7)}`);
			if (result.rttiCandidates)
				console.log(`Candidate Widget RTTI names (not proven native behavior): ${result.rttiCandidates.length}`);
		}
	}
}
