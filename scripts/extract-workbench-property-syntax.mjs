#!/usr/bin/env node
/**
 * Exact native loader syntax capture. A null CreateWidgets result is an
 * observation, not a formatting error or reason to fabricate children.
 * This does not reconstruct the native C++ parser.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX="[NIH_LayoutStudio][SyntaxProbe]";
export const EXPECTED_SYNTAX_CASES=[
	"FrameBase","FrameContentBefore0","FrameContentAfter0",
	"FrameUnknownBefore0","FrameUnknownAfter0",
	"FrameClipBefore1","FrameClipAfter1",
	"PanelBase","PanelContentBefore0","PanelContentAfter0",
	"PanelUnknownBefore0","PanelUnknownAfter0"
];
export const EXPECTED_SYNTAX_PHASES=["after-create","post-update"];

function Size(raw, name) {
	const parts=raw.split(",").map(Number);
	if(parts.length!==2 || parts.some(v=>!Number.isFinite(v)||v<0))
		throw new Error("Malformed native syntax size: "+name+" "+raw);
	return {width:parts[0],height:parts[1]};
}

export function ParseNativePropertySyntax(log, sourceLog="unrecorded-client.log") {
	if(typeof log!=="string" || !log.trim())
		throw new Error("Empty property syntax client log");
	const cases={};
	let started=false;
	let finished=false;
	let sequence=0;
	for(const line of log.split(/\r?\n/)) {
		const index=line.indexOf(PREFIX);
		if(index<0)
			continue;
		const payload=line.slice(index+PREFIX.length).trim();
		if(payload.startsWith("ERROR:"))
			throw new Error("Native syntax probe error: "+payload);
		if(payload==="BEGIN") {
			if(started||finished)
				throw new Error("Duplicate native syntax BEGIN");
			started=true;
			continue;
		}
		if(payload==="END") {
			if(!started||finished)
				throw new Error("Unexpected native syntax END");
			finished=true;
			continue;
		}
		if(!started||finished)
			throw new Error("Native syntax observation outside BEGIN/END");
		let match=/^phase=(\S+) case=(\S+) rootPresent=([01]) parentPresent=([01]) childCount=(\d+) topFound=([01]) bottomFound=([01])$/.exec(payload);
		if(match) {
			const [,phase,id,root,parent,count,top,bottom]=match;
			const expectedCase=EXPECTED_SYNTAX_CASES[Math.floor(sequence/2)];
			const expectedPhase=EXPECTED_SYNTAX_PHASES[sequence%2];
			if(id!==expectedCase||phase!==expectedPhase)
				throw new Error("Unexpected, repeated, or out-of-order native syntax record: "+phase+"/"+id);
			const childCount=Number(count);
			if(!Number.isSafeInteger(childCount))
				throw new Error("Invalid native syntax child count: "+id);
			const rootPresent=root==="1";
			const parentPresent=parent==="1";
			const topFound=top==="1";
			const bottomFound=bottom==="1";
			if((!rootPresent&&(parentPresent||childCount||topFound||bottomFound))||
				(!parentPresent&&childCount!==0))
				throw new Error("Inconsistent native syntax hierarchy: "+id);
			if(!cases[id])
				cases[id]={};
			cases[id][phase]={
				rootPresent,parentPresent,childCount,topFound,bottomFound,
				screenSize:null,localSize:null
			};
			++sequence;
			continue;
		}
		match=/^phase=(\S+) case=(\S+) screenSize=(\S+) localSize=(\S+)$/.exec(payload);
		if(match) {
			const [,phase,id,screen,local]=match;
			const entry=cases[id]?.[phase];
			if(!entry||!entry.parentPresent||entry.screenSize)
				throw new Error("Unexpected or duplicate native syntax size: "+id+"/"+phase);
			entry.screenSize=Size(screen,id+"/screen");
			entry.localSize=Size(local,id+"/local");
			continue;
		}
		throw new Error("Unknown native syntax record: "+payload);
	}
	if(!started||!finished||sequence!==EXPECTED_SYNTAX_CASES.length*EXPECTED_SYNTAX_PHASES.length)
		throw new Error("Incomplete native syntax capture");
	for(const id of EXPECTED_SYNTAX_CASES) {
		const result=cases[id];
		for(const phase of EXPECTED_SYNTAX_PHASES) {
			const data=result?.[phase];
			if(!data||data.parentPresent!==Boolean(data.screenSize) ||
				data.parentPresent!==Boolean(data.localSize))
				throw new Error("Missing native syntax case dimensions: "+id+"/"+phase);
		}
	}
	return {
		schemaVersion:1,
		captureKind:"dayz-native-layout-property-syntax",
		status:"native-loader-syntax-diagnostic-not-cpp-parser-proof",
		sourceLog,
		nativeClientBuild:null,
		expectedCaseCount:EXPECTED_SYNTAX_CASES.length,
		notes:"Separate CreateWidgets resources for each case. Native widget existence, child count, lookups and sizes are independent observations; missing resources and child nodes are not filled from authored layouts.",
		cases
	};
}

const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct) {
	if(process.argv.length<3||process.argv.length>4) {
		console.error("Usage: node scripts/extract-workbench-property-syntax.mjs <client.log> [output.json]");
		process.exitCode=2;
	} else {
		try {
			const path=process.argv[2];
			const record=ParseNativePropertySyntax(readFileSync(path,"utf8"),path);
			const output=JSON.stringify(record,null,2)+"\n";
			if(process.argv[3]) {
				writeFileSync(process.argv[3],output,"utf8");
				console.log("Native syntax record written to "+process.argv[3]);
			} else {
				console.log(output);
			}
		} catch(error) {
			console.error(error instanceof Error?error.message:String(error));
			process.exitCode=1;
		}
	}
}
