#!/usr/bin/env node
/**
 * Extract native getter facts from a DayZ ContentProbe client log.
 * This parser never infers font/image intrinsic dimensions from widget size
 * or converts a complete capture into a native geometry-parity PASS.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "[NIH_LayoutStudio][ContentProbe]";
const RECT_FIELDS = ["x", "y", "width", "height"];
export const EXPECTED_CONTENT_PHASES = [
	"baseline-1120x460", "short-text-1120x460",
	"restored-1120x460", "baseline-720x460"
];

function ReadNumbers(raw, count, context) {
	const values = raw.split(",").map(Number);
	if (values.length !== count || values.some(value => !Number.isFinite(value)))
		throw new Error("Malformed native getter in " + context + ": " + raw);
	return values;
}

function Rect(raw, context) {
	const values = ReadNumbers(raw, 4, context);
	return Object.fromEntries(RECT_FIELDS.map((field, i) => [field, values[i]]));
}

function Case(phase) {
	return { phase, complete: false, widgets: {}, requests: [] };
}

function RejectDuplicate(widget, key, phase, name) {
	if (widget[key] !== undefined)
		throw new Error("Duplicate " + key + " for " + phase + "/" + name);
}

/**
 * Accept the full client log or the user's filtered ContentProbe lines.
 * Every phase needs paired BEGIN/END and each widget a native screen and
 * local record; text widgets additionally require GetTextSize pixels.
 */
export function ParseNativeContentProbe(log, sourceName = "unrecorded-log") {
	if (typeof log !== "string" || !log.trim())
		throw new Error("Empty native content log");
	const cases = [];
	const byPhase = new Map();
	const globalRequests = [];
	let current = null;

	for (const line of log.split(/\r?\n/)) {
		const marker = line.indexOf(PREFIX);
		if (marker < 0)
			continue;
		const data = line.slice(marker + PREFIX.length).trim();
		if (data.startsWith("ERROR:"))
			throw new Error("DayZ probe error: " + data);

		if (data.startsWith("REQUEST ")) {
			if (current)
				current.requests.push(data.slice(8));
			else
				globalRequests.push(data.slice(8));
			continue;
		}
		if (data.startsWith("BEGIN ")) {
			const phase = data.slice(6);
			if (!EXPECTED_CONTENT_PHASES.includes(phase) || byPhase.has(phase) || current)
				throw new Error("Unexpected, duplicate, or overlapping content capture: " + phase);
			current = Case(phase);
			byPhase.set(phase, current);
			cases.push(current);
			continue;
		}
		if (data.startsWith("END ")) {
			const phase = data.slice(4);
			if (!current || current.phase !== phase)
				throw new Error("Unexpected native capture END: " + phase);
			current.complete = true;
			current = null;
			continue;
		}
		const sample = /^phase=(\S+) name=(\S+) (.*)$/.exec(data);
		if (!sample)
			throw new Error("Unknown native ContentProbe record: " + data);
		const [, phase, name, payload] = sample;
		if (!current || current.phase !== phase)
			throw new Error("Native getter outside active phase: " + phase + "/" + name);
		let widget = current.widgets[name];
		if (!widget) {
			widget = {};
			current.widgets[name] = widget;
		}
		let match = /^type=(\S+) screenRect=(\S+)$/.exec(payload);
		if (match) {
			RejectDuplicate(widget, "screenRect", phase, name);
			widget.type = match[1];
			widget.screenRect = Rect(match[2], phase + "/" + name + "/screenRect");
			continue;
		}
		match = /^localRect=(\S+) flags=(-?\d+) selfVisible=([01])$/.exec(payload);
		if (match) {
			RejectDuplicate(widget, "localRect", phase, name);
			widget.localRect = Rect(match[1], phase + "/" + name + "/localRect");
			widget.flags = Number(match[2]);
			widget.selfVisible = match[3] === "1";
			continue;
		}
		match = /^textPixels=(\S+)$/.exec(payload);
		if (match) {
			RejectDuplicate(widget, "textPixels", phase, name);
			const [width, height] = ReadNumbers(match[1], 2, phase + "/" + name + "/textPixels");
			if (width < 0 || height < 0)
				throw new Error("Negative native text pixel size: " + phase + "/" + name);
			widget.textPixels = {width, height};
			continue;
		}
		throw new Error("Unknown native getter: " + payload);
	}
	if (current)
		throw new Error("Unclosed native content capture: " + current.phase);
	if (cases.length !== EXPECTED_CONTENT_PHASES.length ||
		cases.some((item, index) => item.phase !== EXPECTED_CONTENT_PHASES[index] || !item.complete))
		throw new Error("Missing or unordered native capture phases");

	const baseline = Object.keys(cases[0].widgets).sort();
	if (!baseline.length || !baseline.includes("NIHContentParity"))
		throw new Error("Missing native fixture root");
	for (const item of cases) {
		const names = Object.keys(item.widgets).sort();
		if (names.length !== baseline.length || names.some((name, i) => name !== baseline[i]))
			throw new Error("Missing or extra widget records in " + item.phase);
		for (const [name, widget] of Object.entries(item.widgets)) {
			if (!widget.screenRect || !widget.localRect ||
				(widget.type === "TextWidget" && !widget.textPixels))
				throw new Error("Incomplete native getter records: " + item.phase + "/" + name);
		}
	}

	return {
		schemaVersion: 1,
		captureKind: "native-dayz-client-text-image-content-getters",
		sourceLog: sourceName,
		nativeClientBuild: null,
		status: "captured-unversioned-not-native-parity",
		notes: "GetTextSize reports native pixel metrics; screenRect reports widget bounds. ImageWidget screen rectangles are not evidence of imageset intrinsic dimensions. No native clipping or DPI branch measured.",
		requests: globalRequests,
		cases
	};
}

const directly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directly) {
	if (process.argv.length < 3 || process.argv.length > 4) {
		console.error("Usage: node scripts/extract-workbench-content.mjs <client-script.log> [output.json]");
		process.exitCode = 2;
	} else {
		try {
			const input = process.argv[2];
			const report = ParseNativeContentProbe(readFileSync(input, "utf8"), input);
			const serialized = JSON.stringify(report, null, 2) + "\n";
			if (process.argv[3]) {
				writeFileSync(process.argv[3], serialized, "utf8");
				console.log("Native getter record written to " + process.argv[3]);
			} else {
				console.log(serialized);
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
