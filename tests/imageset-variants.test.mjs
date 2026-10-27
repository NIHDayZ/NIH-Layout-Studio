import assert from "node:assert/strict";
import test from "node:test";
import { ScaleImageSetCoordinates } from "../.imageset-test-build/ImageSetVariants.js";

test("dayz_gui icon rectangles remain in 1024 reference space at mpix 0", () => {
 assert.deepEqual(ScaleImageSetCoordinates(0, [980,199,38,38,1024,1024]), [980,199,38,38,1024,1024]);
});
test("mpix 1 doubles native sprite and atlas coordinates for the 2048 atlas", () => {
 assert.deepEqual(ScaleImageSetCoordinates(1, [980,199,38,38,1024,1024]), [1960,398,76,76,2048,2048]);
});
test("invalid mpix does not create unbounded coordinate scaling", () => {
 assert.equal(ScaleImageSetCoordinates(-1, [1,2]), null);
 assert.equal(ScaleImageSetCoordinates(9, [1,2]), null);
});
