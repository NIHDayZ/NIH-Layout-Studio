import assert from "node:assert/strict";
import test from "node:test";
import { OrderImageSetVariants, ScaleImageSetCoordinates } from "../.imageset-test-build/ImageSetVariants.js";
import { ParseImageSetSource, ResolveProjectImage } from "../.imageset-test-build/ProjectWorkspace.js";

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

const source = 'ImageSetClass {\n Name "dayz_gui"\n RefSize 1024 1024\n ImageSetTextureClass { mpix 0\n path "Gui/imagesets/dayz_gui.edds"\n }\n ImageSetTextureClass { mpix 1\n path "Gui/imagesets/dayz_gui@2x.edds"\n }\n ImageSetDefClass iconHealth0 {\n Name "iconHealth0"\n Pos 980 199\n Size 38 38\n Flags 3\n }\n}';
function workspace(set, assets) {
 return {
  files: assets.map(({path}) => ({path,extension:path.endsWith(".png")?".png":".edds"})),
  imageSets: new Map([[set.name.toLowerCase(),set]]), imageSetAliases:new Map(),
  resourceObjectUrls:new Map(assets.map(({path,url})=>[path,url])),
  resourceDimensions:new Map(assets.map(({path,width,height})=>[path,{width,height}]))
 };
}
test("native parser retains both atlas variants", () => {
 const set=ParseImageSetSource("dayz_gui.imageset",source);
 assert.deepEqual(set?.textures?.map(x=>x.mpix),[0,1]);
});
test("resolver prefers 1x when both atlases are present",()=>{
 const set=ParseImageSetSource("dayz_gui.imageset",source);
 const resolved=ResolveProjectImage(workspace(set,[
  {path:"Gui/imagesets/dayz_gui.edds",url:"blob:one",width:1024,height:1024},
  {path:"Gui/imagesets/dayz_gui@2x.edds",url:"blob:two",width:2048,height:2048}
 ]),"set:dayz_gui image:iconHealth0");
 assert.deepEqual([resolved?.url,resolved?.x,resolved?.y,resolved?.width,resolved?.logicalWidth],["blob:one",980,199,38,38]);
});
test("resolver correctly crops 2x-only atlas while retaining logical dimensions",()=>{
 const set=ParseImageSetSource("dayz_gui.imageset",source);
 const resolved=ResolveProjectImage(workspace(set,[
  {path:"Gui/imagesets/dayz_gui@2x.edds",url:"blob:two",width:2048,height:2048}
 ]),"set:dayz_gui image:iconHealth0");
 assert.deepEqual([resolved?.url,resolved?.x,resolved?.y,resolved?.width,resolved?.logicalWidth],["blob:two",1960,398,76,38]);
});
test("already-pixel-sized generated mpix 1 atlas is not doubled",()=>{
 const set=ParseImageSetSource("generated.imageset",'ImageSetClass {\n Name "generated"\n RefSize 128 128\n ImageSetTextureClass {\n mpix 1\n path "generated.png"\n }\n ImageSetDefClass icon {\n Name "icon"\n Pos 8 16\n Size 16 16\n }\n}');
 const resolved=ResolveProjectImage(workspace(set,[
  {path:"generated.png",url:"blob:generated",width:128,height:128}
 ]),"set:generated image:icon");
 assert.deepEqual([resolved?.x,resolved?.y,resolved?.width,resolved?.height],[8,16,16,16]);
});

test("XML imageset sprites remain absolute pixels rather than inferred-bound scaled",()=>{
 const xml = '<imageset name="xmlgui" file="icons.png"><image name="test" pos="16 16" size="16 16" /></imageset>';
 const set=ParseImageSetSource("xmlgui.imageset",xml);
 const resolved=ResolveProjectImage(workspace(set,[
  {path:"icons.png",url:"blob:xml",width:256,height:256}
 ]),"set:xmlgui image:test");
 assert.deepEqual([resolved?.url,resolved?.x,resolved?.y,resolved?.width,resolved?.height,resolved?.atlasWidth,resolved?.atlasHeight],["blob:xml",16,16,16,16,256,256]);
});

test("variant preference selects mpix 1 when available", () => {
 const variants = [{ path: "one", mpix: 0 }, { path: "two", mpix: 1 }];
 assert.deepEqual(OrderImageSetVariants(variants, 1).map((x) => x.path), ["two", "one"]);
 assert.deepEqual(OrderImageSetVariants(variants).map((x) => x.path), ["one", "two"]);
 assert.deepEqual(variants.map((x) => x.path), ["one", "two"]);
});
test("variant preference safely falls back when requested mpix is missing", () => {
 const variants = [{ path: "one", mpix: 0 }, { path: "two", mpix: 1 }];
 assert.deepEqual(OrderImageSetVariants(variants, 2).map((x) => x.path), ["one", "two"]);
});
test("resolver selects high-resolution atlas on explicit preference", () => {
 const set = ParseImageSetSource("dayz_gui.imageset", source);
 const resolved = ResolveProjectImage(workspace(set, [
  { path: "Gui/imagesets/dayz_gui.edds", url: "blob:one", width: 1024, height: 1024 },
  { path: "Gui/imagesets/dayz_gui@2x.edds", url: "blob:two", width: 2048, height: 2048 }
 ]), "set:dayz_gui image:iconHealth0", 1);
 assert.deepEqual([resolved?.url, resolved?.x, resolved?.y, resolved?.width, resolved?.logicalWidth],
  ["blob:two", 1960, 398, 76, 38]);
});
test("resolver falls back to standard atlas if preferred high-resolution file is absent", () => {
 const set = ParseImageSetSource("dayz_gui.imageset", source);
 const resolved = ResolveProjectImage(workspace(set, [
  { path: "Gui/imagesets/dayz_gui.edds", url: "blob:one", width: 1024, height: 1024 }
 ]), "set:dayz_gui image:iconHealth0", 1);
 assert.equal(resolved?.url, "blob:one");
});
