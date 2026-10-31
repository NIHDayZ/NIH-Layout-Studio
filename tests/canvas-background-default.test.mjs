import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");

test("Workbench-matched gray is the default for the layout preview canvas", () => {
	const declaration = styles.match(/(?:^|\n)\.canvas\s*\{([^}]*)\}/);
	assert.ok(declaration, "missing base preview canvas CSS");
	assert.match(declaration[1], /(?:^|;)\s*background:\s*rgb\(130,\s*130,\s*130\)\s*;/);
	assert.match(styles, /\.preview-viewport\s*\{[^}]*background-image:/,
		"surrounding editor grid must remain independent of canvas color");
});

test("Workbench gray does not require a URL flag or inline experiment override", () => {
	assert.ok(!canvas.includes("experimentalWorkbenchBackdrop"),
		"gray preview must not depend on a research-only query flag");
	assert.ok(canvas.includes('className={`canvas ${showGrid ? "canvas-grid" : ""}`}'),
		"preview still uses its original CSS canvas class");
	const canvasStart = canvas.indexOf('<div ref={canvasRef} className={`canvas');
	assert.ok(canvasStart >= 0);
	const canvasEnd = canvas.indexOf('onMouseDown={() => undefined}', canvasStart);
	assert.ok(canvasEnd > canvasStart);
	const canvasTag = canvas.slice(canvasStart, canvasEnd);
	assert.ok(!canvasTag.includes("backgroundColor"), "no competing inline canvas background");
});
