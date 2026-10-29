# FNT5 default vertical baseline — native-valid replacement fixture

**Status: PENDING native screenshot validation.** This fixture deliberately **does not** author `"text valign"`. The earlier `NIH_NativeFontVAlign_Parity.layout` had 15 explicit alignment properties and DayZ Tools Workbench 1.30.164200.56 visibly reported `Unknown keyword/data 'text valign'`. Despite public mod layouts documenting the spelling, those rejected attributes cannot serve as independent Workbench alignment evidence in this environment. Keep the original as a failed native compatibility experiment; see [recorded error evidence](rejected-valign.2026-10-29.json).

## Independent default baseline comparison

The new `NIH_NativeFontDefaultBaseline.layout` uses 20 controls: five native font/widget combinations and four heights (**24 / 34 / 68 / 110px**), with unchanged 270px widths and `ABC` text. Rows:

- TextWidget MetronBook72
- TextWidget MetronBook24
- TextWidget MetronLight24
- ButtonWidget MetronBook72
- ButtonWidget MetronBook24

No explicit text alignment, manual offsets, custom styles, exact text sizes or font overrides beyond the native font path. This tests default native glyph-top/ink baseline, including how it scales with the widget height, **without falsely attributing default placement to an unsupported alignment value**.

## Local validation and screenshots

```powershell
git fetch origin
git switch research/native-font-default-baseline
git pull --ff-only
npm run test:geometry-engine
npm run test:native-image-uv
npm run typecheck
npm run build
npm run dev
```

Expected geometry suite: **294 tests** (previous 290, four new fixture tests). Do not count it validated until local tests pass.

Open the new layout in both tools at 1280×720 and 68% displayed zoom, Workbench root DPI scaling off. Studio:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&debugFnt5Sampling=1
```

Capture both full screenshots **including Workbench's error counter/log** and Studio's `[SDF widget]`/`[FNT5 placement]` console. If Workbench reports `Unknown keyword/data` for **any property in the replacement layout**, stop: this replacement is not a valid native baseline fixture.

Compare per-control text ink top/bottom inset, width and height after mapping each editor's observed root rectangle to logical 1280×720. Default TextWidget and ButtonWidget behavior must be assessed separately. Distinguish white glyph pixels from Studio button chrome and gray/black backgrounds; do not claim exact alpha or antialiasing parity from binary silhouettes. Original screenshot files are not committed.

We should derive a shared vertical baseline model from repeated native measurements before touching Studio's font pipeline. Native `WidgetFlags.VCENTER` and `ButtonWidget.SetTextVerticalAlignment` are available in DayZ script, but **their presence does not establish that the rejected layout keyword is accepted by this Workbench build**. A separate native runtime API test can be prepared later if explicit alignment is required.

**PR #47 stays draft, production Canvas remains unchanged.**
