# Native TextWidget/ButtonWidget vertical alignment parity — pending native evidence

This fixture isolates the **remaining shared font placement discrepancy**, *not* font width. The October 29 height-sized FNT5 experiment matched all six previously tested Workbench text widths to within 3% using one rule, but the tall Book72 text was ≈12.2 logical pixels lower in Studio and reached its bottom edge; Book24 ButtonWidget was ≈5.2px higher.

The `NIH_NativeFontVAlign_Parity.layout` fixture has **20 controls**: five rows × four columns. Rows are TextWidget Book72 tall (110px), TextWidget Book72 short (34px), TextWidget Book24 (44px), ButtonWidget Book72 (68px), and ButtonWidget Book24 (44px). Columns are **default**, explicitly **top**, **center**, and **bottom** `"text valign"`. All use the same short `ABC` text to fit inside the 270px-wide controls, identical fonts within each row, exact geometry and a 1280×720 root.

**Observe the native behavior first.** `text valign` is authored for this test; if Workbench rejects these values or draws identical output regardless of flags, record that outcome rather than assuming it uses Studio's interpretation. The fixtures' Node tests validate syntax, geometry and intended experimental variables only.

## Local setup

```powershell
git fetch origin
git switch research/native-font-valign-parity
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
npm run dev
```

Open the same fixture in Workbench and Studio. Use **1280×720**, zoom **68% if possible**, turn off Studio widget outlines/names and Workbench root DPI scaling. Studio URL:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&debugFnt5Sampling=1
```

Capture lossless full screenshots from both editors. Preserve real filenames and versions, and send the Studio console's `[SDF widget]` and `[FNT5 placement]` records. Compare white-ink top and bottom inset, glyph height and horizontal extent per control after mapping both screenshots' root rectangles to 1280×720. Include whether the native default column behaves like explicit top or center for each widget family.

## Gate boundary

The existing `capture.template.json` is intentionally empty. This is a new native visual test. No production Canvas text baseline changes, font-specific offsets or native font behavior claims should be made before its result. If the native vertical alignment differs consistently from `lineHeight=fontSize*1.25`, derive a **shared glyph-ink vertical model** from the observed native cases and then test that in an isolated experiment. Avoid patching Book72 tall or Book24 ButtonWidget individually; the goal is a common engine model.
