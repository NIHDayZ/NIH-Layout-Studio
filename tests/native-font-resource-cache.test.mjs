import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("SDF/FNT5 resource contract is defined once without importing React", () => {
	const definition = file("../src/project/SdfFontResource.ts");
	const renderer = file("../src/project/SdfTextCanvas.tsx");
	assert.match(definition, /export interface SdfFontResource \{/);
	assert.match(definition, /metadata: SdfFontMetadata;/);
	assert.match(definition, /glyphs: Map<number, SdfGlyphMetric>;/);
	assert.match(definition, /fnt5Origins\?: Map<number, \{ x: number; y: number \}>;/);
	assert.equal(definition.includes('from "react"'), false);
	assert.equal(renderer.includes("export interface SdfFontResource {"), false);
	assert.ok(renderer.includes('import type { SdfFontResource } from "./SdfFontResource";'));
});

test("existing SdfTextCanvas resource type export remains backward compatible", () => {
	const renderer = file("../src/project/SdfTextCanvas.tsx");
	assert.ok(renderer.includes('export type { SdfFontResource } from "./SdfFontResource";'));
});

test("font parser and resource indexer import the pure contract instead of the React canvas", () => {
	for (const path of ["../src/project/Fnt5Standalone.ts", "../src/project/ProjectWorkspace.ts"]) {
		const source = file(path);
		assert.ok(source.includes('import type { SdfFontResource } from "./SdfFontResource";'), path);
		assert.equal(source.includes('import type { SdfFontResource } from "./SdfTextCanvas";'), false, path);
	}
});

test("atlas load retains the validated 2D source context and rasterizer reuses it", () => {
	const renderer = file("../src/project/SdfTextCanvas.tsx");
	assert.ok(renderer.includes("sourceContext: CanvasRenderingContext2D;"));
	assert.ok(renderer.includes('const ctx = source.getContext("2d", { willReadFrequently: true });'));
	assert.ok(renderer.includes('if (!ctx) { reject(new Error("SDF canvas context unavailable")); return; }'));
	assert.ok(renderer.includes("resolve({ source, sourceContext: ctx, glyphs: new Map() });"));
	assert.ok(renderer.includes("atlas.sourceContext.getImageData(sourceX, sourceY, cell, cell);"));
	assert.equal(renderer.includes('atlas.source.getContext("2d"'), false);
});

test("atlas failure eviction and glyph cache behavior remain unchanged", () => {
	const renderer = file("../src/project/SdfTextCanvas.tsx");
	assert.ok(renderer.includes("const atlases = new WeakMap<SdfFontResource, Promise<CachedAtlas>>();"));
	assert.ok(renderer.includes("if (existing)"));
	assert.ok(renderer.includes("return existing;"));
	assert.ok(renderer.includes("atlases.delete(resource);"));
	assert.ok(renderer.includes("const cached = atlas.glyphs.get(cacheKey);"));
	assert.ok(renderer.includes("atlas.glyphs.set(cacheKey, canvas);"));
	assert.ok(renderer.includes("RasterizeSdfGlyphAlpha(pixels.data, {"));
	assert.ok(renderer.includes("ResolveSdfGlyphDrawPlan({"));
	assert.ok(renderer.includes("ink.drawImage(sprite, plan.x, plan.y, plan.width, plan.height);"));
});
