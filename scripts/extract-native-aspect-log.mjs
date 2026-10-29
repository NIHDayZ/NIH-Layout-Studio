#!/usr/bin/env node
/**
 * Turn a completed native DayZ AspectProbe log into independent comparator data.
 * Do not infer observed values, root sizes or native build from Studio predictions.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "NIHNativeAspectParity";
const PHASES = ["root-960x500-origin", "root-1280x720-offset"];
const CHILDREN = new Set([
	"Parent_Mode0", "Parent_Mode1", "Parent_Mode2", "Parent_Mode3",
	"Fill_Mode0", "Text_Mode1", "Image_Mode2", "Button_Mode3", "ExactWidthBypass"
]);
const PREFIX = "[NIH_LayoutStudio][AspectProbe] ";
const BUILD_PLACEHOLDER = /^(unknown|unrecorded|not[ _-]?captured|pending|mock|test[- _]?only|\.{3}|\?+)$/i;

function ParseRect(raw, label) {
	const values = raw.split(",").map(v => Number(v.trim()));
	if (values.length !== 4 || values.some(v => !Number.isFinite(v)) ||
		values[2] <= 0 || values[3] <= 0) {
		throw new Error("Invalid native rectangle: " + label + " (" + raw + ")");
	}
	return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

export function ExtractNativeAspectLog(rawLog, nativeBuild, evidenceFile) {
	if (typeof nativeBuild !== "string" || !nativeBuild.trim() ||
		BUILD_PLACEHOLDER.test(nativeBuild.trim())) {
		throw new Error("Actual DayZ client build/version must be provided; placeholder is not provenance");
	}
	if (typeof evidenceFile !== "string" || !evidenceFile.trim())
		throw new Error("Original client log filename must be retained as evidence");

	const completed = new Map();
	let active = null;
	for (const line of rawLog.split(/\r?\n/)) {
		const index = line.indexOf(PREFIX);
		if (index === -1)
			continue;
		const payload = line.slice(index + PREFIX.length).trim();
		if (payload.startsWith("ERROR:"))
			throw new Error("Native probe error: " + payload);
		const begin = /^BEGIN ([\w-]+)$/.exec(payload);
		if (begin) {
			if (active)
				throw new Error("Nested native capture phases");
			if (!PHASES.includes(begin[1]) || completed.has(begin[1]))
				throw new Error("Unexpected or duplicate native capture phase: " + begin[1]);
			active = { id: begin[1], nodes: new Map() };
			continue;
		}
		const end = /^END ([\w-]+)$/.exec(payload);
		if (end) {
			if (!active || active.id !== end[1])
				throw new Error("Unmatched native capture END: " + end[1]);
			completed.set(active.id, active.nodes);
			active = null;
			continue;
		}
		const record = /^phase=([\w-]+) name=(\S+) type=(\S+) screenRect=([^\s]+)$/.exec(payload);
		if (!record)
			continue;
		if (!active || record[1] !== active.id)
			throw new Error("Native screen rectangle outside matching capture phase");
		if (active.nodes.has(record[2]))
			throw new Error("Duplicate native screen rectangle for " + active.id + "/" + record[2]);
		active.nodes.set(record[2], ParseRect(record[4], active.id + "/" + record[2]));
	}
	if (active)
		throw new Error("Incomplete native capture phase: " + active.id);
	if (completed.size !== PHASES.length)
		throw new Error("Expected both completed native capture phases");

	const cases = [];
	for (const id of PHASES) {
		const nodes = completed.get(id);
		if (!nodes || !nodes.has(ROOT))
			throw new Error("Missing independently observed root screen rectangle: " + id);
		const observed = {};
		for (const name of CHILDREN) {
			if (!nodes.has(name))
				throw new Error("Missing independently observed descendant: " + id + "/" + name);
			observed[name] = nodes.get(name);
		}
		if (nodes.size !== CHILDREN.size + 1)
			throw new Error("Native capture contains unexpected widgets: " + id);
		cases.push({
			id,
			viewport: nodes.get(ROOT),
			tolerance: 0.5,
			observed,
			provenance: {
				captureMethod: "dayz-client-script-getters",
				nativeBuild: nativeBuild.trim(),
				evidenceFile,
				viewportSource: ROOT + " native GetScreenPos/GetScreenSize after SetScreenSize"
			}
		});
	}
	return {
		schemaVersion: 1,
		captureKind: "native-dayz-client-fixaspect",
		sourceLayout: "tests/fixtures/native-aspect/NIH_NativeAspect_Parity.layout",
		rootName: ROOT,
		cases
	};
}

const directly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directly) {
	const [logPath, nativeBuild, outputPath] = process.argv.slice(2);
	if (!logPath || !nativeBuild || !outputPath) {
		console.error("Usage: node scripts/extract-native-aspect-log.mjs <client-script.log> <actual-client-build> <output.json>");
		process.exitCode = 2;
	} else {
		try {
			const report = ExtractNativeAspectLog(readFileSync(logPath, "utf8"), nativeBuild, basename(logPath));
			writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
			console.log("Extracted native-only rectangles: " + report.cases.map(c =>
				c.id + " (" + Object.keys(c.observed).length + " descendants)").join(", "));
			console.log("Wrote " + outputPath + "; preserve original log as evidence");
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
