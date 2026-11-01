import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(
	new URL("./fixtures/workbench-grid/rover-colorable-native-style-evidence.json", import.meta.url),
	"utf8"
));

test("native rover_sim_colorable style uses WhitePixel for all nine regions in Normal and Disabled states", () => {
	assert.equal(evidence.styleName, "rover_sim_colorable");
	assert.equal(evidence.styleImageset, "rover_imageset");
	assert.equal(evidence.styleColorDecimal, 4294967295);
	assert.equal(evidence.styleColorHex, "0xFFFFFFFF");
	assert.deepEqual(evidence.imagePos, [1, 101]);
	assert.deepEqual(evidence.imageSize, [1, 1]);
	assert.equal(evidence.imageFlags, 0);
	assert.equal(evidence.imageForEveryRegion, "WhitePixel");
	assert.equal(evidence.states.Normal.length, 9);
	assert.deepEqual(evidence.states.Normal, evidence.states.Disabled);
});

test("native decoded WhitePixel texel is fully opaque white; adjacent atlas alpha varies", () => {
	const decoded = evidence.decodedTexture;
	assert.equal(decoded.width, 256);
	assert.equal(decoded.height, 512);
	assert.equal(decoded.compressedSizeBytes, 169120);
	assert.deepEqual(evidence.texturePixelRGBA, [255, 255, 255, 255]);
	assert.deepEqual(decoded.whitePixel, { x: 1, y: 101, rgba: [255, 255, 255, 255] });
	const neighbors = decoded.neighborhood.flat();
	assert.equal(neighbors.length, 9);
	assert.ok(neighbors.every(item => item.rgba.length === 4
		&& item.rgba.slice(0, 3).every(channel => channel === 255)));
	assert.ok(neighbors.some(item => item.rgba[3] === 0),
		"atlas neighbors with zero alpha are recorded, not assumed opaque");
	assert.ok(neighbors.some(item => item.rgba[3] === 255));
});
