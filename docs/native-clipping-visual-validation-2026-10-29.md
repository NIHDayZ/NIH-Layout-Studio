# Native Frame/Panel visual clipping validation — October 29, 2026

**Research branch:** `research/native-clipping-visual-gate` — tests run on `d60631d1769b65cbd1c61a5e7ae8f93e22ee6163`.

## Local Windows validation

The user-supplied `Pasted text(20261029-181813).txt` records:
- `npm run test:geometry-engine` → **271/271 passed, 0 skipped or failed**
- `npm run test:native-image-uv` → **11/11 passed, 0 skipped or failed**
- `npm run typecheck` → PASS
- `npm run build` → PASS, Vite 7.3.7, 70 modules transformed

Total selected automated tests: **282 passed**. The `npm run devc` typo had no script; the correct `npm run dev` subsequently started Vite on localhost:5173, and is not a failure in the validated test or build steps.

## Independent screenshot evidence

Two user-supplied editor screenshots at 1280×720 logical root and 68% displayed zoom show **all six** authored clipping controls matching: Frame off/on; Panel off/on; nested inner off/on. Workbench root DPI scaling is unchecked. Both source images and their exact hashes are detailed in `tests/fixtures/native-clip-visual/capture.visual.2026-10-29.json`. The original screenshot files are retained with the conversation, not committed.

- Five deliberate outside-parent regions paint visible white logo fragments for the corresponding **unclipped** controls.
- The five matching outside-parent regions paint **zero white pixels** when clipping is enabled, in **both** editors.
- Root-crop normalized white-silhouette diagnostic **IoU = 0.9117847**, using min(R,G,B)>=210 and nearest-neighbor logical 1280×720. This metric is useful for shape consistency, not proof of pixel-perfect matching or native alpha/filter parity.

**Disposition:** close the six-case **visual FrameWidget/PanelWidget clipping gate**. This evidence does **not** establish internal native scissor implementation, all image draw paths, managed Scroll clipping, clip masks, font glyph clipping or exact pixel equivalence. No production Canvas change is indicated. PR #47 remains draft. The newly added frozen visual-evidence regression test requires a fresh local run (expected geometry count: **272**).
