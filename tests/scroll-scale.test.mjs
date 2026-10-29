import test from "node:test";
import assert from "node:assert/strict";
import {
	DecodeNativeScrollSettings,
	EstimateUnscaledScrollViewport,
	EstimateContextScaledScrollViewport
} from "../.geometry-engine-test-build/ScrollSettings.js";

const viewport = { width: 100, height: 60 };
const bothLeft = { horizontal: true, vertical: true, verticalLeft: true };

test("unscaled and explicit native context paths share identical viewport reservations at ratio one", () => {
	const unscaled = EstimateUnscaledScrollViewport(viewport, bothLeft, 1);
	const scaled = EstimateContextScaledScrollViewport(viewport, bothLeft, {
		numerator: 100, denominator: 100
	});
	assert.equal(unscaled.scrollbarThickness, 10);
	assert.equal(scaled.scrollbarThickness, 10);
	assert.deepEqual(scaled.childViewport, unscaled.childViewport);
	assert.equal(scaled.evidence, "native-derived-context-scaled-scroll-viewport");
});

test("explicit native context reproduces SSE float32 ratio thickness without assuming DPI", () => {
	const measured = EstimateContextScaledScrollViewport(viewport, bothLeft, {
		numerator: 125, denominator: 100
	});
	assert.deepEqual(measured.childViewport, { x: 12.5, y: 0, width: 87.5, height: 47.5 });
	assert.equal(measured.scrollbarThickness, 12.5);
	const fractional = EstimateContextScaledScrollViewport(viewport, bothLeft, {
		numerator: 7, denominator: 3
	});
	const expected = Math.fround(Math.fround(Math.fround(7) / Math.fround(3)) * Math.fround(10));
	assert.equal(fractional.scrollbarThickness, expected);
});

test("native scale context is rejected when field constraints are invalid", () => {
	for (const pair of [
		[0, 100], [-1, 100], [1.2, 100], [Infinity, 100],
		[100, 0], [100, -1], [100, NaN], [100, 1.25],
		[0x80000000, 1], [1, 0x100000000]
	]) {
		assert.equal(EstimateContextScaledScrollViewport(viewport, bothLeft, {
			numerator: pair[0], denominator: pair[1]
		}), null, String(pair));
	}
	assert.equal(EstimateContextScaledScrollViewport({width: 10,height: 10},bothLeft,{
		numerator: 2,denominator: 1
	}),null);
});

test("vertical-left alone cannot shift the origin without a vertical bar", () => {
	const settings=DecodeNativeScrollSettings([{name:"Scrollbar V Left",value:"1"}]);
	const result=EstimateContextScaledScrollViewport(viewport,settings,{
		numerator: 3,denominator: 2
	});
	assert.deepEqual(result.childViewport,{x:0,y:0,width:100,height:60});
	assert.equal(result.verticalScrollbarLeft,false);
});

test("the context-scale helper is pure and does not modify caller input", () => {
	const rect=Object.freeze({...viewport});
	const flags=Object.freeze({...bothLeft});
	const context=Object.freeze({numerator:3,denominator:2});
	const first=EstimateContextScaledScrollViewport(rect,flags,context);
	const second=EstimateContextScaledScrollViewport(rect,flags,context);
	assert.deepEqual(first,second);
	assert.deepEqual(rect,{width:100,height:60});
	assert.deepEqual(flags,bothLeft);
});
