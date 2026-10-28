#!/usr/bin/env node
/**
 * Strict extractor for the isolated native Frame/Panel/Wrap property matrix.
 * The output is a direct record of native widget existence and measurements.
 * Never turn missing children into inferred geometry or a parity PASS.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX="[NIH_LayoutStudio][PropertyProbe]";
export const EXPECTED_PROPERTY_PHASES=["after-create","post-update","after-resize"];
export const EXPECTED_PROPERTY_CASES=[
	"PFrameNoFlag","PFrameFlagZero","PFrameFlagOne",
	"PFrameHorizontalOne","PFrameBothOne","PFrameTextOne",
	"PFrameClipped","PPanelNoFlag","PPanelFlagZero",
	"PPanelFlagOne","PPanelHorizontalOne","PWrapNoFlag",
	"PWrapFlagZero","PWrapFlagOne"
];

function Sizes(value, context) {
	const numbers=value.split(",").map(Number);
	if (numbers.length!==2 || numbers.some(n=>!Number.isFinite(n)||n<0))
		throw new Error("Invalid native size: "+context+" "+value);
	return {width:numbers[0],height:numbers[1]};
}

function NewPhase(name) {
	return {phase:name,complete:false,rootScreenSize:null,cases:{}};
}

export function ParseNativePropertyMatrix(log, sourceLog="unrecorded-client.log") {
	if(typeof log!=="string"||!log.trim())
		throw new Error("Empty native property-matrix log");
	const phases=[];
	const requests=[];
	let active=null;
	for(const line of log.split(/\r?\n/)) {
		const index=line.indexOf(PREFIX);
		if(index<0)
			continue;
		const message=line.slice(index+PREFIX.length).trim();
		if(!message)
			continue;
		if(message.startsWith("ERROR:"))
			throw new Error("Native property probe error: "+message);
		if(message.startsWith("REQUEST ")) {
			requests.push(message.slice(8));
			continue;
		}
		if(message.startsWith("BEGIN ")) {
			const phase=message.slice(6);
			if(active || !EXPECTED_PROPERTY_PHASES.includes(phase) ||
				phases.some(item=>item.phase===phase))
				throw new Error("Invalid native phase BEGIN: "+phase);
			active=NewPhase(phase);
			phases.push(active);
			continue;
		}
		if(message.startsWith("END ")) {
			if(!active || active.phase!==message.slice(4))
				throw new Error("Invalid native phase END: "+message);
			active.complete=true;
			active=null;
			continue;
		}
		let match=/^phase=(\S+) rootScreenSize=(\S+)$/.exec(message);
		if(match) {
			if(!active||match[1]!==active.phase||active.rootScreenSize)
				throw new Error("Unexpected or duplicate native root size");
			active.rootScreenSize=Sizes(match[2],active.phase);
			continue;
		}
		match=/^phase=(\S+) case=(\S+) parentPresent=([01]) childCount=(\d+) topFound=([01]) bottomFound=([01])$/.exec(message);
		if(match) {
			const [,phase,name,present,count,top,bottom]=match;
			if(!active||active.phase!==phase || !EXPECTED_PROPERTY_CASES.includes(name) ||
				active.cases[name])
				throw new Error("Unexpected or duplicate native case: "+name);
			const n=Number(count);
			if(!Number.isSafeInteger(n))
				throw new Error("Invalid native child count: "+name);
			active.cases[name]={
				parentPresent:present==="1",childCount:n,
				topFound:top==="1",bottomFound:bottom==="1",
				screenSize:null,localSize:null
			};
			continue;
		}
		match=/^phase=(\S+) case=(\S+) screenSize=(\S+) localSize=(\S+)$/.exec(message);
		if(match) {
			const [,phase,name,screen,local]=match;
			const entry=active?.cases[name];
			if(!active||active.phase!==phase||!entry || !entry.parentPresent
				||entry.screenSize)
				throw new Error("Unexpected or duplicate native case size: "+name);
			entry.screenSize=Sizes(screen,phase+"/"+name+"/screen");
			entry.localSize=Sizes(local,phase+"/"+name+"/local");
			continue;
		}
		throw new Error("Unknown native property-matrix record: "+message);
	}
	if(active)
		throw new Error("Unclosed native property-matrix phase: "+active.phase);
	if(phases.length!==EXPECTED_PROPERTY_PHASES.length ||
		phases.some((item,index)=>item.phase!==EXPECTED_PROPERTY_PHASES[index] || !item.complete))
		throw new Error("Missing, incomplete, or unordered property-matrix phases");
	for(const phase of phases) {
		if(!phase.rootScreenSize)
			throw new Error("Missing native root size: "+phase.phase);
		const names=Object.keys(phase.cases);
		if(names.length!==EXPECTED_PROPERTY_CASES.length ||
			EXPECTED_PROPERTY_CASES.some(name=>!Object.hasOwn(phase.cases,name)))
			throw new Error("Missing native matrix cases: "+phase.phase);
		for(const [name,entry] of Object.entries(phase.cases)) {
			if(entry.parentPresent!==Boolean(entry.screenSize) ||
				entry.parentPresent!==Boolean(entry.localSize))
				throw new Error("Missing native parent dimensions: "+phase.phase+"/"+name);
		}
	}
	return {
		schemaVersion:1,
		captureKind:"dayz-native-property-matrix-getters",
		status:"native-diagnostic-not-algorithm-parity",
		sourceLog,
		nativeClientBuild:null,
		expectedCaseCount:EXPECTED_PROPERTY_CASES.length,
		note:"Three complete native creation/update/resize phases. Widget presence, child counts and actual dimensions recorded; absent children never filled from authored layout.",
		requests,phases
	};
}

const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct) {
	if(process.argv.length<3||process.argv.length>4) {
		console.error("Usage: node scripts/extract-workbench-property-matrix.mjs <client-log> [output.json]");
		process.exitCode=2;
	} else {
		try {
			const input=process.argv[2];
			const result=ParseNativePropertyMatrix(readFileSync(input,"utf8"),input);
			const json=JSON.stringify(result,null,2)+"\n";
			if(process.argv[3]) {
				writeFileSync(process.argv[3],json,"utf8");
				console.log("Native property matrix written: "+process.argv[3]);
			} else {
				console.log(json);
			}
		} catch(error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode=1;
		}
	}
}
