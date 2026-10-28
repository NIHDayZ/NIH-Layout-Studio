import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	NativeCompatibilityWarnings,
	NativeCompatibilityReview
} from "../.geometry-engine-test-build/NativeCompatibilityWarnings.js";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { InspectNativePropertyCompatibility } from "../.geometry-engine-test-build/NativePropertyCompatibility.js";
import { readFileSync } from "node:fs";

function Warnings(name) {
	const source=readFileSync(new URL(
		"./fixtures/workbench-content/syntax-matrix/"+name+".layout",
		import.meta.url
	),"utf8");
	const roots=new LayoutParser().Parse(source).roots;
	return InspectNativePropertyCompatibility(roots);
}

test("Problems UI shows evidence-backed source-order risk and actual widget name, not a fabricated C++ error",()=>{
	const warnings=Warnings("FrameContentAfter0");
	assert.equal(warnings.length,1);
	const markup=renderToStaticMarkup(createElement(NativeCompatibilityWarnings,{warnings}));
	assert.ok(markup.includes("FrameContentAfter0"),markup);
	assert.ok(markup.includes("Size To Content V"),markup);
	assert.ok(markup.includes("Re-export can change native loader behavior"),markup);
	assert.ok(markup.includes("DayZ native client fixture"),markup);
	assert.ok(!markup.includes("undefined"),markup);
	assert.ok(!markup.includes("Delete children"),markup);
});

test("native export review provides a distinct Cancel and explicit Continue Export choice with preserved-source notice",()=>{
	const warnings=Warnings("PanelUnknownBefore0");
	const markup=renderToStaticMarkup(createElement(NativeCompatibilityReview,{
		actionLabel:"Export",warnings,onCancel:()=>{},onContinue:()=>{}
	}));
	assert.ok(markup.includes('role="dialog"'),markup);
	assert.ok(markup.includes('aria-modal="true"'),markup);
	assert.ok(markup.includes("Cancel"),markup);
	assert.ok(markup.includes("Continue Export"),markup);
	assert.ok(markup.includes("current source unchanged"),markup);
	assert.ok(markup.includes("PanelUnknownBefore0"),markup);
});

test("review changes only its action label for local Save, without claiming a silent repair",()=>{
	const markup=renderToStaticMarkup(createElement(NativeCompatibilityReview,{
		actionLabel:"Save",warnings:Warnings("FrameContentBefore0"),
		onCancel:()=>{},onContinue:()=>{}
	}));
	assert.ok(markup.includes("Continue Save"),markup);
	assert.ok(markup.includes("nothing is repaired or removed automatically"),markup);
});

test("no findings produces no warning list, and long lists are capped without mutating items",()=>{
	assert.equal(renderToStaticMarkup(createElement(NativeCompatibilityWarnings,{warnings:[]})),"");
	const warnings=Warnings("FrameContentBefore0");
	const before=JSON.stringify(warnings);
	const list=Array.from({length:15},()=>warnings[0]);
	const markup=renderToStaticMarkup(createElement(NativeCompatibilityWarnings,{
		warnings:list,limit:2
	}));
	assert.ok(markup.includes("13 additional finding(s)"),markup);
	assert.equal((markup.match(/class="native-compatibility-entry warning"/g)||[]).length,2);
	assert.equal(JSON.stringify(warnings),before);
});
