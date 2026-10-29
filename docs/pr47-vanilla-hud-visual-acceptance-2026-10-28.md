# PR #47 — vanilla DayZ HUD paired rendering acceptance

**Observation date:** 2026-10-28, local time.
**Layout:** `day_z_hud.layout` (vanilla DayZ HUD, as supplied by user).
**Evidence:** Paired user screenshots: DayZ Tools Workbench v1.30.164200.56
(shown in UI footer) and NIH Layout Studio v0.37.0.
Screenshots were supplied in conversation but not committed to the repo.
**Both editors' UI controls:** root size 1280 × 720; zoom shown as 68%.
**Disposition:** **VISUAL ACCEPTANCE FAILED** pending native font render parity.
PR #47 remains draft and unmerged.

## Observations

- The Studio hierarchy contains `HudFrameWidget`, a
  `DefaultActionWidget` RichTextWidget and `ActionsPanel` with many
  `ActionListItem*` text children. No obvious bulk subtree loss.
- The progress/action spinner appears approximately centered in both
  editors. Major HUD groups are in corresponding left/top/center/bottom
  regions, but screen pixel parity has **not** been quantified (different
  app windows and potentially effective DPR/scaling).
- Workbench's upper action labels are readable localization key
  strings (e.g. `layout_hud_action_target_interact`).
  Studio's upper and lower action labels show dramatically
  fragmented/oversized white glyph shapes. This is **not** acceptable
  as a small font smoothing or cosmetic difference.
- Lower status/condition icons are recognizable in both editors,
  but their visual arrangement and individual appearances still need
  a careful matched-asset comparison after text rendering is corrected.
- Workbench reports multiple GUI errors about widget script classes
  unavailable/not managed (including `CrosshairSelector`,
  `ActionProgress` and `InteractionWidget`). These limit Workbench
  editor runtime behavior and are not by themselves an explanation
  for Studio's distorted text.
- The Workbench canvas backing is medium gray, Studio's default backing
  is dark; this reflects editor backing differences until a
  widget-authored background mismatch is demonstrated.
- Studio shows a **VANILLA P:\\gui** source indicator and the
  project browser says to open a project folder. The screenshot
  alone does not establish the selected text widgets' exact font
  property, font route, resolved atlas metadata or whether all
  referenced resources were decoded successfully.

## Source-backed likely investigation area

In `src/components/Canvas.tsx`, `RenderText` checks an explicit
`font` property and optional style font, resolves FNT3 bitmap or
FNT5 SDF from project/dependency/vanilla workspaces, then chooses
SDF canvas, bitmap glyphs or CSS fallback. CSS fallback text uses
DOM text and cannot by itself explain the sprite-like fragmented
forms if the screenshot indeed shows SDF glyphs.

In `src/project/SdfTextCanvas.tsx` the **production default**
uses legacy red-channel SDF sampling and FNT5 cell placement.
The implementation contains independent *opt-in* experimental
flags and logging to isolate FNT5 cell origin, MSDF alpha,
bearing/baseline placement, clipping and fitted text size.
No single diagnostic toggle is certified as the correct native
WorkBench implementation; do not turn on globally without evidence.

Relevant existing query switches:
- `debugFnt5Sampling=1`: logs `[Text route]`, `[SDF widget]`,
  `[FNT5 sampling]` and `[FNT5 placement]` records (bounded).
- `experimentalFnt5Placement=1`: alternate placement for
  `fnt5PixelMetrics` fonts using `Fnt5Placement`.
- `experimentalFnt5Layout=cell`: whole-cell placement experiment.
- `experimentalMsdf=1`: RGB-median MSDF alpha instead of legacy
  single red channel.
- `experimentalFnt5Fit=1`: provisional font-size cap, does not
  establish whether the underlying glyph shapes or origins are right.
- `debugFnt5Clip=1`: deliberately expanded diagnostic canvas
  (may obscure the visual test and should be used after route logging).

**Working hypothesis (not confirmed):** One or more FNT5 cell
selection/alpha/placement mechanisms produces invalid or heavily
clipped glyph imagery under this HUD's resource and widget sizes.
We must first verify whether the affected text uses the SDF
path and which resource/metadata was resolved. A CSS/bitmap route
would redirect the investigation.

## Minimal reproducible local diagnostic

Keep exactly the same `day_z_hud.layout`, loaded vanilla resource
folder, root 1280×720 and zoom 68%, with Widget Bounds/Names off.

