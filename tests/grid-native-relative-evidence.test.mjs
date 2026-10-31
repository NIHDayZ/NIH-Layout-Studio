import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reference = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/grid-relative-phase2k-native.json", import.meta.url), "utf8"
));
const source = readFileSync(
	new URL("./fixtures/workbench-grid/NIH_Grid_Relative_Matrix.layout", import.meta.url), "utf8"
);

/**
 * Research-only reference model for the measured 2x2/three-child fixture.
 * This is not the production native geometry algorithm.
 */
function PredictFixture(sample) {
	const { columns, rows, padding, margin } = reference.grid;
	assert.equal(columns, 2);
	assert.equal(rows, 2);
	const [firstWidth, firstHeight] = reference.fixedChild0;
	const [lastWidth, lastHeight] = reference.fixedChild2;
	const [authoredWidth, authoredHeight] = sample.authoredSize;
	const [ratioWidth, ratioHeight] = sample.relativeSize;
	const fixedColumnWidth = Math.max(firstWidth, lastWidth);
	const baseWidth = 2 * margin + padding + fixedColumnWidth;
	const baseHeight = 2 * margin + padding + firstHeight + lastHeight;
	assert.ok(authoredWidth >= baseWidth, "negative free width is not measured by Phase 2K");
	assert.ok(authoredHeight >= baseHeight, "negative free height is not measured by Phase 2K");
	const relativeWidth = ratioWidth * (authoredWidth - baseWidth);
	const relativeHeight = ratioHeight * (authoredHeight - baseHeight);
	const equalWidth = Math.max(0, (authoredWidth - 2 * margin - padding) / columns);
	const equalHeight = Math.max(0, (authoredHeight - 2 * margin - padding) / rows);
	const col0 = sample.contentWidth ? fixedColumnWidth : equalWidth;
	const col1 = sample.contentWidth ? relativeWidth : equalWidth;
	const row0 = sample.contentHeight ? Math.max(firstHeight, relativeHeight) : equalHeight;
	const row1 = sample.contentHeight ? lastHeight : equalHeight;
	const width = sample.contentWidth ? 2 * margin + padding + col0 + col1 : authoredWidth;
	const height = sample.contentHeight ? 2 * margin + padding + row0 + row1 : authoredHeight;
	return {
		parent: [width, height],
		children: [
			[margin, margin, sample.contentWidth ? firstWidth : col0,
				sample.contentHeight ? firstHeight : row0],
			[margin + col0 + padding, margin, col1, row0],
			[margin, margin + row0 + padding, sample.contentWidth ? lastWidth : col0,
				sample.contentHeight ? lastHeight : row1]
		]
	};
}

test("Phase 2K reference covers twelve nonduplicated native cases", () => {
	assert.equal(reference.cases.length, 12);
	assert.equal(new Set(reference.cases.map(sample => sample.name)).size, 12);
	assert.deepEqual(reference.phaseNames, [
		"relative-after-create", "relative-post-update", "relative-after-resize-1120x720"
	]);
});

test("Phase 2K source fixture preserves measured authored inputs", () => {
	for (const sample of reference.cases) {
		const opening = `GridSpacerWidgetClass ${sample.name} {`;
		const start = source.indexOf(opening);
		assert.ok(start >= 0, `${sample.name} missing`);
		const next = source.indexOf("GridSpacerWidgetClass ", start + opening.length);
		const block = source.slice(start, next < 0 ? source.length : next);
		const parentSize = block.match(/\bsize\s+([\d.]+)\s+([\d.]+)/);
		assert.ok(parentSize, `${sample.name} has no authored size`);
		assert.deepEqual([Number(parentSize[1]), Number(parentSize[2])],
			sample.authoredSize, `${sample.name} authored size`);
		const relativeChild = new RegExp(
			`PanelWidgetClass ${sample.name}Child1\\s*\\{[\\s\\S]*?\\bsize\\s+([\\d.]+)\\s+([\\d.]+)`
		).exec(block);
		assert.ok(relativeChild, `${sample.name} relative child missing`);
		assert.deepEqual([Number(relativeChild[1]), Number(relativeChild[2])],
			sample.relativeSize, `${sample.name} relative size`);
		for (const [axis, enabled] of [["H", sample.contentWidth], ["V", sample.contentHeight]]) {
			const found = new RegExp(`"Size To Content ${axis}"\\s+([01])`).exec(block);
			assert.equal(found?.[1] === "1", enabled, `${sample.name} content ${axis}`);
		}
	}
});

test("Phase 2K bounded model matches all twelve native parent and child rectangles", () => {
	for (const sample of reference.cases) {
		const predicted = PredictFixture(sample);
		assert.deepEqual(predicted.parent, sample.nativeParentSize, `${sample.name} parent`);
		assert.deepEqual(predicted.children, sample.nativeChildRects, `${sample.name} children`);
	}
});
