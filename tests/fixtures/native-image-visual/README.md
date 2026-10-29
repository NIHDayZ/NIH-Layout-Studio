# Native ImageWidget pixel/UV parity gate — pending visual evidence

**Status:** Test fixture only; no native image pixels have been captured. This work is isolated on `research/native-image-pixel-parity` and does not change the Canvas renderer. The earlier versioned shared-`fixaspect` rectangle gate is independently complete on parent branch `research/native-visual-parity-gate`.

## What this tests

One **identical textured resource**, `image0 "set:dayz_gui image:DayZLogo"`, appears in four ImageWidget instances. Their only authored differences are **position** and the two `"flip u"`/`"flip v"` flags: 00, 10, 01, 11. All use the same 192×192 exact bounds, `stretch 1`, `mode blend` and `"src alpha" 1`.

The image reference is a **candidate named in public DayZ modding documentation**, not independently verified against this particular local DayZ 1.30 imageset. Before comparing, open the local `P:\gui\imagesets\dayz_gui.imageset`, verify the image name exists **and** its referenced EDDS is available in both tools. If absent, choose a known loaded image that is visibly asymmetric across both axes and change **all four references equally**, recording that source substitution. Never silently accept white/missing-texture placeholders as a flip test. No imageset/EDDS or copyrighted DayZ art is committed.

## Workbench vs Studio acceptance steps

1. Open `NIH_NativeImageUv_Parity.layout` in DayZ Tools Workbench and NIH Layout Studio. Index the same vanilla GUI/imageset resources in Studio. Verify that each ImageWidget paints the same, recognizable source image rather than a placeholder.
2. Set the layout root to **960×320** in both editors. Capture the actual zoom, Windows display scaling, DPR if available, and native Workbench/app versions; Workbench zoom % alone is not a logical size. Prefer 100% effective pixel scale or record enough information to normalize screenshots.
3. Disable **Widget Bounds** and **Widget Names** in Studio. In Workbench, capture the unobstructed four-image canvas; use a separate selection screenshot if necessary for widget naming. Preserve lossless PNG originals, uncropped at capture, and include the entire reference layout.
4. Compare both editor images across the same four widget bounds. `UV_None` is the baseline: `UV_FlipU` should be its horizontal mirror; `UV_FlipV` the vertical mirror; `UV_FlipUV` both. This is a **hypothesis derived from native UV component selection**, not itself observed pixel evidence. If the chosen sprite is symmetric along an axis, substitute a verified asymmetric resource; do not report an ambiguous visual PASS.
5. Record resource resolution, sampled image coverage, clipping, alpha, border behavior, image source name, and actual screenshots. If observed pixels differ, localize the discrepancy before altering shared image rendering. CSS `scale(-1,1)` is expected to model **only axis-aligned** image presentation; arbitrary four-corner UVs and alternate native draw modes remain separate gates.

## Regression preflight (no visual PASS inferred)

```powershell
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
```

The new `native-image-visual-fixture.test.mjs` parses the actual layout, confirms the four source flags and immutable geometry, and ensures the visual capture template is unpopulated. It never fabricates native pixel observations.

Do **not** create an unnecessary client MissionGameplay probe for this stage: `GetScreenPos/GetScreenSize` reports rectangles and cannot show image pixels or source UV mapping. Start with Workbench/Studio paired visual evidence and the **same native asset**. Only introduce deeper native capture if the screenshot results show a measurable discrepancy and an appropriate pixel-readback mechanism is known.

## Outcome gate

Complete a native-versus-Studio image-surface comparison, not only an editor zoom or widget rectangle check. Keep `research/native-visual-parity-gate` and PR #47 frozen until this gate independently succeeds. After UV pixels, test clipping/scissor, fonts, and managed layout interactions separately.