1. Without changing any source file, open
   `http://127.0.0.1:5173/?debugFnt5Sampling=1`.
   If the resource/browser session reinitializes, reload the
   same layout and vanilla resources.
2. In browser Developer Tools Console filter for
   `[NIH Layout Studio][Text route]` and
   `[NIH Layout Studio][SDF widget]`; capture at least
   one **affected** `ActionListItem` and its selected font path,
   SDF/bitmap/CSS route, nominal/requested font sizes, widget
   height and (if SDF) FNT5 glyph rectangle/sampling mode.
3. If route is **SDF**, run a *separate* comparison with only
   `experimentalFnt5Placement=1` enabled, then another with only
   `experimentalMsdf=1`, while keeping identical layout and
   viewport. Record what changes in glyph shape/legibility.
   Neither flag is automatically promoted to production.
4. If route is **bitmap** or **CSS**, investigate its own font
   metrics/atlas or CSS clipping instead; do not blindly adopt
   FNT5 fixes.
5. Browser console warnings about missing EDDS, fonts, atlas
   decoding or resource index coverage should be included.

No extra DayZ PBO is needed for the *first* font-render diagnosis.

## Acceptance criteria

- Action labels are readable and no longer structurally mangled.
- Font baseline, glyph size, line positioning and text clipping
  are compared to Workbench at matched root settings.
- Existing font, bitmap/SDF, widget-style, and geometry regression
  tests remain green.
- No blanket font scaling or global widget-class override based
  only on this HUD.
- The worktree remains unchanged while running diagnostic flags.
- Final visual acceptance and PR merge remain blocked until
  verified corrections and at least one retest.

**Do not claim** recovery of the underlying C++ font renderer,
nor treat placement matching as proof of glyph/native paint parity.

## 2026-10-28 console diagnosis — confirmed font route

The user supplied a `debugFnt5Sampling=1` browser console capture
(`Pasted text(20261029-032746).txt`, preserved in conversation).

**The affected HUD action labels are NOT rendered by SDF.** At least
thirteen debug records cite `gui/fonts/sdf_MetronBook72`. The
corresponding `[Text route]` objects explicitly report
`resolvedSdf: null`, `resolvedBitmap: null`,
`fontOverride: null`, `route: "CSS fallback"`, with affected text
values including `#layout_hud_action_target_interact` and
`#layout_hud_action_target_description`.

The user environment indexed 794 files / 203 EDDS textures (203
decoded, zero failed), inspected 9 FNT5 fonts, and parsed only **one
FSDF sidecar** (96 validated SDF glyphs). Its sample `[SDF widget]`
record pertains to an **empty** text widget using
`sdf_metronbook24`, not the distorted ActionListItem labels.
Therefore changing FNT5 raster placement before resolving the font
is not a defensible fix for these observed HUD fragments.

The source of the visible glyph fragments is now explainable:
`LayoutMath.InferFontSize` derives the nominal **72px** generator
size from `sdf_MetronBook72` even when the font is unresolved.
CSS paints that 72px text in much smaller authored text-widget
rectangles, whose `.widget-text` style uses `overflow: hidden`.
This combination clips almost all of each letter; it is not proof of
a failed SDF atlas decode.

**Bounded production fallback correction:** shared helper
`FitUnresolvedCssFontSize` limits only unresolved CSS fallback text
to the widget height with a small line-height margin (0.9×).
Explicit authored size properties, resolved SDF, resolved bitmap,
and resolved browser font routes remain untouched.
`tests/unresolved-css-font-size.test.mjs` verifies Metron72,
MetronLight24, exact author size, and invalid sizes. A Chromium
smoke test checks computed CSS font size and preserves source
unchanged. This is a legibility safeguard, **not a Workbench glyph
metric / typography-parity solution**.

The indexed sidecar-less FNT5 resource parser exists behind the
**opt-in** URL switch `experimentalStandaloneFnt5=1`. It is
intentionally not promoted to production because font cell and
baseline behavior need real Workbench comparison first. An
independent local experiment with that flag should confirm if the
MetronBook72 resource resolves and whether its SDF output improves
or worsens native visual parity. Do not combine multiple
experimental font flags on the initial comparison.

**Acceptance stays blocked** until the real loaded Metron font
rendering matches Workbench more closely and the font route no
longer silently falls back.
