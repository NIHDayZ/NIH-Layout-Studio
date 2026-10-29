# Native ImageWidget pixel/UV parity gate — orientation visually accepted; strict pixels pending

**Status:** Independent paired Workbench/Studio screenshots now support a **four-of-four visual orientation PASS**. Exact pixel-raster equivalence is **not** established. This work is isolated on `research/native-image-pixel-parity` and does not change the Canvas renderer. The earlier versioned shared-`fixaspect` rectangle gate is independently complete on parent branch `research/native-visual-parity-gate`.

## What this tests

One **identical textured resource**, `image0 "set:dayz_gui image:DayZLogo"`, appears in four ImageWidget instances. Their only authored differences are **position** and the two `"flip u"`/`"flip v"` flags: 00, 10, 01, 11. All use the same 192×192 exact bounds, `stretch 1`, `mode blend` and `"src alpha" 1`.

The image reference is a **candidate named in public DayZ modding documentation**, not independently verified against this particular local DayZ 1.30 imageset. Before comparing, open the local `P:\gui\imagesets\dayz_gui.imageset`, verify the image name exists **and** its referenced EDDS is available in both tools. If absent, choose a known loaded image that is visibly asymmetric across both axes and change **all four references equally**, recording that source substitution. Never silently accept white/missing-texture placeholders as a flip test. No imageset/EDDS or copyrighted DayZ art is committed.

## Workbench vs Studio acceptance steps

1. Open `NIH_NativeImageUv_Parity.layout` in DayZ Tools Workbench and NIH Layout Studio. Index the same vanilla GUI/imageset resources in Studio. Verify that each ImageWidget paints the same, recognizable source image rather than a placeholder.
2. The fixture authors a **960×320 exact-size FrameWidget**, but the editor-level preview viewport **may be 1280×720**; both editors must use the same viewport. Capture actual zoom, Windows display scaling, DPR if available, and app versions. Prefer equal effective pixel scale if attempting strict pixel comparison.
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

The October 29 paired screenshots establish matching orientations, not strict pixel equivalence. See [observed visual evidence](capture.visual.2026-10-29.json). For full raster acceptance, compare images at the same effective zoom and DPR and test alpha/filtering and additional native draw modes. Do not substitute a simple rectangle check. Keep `research/native-visual-parity-gate` and PR #47 frozen until this gate independently succeeds. After UV pixels, test clipping/scissor, fonts, and managed layout interactions separately.

## 2026-10-29 Workbench/Studio evidence

The user supplied two 1919×1032 lossless PNG screenshots with a matched editor preview **1280×720**; Studio was at **79%** zoom, Workbench at **80%**, with Workbench root DPI scaling unchecked. The four instances of the same DayZ logo image resolve and paint in both. Every normal/U/V/U+V orientation appears correct, with no obvious texture failure or stretching.

A normalized silhouette comparison (threshold white pixels; binary resize to 160×160; IoU) returned **0.931 / 0.926 / 0.938 / 0.942** for None/U/V/UV (last uses a one-pixel alignment shift). This is a diagnostic cross-renderer shape check, **not** evidence of identical RGB/alpha pixels or an exact zoom match. The original PNG screenshots were supplied in the conversation and are intentionally **not committed**. Each SHA-256 and the observed crop details are retained in [`capture.visual.2026-10-29.json`](capture.visual.2026-10-29.json).

**Disposition:** close the four-state **visual orientation** gate only; leave strict pixel equivalence and other image rendering modes open. No Canvas changes warranted from these screenshots.
