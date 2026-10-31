import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PlanNativeRelativeGrid } from "../.geometry-engine-test-build/GridRelativeContent.js";

const manifest = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-complex-phase2l-cases.json", import.meta.url), "utf8"
));
const evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-complex-phase2l-native.json", import.meta.url), "utf8"
));
const observed = evidence.native;

function PlanCase(sample) {
	const indices = [];
	const children = [];
	for (let i = 0; i < sample.children.length; ++i) {
		const child = sample.children[i];
		if (child.visible === false && sample.ignoreInvisible !== false)
			continue;
		let width = child.size[0];
		let height = child.size[1];
		let exactWidth = child.exact[0];
		let exactHeight = child.exact[1];
		if (child.children) {
			// Bottom-up: native-observed nested content size becomes the
			// immediate parent's fixed/concrete child measurement.
			assert.equal(child.contentH, true);
			assert.equal(child.contentV, true);
			const nested = PlanCase(child);
			width = nested.plan.width;
			height = nested.plan.height;
			exactWidth = true;
			exactHeight = true;
		}
		indices.push(i);
		children.push({ width, height, exactWidth, exactHeight });
	}
	const plan = PlanNativeRelativeGrid({
		columns: sample.columns,
		rows: sample.rows,
		padding: sample.padding,
		margin: sample.margin,
		authoredWidth: sample.size[0],
		authoredHeight: sample.size[1],
		contentWidth: sample.contentH,
		contentHeight: sample.contentV,
		children
	});
	assert.ok(plan, sample.name);
	return { plan, indices };
}

function Close(actual, expected, name) {
	assert.equal(actual.length, expected.length, name + " coordinate count");
	for (let i = 0; i < actual.length; ++i)
		assert.ok(Math.abs(actual[i] - expected[i]) <= 0.00001,
			`${name} coordinate ${i}: expected ${expected[i]}, got ${actual[i]}`);
}

test("Phase 2L independently captured three stable phases and complete grid roster", () => {
	assert.deepEqual(evidence.capturePhases, manifest.capturePhases);
	assert.deepEqual(evidence.rootSizes, [[1920, 1080], [1920, 1080], [1120, 720]]);
	const keys = Object.keys(observed);
	assert.equal(keys.length, 21, "twenty top-level grids and one nested grid");
	for (const sample of manifest.cases) {
		assert.ok(observed[sample.name], sample.name + " missing native capture");
		assert.equal(observed[sample.name][1].length, sample.children.length, sample.name);
	}
	assert.equal(observed.LNestedChild0[1].length, 2);
	assert.equal(keys.reduce((count, key) => count + observed[key][1].length, 0), 87);
	assert.equal(keys.reduce((count, key) =>
		count + observed[key][1].filter(record => record !== null).length, 0), 86);
});

test("Phase 2L shared planner matches 21 native grid sizes and 86 participating child rectangles", () => {
	let parentChecks = 0;
	let childChecks = 0;
	for (const sample of manifest.cases) {
		const { plan, indices } = PlanCase(sample);
		const [expectedParent, expectedChildren] = observed[sample.name];
		Close([plan.width, plan.height], expectedParent, sample.name + " parent");
		++parentChecks;
		assert.equal(indices.length, plan.rects.length, sample.name);
		for (let i = 0; i < indices.length; ++i) {
			const originalIndex = indices[i];
			const native = expectedChildren[originalIndex];
			assert.ok(native, `${sample.name} child ${originalIndex} native missing`);
			const rect = plan.rects[i];
			Close([rect.x, rect.y, rect.width, rect.height], native.slice(0, 4),
				`${sample.name} child ${originalIndex}`);
			++childChecks;
		}
		for (let i = 0; i < expectedChildren.length; ++i) {
			if (!indices.includes(i))
				assert.equal(expectedChildren[i], null, `${sample.name} excluded child ${i}`);
		}
		if (sample.name === "LNested") {
			const nestedSample = { ...sample.children[0], name: "LNestedChild0" };
			const nested = PlanCase(nestedSample);
			const [parent, children] = observed.LNestedChild0;
			Close([nested.plan.width, nested.plan.height], parent, "nested grid parent");
			++parentChecks;
			for (let i = 0; i < children.length; ++i) {
				const rect = nested.plan.rects[i];
				Close([rect.x, rect.y, rect.width, rect.height], children[i].slice(0, 4),
					`nested child ${i}`);
				++childChecks;
			}
		}
	}
	assert.equal(parentChecks, 21);
	assert.equal(childChecks, 86);
});

test("Phase 2L negative free space collapses, while ratios above one are preserved", () => {
	const deficit = manifest.cases.find(sample => sample.name === "LBothDeficit");
	const over = manifest.cases.find(sample => sample.name === "LRatioOver");
	assert.deepEqual([PlanCase(deficit).plan.width, PlanCase(deficit).plan.height], [51, 46]);
	assert.deepEqual([PlanCase(over).plan.width, PlanCase(over).plan.height], [287.25, 117]);
});

test("Phase 2L unsupported inputs fail closed instead of generating native claims", () => {
	const sample = manifest.cases.find(entry => entry.name === "LBaseline");
	const children = sample.children.map(child => ({
		width: child.size[0], height: child.size[1],
		exactWidth: child.exact[0], exactHeight: child.exact[1]
	}));
	const base = {
		columns: 2, rows: 2, padding: 3, margin: 4, authoredWidth: 240,
		authoredHeight: 100, contentWidth: true, contentHeight: true, children
	};
	assert.equal(PlanNativeRelativeGrid({ ...base, columns: 0 }), null);
	assert.equal(PlanNativeRelativeGrid({ ...base, authoredWidth: NaN }), null);
	assert.equal(PlanNativeRelativeGrid({ ...base, children: [] }), null);
	assert.equal(PlanNativeRelativeGrid({ ...base, children: [{ ...children[0], width: -1 }] }), null);
	assert.equal(PlanNativeRelativeGrid({
		...base, contentHeight: false, children: [...children, ...children]
	}), null, "over-capacity fixed-height arrangement is unverified");
});
