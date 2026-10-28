# Unified Enfusion layout engine — implementation design (proposal)

**Status:** architecture proposal. None of the interfaces or algorithms in this document should be described as an exact reproduction of the native Workbench source. Verified disassembly evidence remains in `workbench-native-spacer-static-analysis.md`.

## Problem

`Canvas.tsx` currently calls `ResolveRect` recursively and then changes child positions in `RenderChildren`. Grid size-to-content logic also runs during `RenderNode`, which mixes parent measurement, placement, rendering and editor interactions. The result is correct-looking isolated layouts but inconsistent nested behavior across other classes. This is a **cross-widget architecture defect** rather than a single-Widget-class offset error.

## Architectural boundary

```text
Parsed LayoutDocument + resolved project resources
                     |
                Property model
        (shared defaults, types, flags)
                     |
            Measure hierarchy (bottom-up)
        content min/preferred/max dimensions
                     |
            Arrange hierarchy (top-down)
       constraints, anchors, cells, scrolling
                     |
              LayoutSnapshot
       node ID -> resolved local/global rect,
        clip, visibility, sort, transform
                     |
              Canvas renderer
      styles, images, fonts, widget visuals
                     |
         Editor overlays / interactions
```

The exact measure/arrange ordering for every widget remains subject to native trace and Workbench verification; this is the *proposed separation of responsibilities*.

## Proposed API (not yet introduced in production code)

```ts
interface LayoutConstraints {
  availableWidth: number;
  availableHeight: number;
  dpiScale: number;
}
interface MeasuredWidget {
  minWidth: number;
  minHeight: number;
  preferredWidth: number;
  preferredHeight: number;
  dependsOnParentWidth: boolean;
  dependsOnParentHeight: boolean;
}
interface ArrangedWidget {
  id: string;
  localRect: { x: number; y: number; width: number; height: number };
  absoluteRect: { x: number; y: number; width: number; height: number };
  clipRect: { x: number; y: number; width: number; height: number } | null;
  visible: boolean;
  sort: number;
}
interface LayoutStrategy {
  measure(node: LayoutNode, ctx: MeasureContext): MeasuredWidget;
  arrange(node: LayoutNode, rect: Rect, ctx: ArrangeContext): void;
}
```

Pure strategy functions should be testable in Node without DOM, React, EDDS, or special URL flags. Renderer resource resolution remains separate. Include warnings/diagnostic confidence when the native rule for a property is not yet established.

## Common semantics first

1. **Property decoder:** resolve numeric, bool, vector, font and style properties once, preserving explicit vs default values. Native GridSpacer defaults of 3×3, its `Padding` outer inset and `Margin` inter-cell spacing have stronger evidence than other defaults.
2. **Base geometry:** exact vs parent-relative dimensions, `*_ref` alignment, signed offsets, `fixaspect`, scaling, safe-zone, `position`/ `size`, visibility and disabled flags.
3. **Geometry passes:** separate intrinsic sizes from parent-dependent fractions; avoid self-referential size-to-content feedback. A parent must be measured before committing final children, and remeasurement must be bounded and deterministic.
4. **Container strategies:** ordinary widget, frame/panel, grid, wrap, scroll, embedded. Each applies shared constraints but has its own arrangement implementation.
5. **Snapshot output:** immutable per-node geometry, sorted painting order, effective clipping and visibility. The renderer should never invent layout coordinates.
6. **Visual system:** assets and native style state are applied to snapshot rectangles; the editor's theme must never tint layout content.
7. **Editor affordances:** selections, drag, resize, snap, guides, overlays and temporary preview geometry are separate from saved native layout properties.

## Critical compatibility constraints

- **Do not special-case filenames, node names or IDs.** Features must operate across vanilla and modded layouts.
- **Do not treat parser-known as renderer-supported.** Specialized widgets need accurate capability reporting.
- **Do not silently replace unsupported rendering with plausible-looking native visuals.** Annotated placeholders are preferable for 3D, map, HTML or runtime-driven content.
- **Keep FNT5/FNT3, imageset, and 9-slice work intact.** Native geometry rewrites should not alter font rasterization or asset selection by accident.
- **Preserve editor interaction contracts.** Editing transformed/positioned widget dimensions must round-trip to authored `position` and `size` without corrupting exact/relative flags.
- **Use evidence tiers:** confirmed native disassembly; observed Workbench snapshots; inferred from examples; preview-only approximation. Record tier per implemented rule.
- **Performance:** precompute decoded property records; avoid repeated project resource lookups in geometry; cache subtree measurements by node/property/constraints; avoid layout work inside widget pixel painting.

## Proposed implementation sequence and gates

| Milestone | Output | Verification gate |
|---|---|---|
| M0 Inventory and baseline | Widget matrix, archive census tool, native API/RTTI notes | Source counts and synthetic scanner tests |
| M1 Base geometry extraction | New pure rect/anchor/constraint module used in read-only diagnostics | Existing geometry tests + multi-resolution round-trips |
| M2 Shared hierarchy measurement | Deterministic intrinsic measurement and parent-relative sizes | Nested/size-to-content fixtures no feedback or overflow surprises |
| M3 Grid/Wrap/Scroll strategies | Pure native-derived layout planners | `spacertest`, `spacertest2`, `scrolltest`, HUD, inventory |
| M4 Canvas snapshot integration | Render consumes arranged rects; editing overlays separate | Screenshot and geometry parity, no editor regression |
| M5 Visual/control parity | Style state, text/image/color, common controls | Stable per-class Workbench reference snapshots |
| M6 Specialized widgets | Map/HTML/3D/video coverage with explicit support status | Dedicated native reference fixtures or honest placeholders |

Only turn off the current experimental URL flags after the new engine passes representative tests. PR #45 was merged as a validated checkpoint; the shared engine is now developed in draft PR #47.

## Reference datasets and reproducibility

Use a **local** Workbench install for golden images and geometry notes. Keep proprietary PBO/EDDS/executable assets out of the repository. Commit manually generated fixtures with explicit original property values and expected coordinates where licensing permits, or store only numerical measurements and hashes. The `scripts/audit-workbench-widgets.mjs` tool can repeat the class inventory when DayZ Tools changes.

Prioritize wide coverage from bundled vanilla examples and additional mod layouts, not the order in which a mismatch was first noticed.


## M1 progress in draft PR #47 (authored geometry, not native arrangement)

The first pure modules live in `src/renderer/engine/`:

- `GeometryCore.ts`: rectangle translation, intersections, inherited clipping, and common result contracts.
- `WidgetGeometry.ts`: one-pass case-insensitive property decoding, independent exact/relative axes, plain and `*_ref` anchor positions, and inverse encoding for the editor. These formulas intentionally reproduce `LayoutMath.ts` before attempting to replace it.
- `GeometrySnapshot.ts`: depth-first, read-only authored-coordinate snapshots with parent-local and absolute rectangles, inherited visibility, effective ancestor clip and stable document order. Includes explicit diagnostics for duplicate widget IDs and layout-manager children whose native arrangement is not yet implemented.

`npm run test:geometry-engine` compiles these modules, independently bundles the **existing** `LayoutMath.ts` as an oracle, then checks base primitives, 2,304 alignment/resolution combinations, 80 authoring round-trips, and nested hierarchy cases. This is a **compatibility regression against our existing renderer**, not proof of complete Workbench parity.

The new authored-coordinate snapshot must never be used to replace live GridSpacer, WrapSpacer, ScrollWidget, ContentWidget or embedded-layout positions. Those classes are intentionally marked as requiring native measurement/arrangement strategies. Only when shared semantics have been independently validated against representative Workbench screens should snapshot geometry be integrated into `Canvas.tsx`.

### M1 follow-up acceptance criteria

1. Compare the new snapshot against existing `TraceWidgetGeometry` for plain nested Frame, Panel, Text, Image and Button cases.
2. Compare anchor modes at several root resolutions and document exact authoring properties and numeric outcomes.
3. Confirm baseline snapshot passes through visible/hidden and nested clipping hierarchies.
4. Extend to native-verified aspect, scaling and safezone rules only when evidence exists.
5. Avoid any production renderer switch or flag removal until these gates pass.

## M1 consolidation and conservative measurement boundary

The live `LayoutMath.ResolveRect` and `RectToLayoutGeometry` functions now delegate to `DecodeAuthoredGeometry`, `ResolveAuthoredRect` and `EncodeAuthoredRect` in the shared engine. The existing public APIs and source round-tripping remain intact, while the duplicate forward/inverse alignment math has been removed from `LayoutMath.ts`. Text/style utilities remain there until their native rendering dependencies are independently audited.

The geometry regression oracle was **frozen from the pre-delegation implementation** in `tests/reference/legacy-widget-geometry.mjs` so the 2,304 alignment comparisons and 80 editor round-trips are not tautologies. Production does not import the legacy reference. The new property decoder scans each widget's authored properties once per decode and preserves first-property-wins behavior; it intentionally does not cache by mutable object identity. Before introducing caching, measure real large-layout workloads and establish explicit source-change invalidation.

`WidgetStrategies.ts` centralizes dispatch by **exact widget class identity**. Grid and Wrap are labeled as having native-disassembly evidence; Spacer/Scroll are based on public APIs; Content/embedded/SmartPanel classifications are layout observations. This registry identifies where specialized child arrangement is required, but does not supply an unverified substitute algorithm. It replaces the loose container substring heuristics in `GeometrySnapshot.ts`.

`MeasureAuthoredSize` now contributes **preferred dimensions only for exact-size axes**, returning zero for parent-relative intrinsic size and conservative zero minimums. It explicitly does not compute native text glyph bounds, imageset intrinsic dimensions, or Grid/Wrap/Scroll/Content size-to-content. The read-only snapshot exposes `measuredById` alongside authored positions to support future measure/arrange passes. Never confuse that measurement hint with native content measurement or a completed final layout.

**Next gate:** native evidence for shared content measurement, child constraint negotiation and size-to-content. Only then introduce a container-specific `measure`/`arrange` strategy implementation. Keep experimental grid behavior and current production canvas rendering unchanged until the new engine is validated against Workbench for multiple widget families.


## M2 start — two-pass measurement and constrained authored geometry

The draft branch adds `src/renderer/engine/LayoutMeasurement.ts` and refactors `GeometrySnapshot.ts` to expose separate entry points:

```ts
const measured = MeasureLayoutTree(document.roots); // child-first
const first = ArrangeMeasuredGeometry(measured, { x: 0, y: 0, width: 1920, height: 1080 });
const second = ArrangeMeasuredGeometry(measured, { x: 0, y: 0, width: 1280, height: 720 });
```

This ensures each widget's authored geometry is decoded once when building the reusable measured tree, rather than re-reading each property during every placement pass. The prepared tree holds the existing `MeasuredWidget` authored-size hints, the exact per-widget strategy classification, and flags identifying content-sizing requests. Its descendants are measured before their parent; the result keeps original document order for deterministic placement.

Arrangement consumes parent width/height constraints top-down, maintaining inherited visibility and clipping. It does not silently infer a text/image intrinsic size, modify a relative axis to feed parent content sizing, or manufacture native Grid/Wrap/Scroll coordinates. A new `unresolved-size-to-content` diagnostic explicitly names the requested axes. The original one-call `BuildAuthoredGeometrySnapshot` remains a compatibility convenience wrapper over the two passes.

**Performance caveat:** this architectural separation is about eliminating duplicate geometry computations when a measured tree is reused, not a demonstrated FPS increase. The live React Canvas has **not** been switched over. No cross-frame caching or guessed invalidation has been introduced.

**New validation:** `tests/layout-measurement.test.mjs` checks nested fixed and relative dimensions, top-down root constraints at multiple resolutions, measurement reuse, hidden descendants, managed-container diagnostics, content sizing uncertainty and nonwidget filtering. The existing canvas/editor geometry parity tests remain in place.

The pinned Workbench disassembly supports a real distinction: shared spacer dimension negotiation at `0x1408E05D0` is called before the Grid and Wrap measurement routines process their specialized children. That does **not** yet establish how exact/relative content size should be determined for Text, Image, Scroll, or every other control. Widget-specific measurement handlers must be added only when their semantics have independent evidence.

**Next validation gate:** trace authored flags to compiled measurement setters, and define a constrained strategy interface that accepts the shared measured tree and emits child rectangles with explicit evidence/confidence. Until that is verified, this remains a read-only authored-geometry pipeline.


## Native-derived constrained grid strategy prototype (M3 preparation)

The native GridSpacer arithmetic and default-count helpers were **moved**, not copied, from `src/renderer/GridLayout.ts` to `src/renderer/engine/ConstrainedGrid.ts`. The previous public exports remain available as re-exports, preserving the experimental renderer and existing grid tests. The engine now has one implementation of that arithmetic.

`LayoutMeasurement.ts` decodes GridSpacer-only properties **once** into `nativeGrid` for a prepared node. The pinned Workbench binary supports default `Rows=3`, `Columns=3`, `Padding=2` (outer inset) and `Margin=2` (inter-cell spacing). These defaults are restricted to GridSpacer inheritance, not generalized to other widgets.

`LayoutArrangers.ts` centralizes widget-specific strategy dispatch. `GeometrySnapshot.ts` only performs common hierarchy traversal and applies rectangles returned by the strategy. To test a native-derived fixed-cell grid **without affecting the live canvas**, call:

```ts
const measured = MeasureLayoutTree(document.roots);
const preview = ArrangeMeasuredGeometry(
  measured,
  { x: 0, y: 0, width: 1920, height: 1080 },
  1,
  { constrainedGrid: true }
);
```

**Default behavior is still authored-coordinate diagnostics.** This prototype supports a constrained GridSpacer with configured/default positive counts and no content-sized axes. It refuses unverified cases including hidden immediate children, more children than grid slots, content-sized axes, and invalid container geometry. In these cases the snapshot retains authored child geometry and emits an `unresolved-layout-strategy` issue rather than guessing native clipping/visibility/overflow behavior. Other managed widget types (Wrap, Scroll, Content, etc.) remain unresolved. `appliedStrategies` records which native-derived paths were actually used.

`tests/native-grid-strategy.test.mjs` covers default and explicit settings, parity with the **same shared grid calculation**, nested child constraints, viewport resizing, unchanged default behavior, unsupported overflow and hidden children, and non-grid widget isolation. The existing `test:grid-layout` suite is also retained.

**Not yet recovered:** full native text/image intrinsic measurement, content-size feedback, hidden-child filtering, DPI-dependent inset scaling, all grid child flags, and Wrap/Scroll arrangement. Until these have independent Workbench verification, neither production rendering nor the editor's saved output should be changed on the basis of this prototype. Do not remove experimental URL flags as part of this stage.


## Intrinsic image/text measurement boundary (M2 extension)

The engine now accepts an optional `IntrinsicMeasurementProviders` callback pair in `MeasureLayoutTree(roots, { intrinsics: ... })`. The provider interface is **strictly leaf and class-specific**: `ImageWidgetClass` and `TextWidgetClass` only. No automatic measurement is assumed for Button, RichText, MultilineText, Scroll, Grid, other container widgets or arbitrary mod classes. Each provider returns independent width and/or height plus evidence provenance. Invalid or parent-dependent dimensions are ignored.

`ProjectIntrinsicSources.ts` converts the existing project imageset resolver's `logicalWidth/logicalHeight` into an image measurement; it does **not** pretend that a direct texture with `1×1` placeholder UVs is a one-pixel image. It accepts a resolver callback so caller-specific project/dependency/vanilla precedence can remain in the project layer, separate from layout. Text is **not** measured using Canvas CSS fallbacks: font-aware glyph shaping/metrics and native wrap behavior must be provided deliberately, and are not yet implemented for general text.

The two-stage diagnostic usage is:

```ts
const imageProvider = CreateImageIntrinsicProvider((reference) => {
  // Caller resolves project → dependency → vanilla via ResolveProjectImage.
  return resolveCurrentImageResource(reference);
});
const measured = MeasureLayoutTree(document.roots, {
  intrinsics: { image: imageProvider, text: optionalMeasuredTextProvider }
});
const diagnostic = ArrangeMeasuredGeometry(
  measured,
  { x: 0, y: 0, width: 1920, height: 1080 },
  1,
  { providedIntrinsicContent: true }
);
```

This optional preview ONLY applies provider measurements to a leaf `ImageWidgetClass` or `TextWidgetClass` that explicitly requests `Size To Content H/V`. Size-to-content axes are independent: the unsupported axis retains the authored size and a diagnostic; applied axes are labeled in `appliedIntrinsics` with their evidence. The **same** shared authored-geometry alignment formula recomputes right/center reference positions after a content-size change. Widgets with children, grid-allocated slots and other container types are excluded from this proto behavior.

This is a **structural integration test of a supplied resource size**, not evidence that Workbench always sizes Image/Text widgets to raw logical sprite or font metrics. Native scaling, imageset styles, crop flags, kerning/shaping, empty text, wrapping, SDF/FNT3 size tiers, resource fallback and editor zoom still require independent Workbench verification. In particular, a `TextWidgetClass` metric provider is accepted only when the caller knows its dimensions are parent-constraint independent; don't guess a value from CSS fontSize or the authored widget height.

The unchanged default snapshot and unchanged Canvas rendering protect current user layouts. Test coverage is in `tests/intrinsic-measurements.test.mjs`, including absence of provider, resource dimensions, partial axes, evidence tracking, alignment, and subclass isolation.


## Text metrics and width-dependent flow consolidation (M2/M3 research)

The new `TextLineMetrics.ts` consumes **existing parsed font metrics**, without introducing browser, CSS, or fallback font approximations:

- **FNT3:** glyph advances and pair kerning, scaled by an explicitly resolved display font size versus nominal size; a single-line measurement also reports the parser's line height. Unknown glyphs are **rejected** for intrinsic measurement rather than inventing their advance.
- **FSDF/FNT5:** single-line horizontal advance from the parsed resource's declared unit mode: reference FSDF advances in 1/1000 em, versus standalone FNT5 pixel metrics scaled by nominal font size. **Height is not provided**, because glyph cell size does not establish native content line height. Missing glyphs, invalid metrics, and multiline input are rejected.
- `CreateSingleLineTextIntrinsicProvider` requires the caller to supply the *actual resolved* font and font display size. It does not infer those from an authored widget rect or a CSS font. For `TextWidgetClass` only, any accepted dimensions still flow through the same **explicit opt-in** `providedIntrinsicContent` strategy and record their metric provenance.

The existing production FNT3 renderer now calls shared `MeasureBitmapAdvance(..., "renderer-fallback")` for its line widths. That mode intentionally preserves the renderer's existing half-nominal-width fallback on missing glyphs and pair-kerning arithmetic. The stricter intrinsic-measurement mode **does not** take this fallback. A frozen reference algorithm in `tests/text-line-metrics.test.mjs` verifies width behavior for representative strings, scales, Unicode and kerning.

The old SDF preview line-breaking function is now `WrapPreviewText` in `TextFlow.ts`, shared by the `SdfTextCanvas.tsx` renderer and pure preview measurement diagnostics. Its existing token/whitespace and oversized-identifier behavior is unchanged. `MeasurePreviewFlow` explicitly takes **available width**, and therefore its resulting height is **parent-constraint-dependent**, not an intrinsic size that can be used to resolve `Size To Content V` independently. Keep it out of native content-size strategy selection until Workbench constraint negotiation is recovered.

### Remaining native text and layout uncertainty

This cleanup proves consistency with NIH Studio's **current renderer**; it does not prove Workbench-equivalent text shaping, vertical baseline/ink alignment, ligatures, bidi scripts, font fallback, wrapping policy, scaling, or parent-child content extents. The native RTTI/vtable research documents the confirmed text-specific measurement override, but the full native glyph and alignment rules remain unresolved. In particular, neither the preview line-height multiplier nor the renderer's missing-glyph fallback should be asserted as Workbench native behavior.

The code remains pure and decoupled from rendering resources; the current canvas still paints all glyphs as before. Run `npm run test:geometry-engine` to check the consolidated metric and preview-flow suites, plus `npm run build` for integration. Do not enable native content sizing globally from this checkpoint.


## M2 constrained text height — width first, preview-only

The engine now supports a deliberately restricted **constraint-dependent text height** experiment, separated from the existing parent-independent intrinsic measurements:

```ts
const prepared = MeasureLayoutTree(document.roots, {
  constrainedText: CreateSdfPreviewTextPreparer((node) => {
    // Resolve the actual source SDF font and display size from the project.
    // Caller also explicitly chooses the current preview's lineHeight/wrap.
    return resolvedSdfFontSource(node);
  })
});
const snapshot = ArrangeMeasuredGeometry(
  prepared,
  { x: 0, y: 0, width: 1280, height: 720 },
  1,
  { constrainedTextPreview: true }
);
```

`ConstrainedText.ts` prepares the actual SDF font source **once per layout document revision**. Its per-width `measure(width)` callback calls the already-shared `MeasurePreviewFlow`, with strict source glyph/metric validation. It returns only the height for the specific arranged width, line count, width used, and `sdf-preview-flow` provenance. A future true Workbench measurer can use the same width-constrained boundary without inheriting the preview policy.

`LayoutMeasurement.ts` prepares this callback only for **leaf `TextWidgetClass`** with `Size To Content V=1` and `Size To Content H=0`. The horizontal size must already come from independent authored or parent-relative geometry. `GeometrySnapshot.ts` invokes the callback **after** horizontal arrangement, then recomputes vertical top/center/bottom alignment using the shared axis resolver. It checks finite positive height, positive line count and exact requested width before applying any result. `appliedConstrainedText` records all changes. If a source/axis is unsupported, an existing `unresolved-size-to-content` diagnostic remains, and authored geometry is retained.

**Never** infer a size-to-content width from width-wrapped text height (circular dependency), silently override grid-allocated child slots, or use this for `RichTextWidgetClass`, `MultilineTextWidgetClass`, controls, or nodes with children. The native text routine's separate width/height gates, now documented in `workbench-native-widget-scope.md`, support this architectural separation but do **not** establish the preview's line-breaking algorithm, font metrics, or height multiplier as Workbench-native.

`tests/constrained-text.test.mjs` verifies narrow/wide viewport heights, bottom reference realignment, unsupported horizontal feedback, missing font glyphs, zero width, parent/child and grid boundaries, optional mode isolation, source preparation reuse, precedence relative to independent metric sources, and stale/malformed measurement rejection.

This is diagnostic infrastructure only: **no live Canvas layout switch, no new editor URL flag, and no changes to native saved layout geometry**. Workbench parity for text wrapping and size-to-content parents still requires direct comparison fixtures and deeper native tracing. Avoid resource caches until explicit invalidation on document/font changes is designed.


## M2 bounded parent content negotiation (prototype)

The draft branch introduces `ParentContent.ts`, a **strictly bounded, acyclic, vertical-only** child-extent negotiation prototype. It accepts prepared geometry and a final available width; it does not resolve a parent's width from its children's wrapped heights. Its only allowed parent classes at this stage are ordinary `FrameWidgetClass` and `PanelWidgetClass` with `Size To Content V=1` and `Size To Content H=0`.

Given `MeasureLayoutTree` results, opt in explicitly:

```ts
const prepared = MeasureLayoutTree(roots, {
  constrainedText: optionalResolvedSdfPreparer,
  intrinsics: optionalFontAndImageProviders
});
const snapshot = ArrangeMeasuredGeometry(
  prepared,
  { x: 0, y: 0, width: 1280, height: 720 },
  1,
  { boundedParentContent: true, constrainedTextPreview: true }
);
```

The solver measures each direct child's vertical bottom extent and takes the maximum. A contributing child must be visible, top-referenced, with an exact vertical position, and with either a fixed exact height or a resolvable vertical size-to-content measurement. Relative horizontal child width is permitted because the parent's **width is already fixed by its own authored constraints**. A nested ordinary Frame/Panel may recursively resolve its own vertical size from children, subject to the same rules and a depth limit. No cross-frame cache is introduced.

**Explicitly refused:** bottom/center child alignment, parent-relative vertical position or height, unresolved content-size axes, horizontal content sizing, hidden children, empty content, and managed child layouts (Grid, Wrap, Scroll, etc.). A refused prototype leaves the authored height unchanged and emits both `unresolved-parent-content-dependency` with a specific reason/cause node and the existing `unresolved-size-to-content` issue. Applied parent extents appear in `appliedParentContent` with `bounded-child-extent-prototype` evidence.

The arrangement pass now uses a **pass-local WeakMap** to reuse validated text measurements between parent height negotiation and the child's own placement. This saves redundant font/line-break computation without assuming document or resource cache invalidation. Width-dependent measurements are validated for finite positive height, line count, and exact requested width before affecting any geometry.

**Evidence boundary:** this is a conservative diagnostic model of an acyclic dependency graph, not recovered native Workbench size-to-content behavior. It does not yet establish native inset inclusion, sibling visibility policies, child-bounding-box semantics, or the engine's iterative update scheduling. The previously recovered native TextWidget and SpacerWidget update paths demonstrate why separating measurement and arrangement is necessary, but do not prove the solver's extent formula. Workbench reference snapshots across Frame/Panel, Text, nested containers and size-to-content flags are required before enabling this in the actual Canvas.

`tests/parent-content.test.mjs` covers nested width-dependent measurements, rejection of cyclic vertical dependencies, optional source requirements, unsupported widgets and managed containers, and reuse of text measurements. All existing engine and renderer regression suites remain active.


## M3 managed container boundaries: opaque extents and native-derived fixed Wrap

Two distinct behaviors are now separated, rather than forcing a whole native Grid/Wrap/Scroll implementation into the parent size-to-content solver:

1. **Parent sizing of an opaque managed child:** a GridSpacer, WrapSpacer, ScrollWidget or other managed child with an exact authored outer height and no content-sizing flags can contribute **only that outer rectangle** to an ordinary Frame/Panel parent's bounded vertical extent. This uses shared authored geometry and does **not** use the managed child's still-unresolved internal child positions. A managed child requesting content height/width, a relative vertical size, hidden state, or unresolved parent-dependent position remains an explicit failure. Its own `unresolved-layout-strategy` diagnostic remains.
2. **Native-derived fixed Wrap layout prototype:** `FixedWrap.ts` implements only the pinned Workbench `WrapSpacerWidget` arrangement trace (`0x1408E0E80`): children advance across a line; the next child starts a new line if it exceeds the inner available width; each line advances Y by its maximum child height and the inter-element gap; horizontal mode 0 aligns start, mode 1 end, mode 2 center. The shared `SpacerSettings.ts` decoder owns the confirmed `Padding=2` outer inset and `Margin=2` inter-child gap defaults for Grid and Wrap, eliminating duplicate property parsing. `ConstrainedGrid.ts` reuses the same settings decoder.

Explicit diagnostic opt-in:

```ts
const measured = MeasureLayoutTree(roots);
const snapshot = ArrangeMeasuredGeometry(
  measured,
  { x: 0, y: 0, width: 1920, height: 1080 },
  1,
  { boundedParentContent: true, fixedWrap: true }
);
```

The fixed Wrap strategy is dispatched in `LayoutArrangers.ts` and does not add per-type branches to the shared snapshot walker. It **requires** a fixed-rectangle Wrap parent, all immediate children visible with positive exact authored widths and heights, and an overflow-free result. Non-start `content_valign`, unknown alignment modes, content-sized Wrap axes, content-sized children, relative child dimensions, oversized children, and content exceeding the available parent height are refused with the existing `unresolved-layout-strategy` diagnostic. It does **not** claim native child vertical alignment, visibility filtering, style/opacity, DPI scaling, overflow clipping or parent-size feedback; those remain open native-parity research tasks.

`tests/fixed-wrap.test.mjs` covers shared spacing defaults, exact class boundaries, line packing and max line heights, per-line horizontal alignment, inherited rectangle coordinates, parent extent negotiation, unknown native modes, invalid child metrics, and cross-widget isolation. `tests/parent-content.test.mjs` separately checks opaque fixed-height Grid/Wrap/Scroll contribution versus unresolved managed content sizing.

**Important distinction:** the new Wrap line flow matches the high-level behavior recovered from compiled instructions, but **pixel-perfect Workbench equivalence has not been established**. The runtime canvas and saved layout source remain unchanged; only diagnostic, explicitly selected prototype strategies are affected. The next research boundary is native visibility filtering, dynamic text/image measurement inside managed containers, full vertical alignment, and ScrollWidget content/viewport calculations.


## M3 Wrap vertical content measurement and authored Scroll viewport diagnostics

The current draft adds two diagnostic capabilities while preserving the shared two-pass geometry engine and the **unmodified production Canvas**.

**WrapSpacer vertical Size To Content:** `FixedWrap.ts` exposes `MeasureFixedWrapContent(children, resolvedWidth, settings)`. It uses the **same** native-derived line-packing logic as the existing `PlanFixedWrap` but reports the required outer height separately from the available height: the sum of line maximum heights plus inter-line `Margin` and two outer `Padding` insets. `PlanFixedWrap` now delegates to this shared calculation, refusing a fixed-height container if the content would not fit. This eliminates duplicate Wrap arithmetic.

`LayoutArrangers.ts` permits `ProbeWrapContentHeight` for a prepared `WrapSpacerWidgetClass` only with **both** `fixedWrap:true` and `wrapContentHeight:true`, a resolved independent width, `Size To Content V=1` and `Size To Content H=0`, visible immediate children with positive exact widths/heights, and start vertical alignment. Unsupported alignments, hidden or content-sized children, unresolvable metrics and invalid dimensions are refused. The measured plan carries both child rects and height into `GeometrySnapshot.ts` **without a second line-packing pass**. `appliedWrapContent` records the measured required height, line count and `native-derived-wrap-lines` evidence.

```ts
const prepared = MeasureLayoutTree(roots);
const wrapDiagnostic = ArrangeMeasuredGeometry(
  prepared, { x: 0, y: 0, width: 1280, height: 720 }, 1,
  { fixedWrap: true, wrapContentHeight: true }
);
```

This is **not** a claim of complete native Wrap measurement. It is a controlled extrapolation from the pinned Workbench line-formation algorithm. The exact native resizing triggers, child update order, DPI rules, visibility filtering, vertical content alignment and wrap interaction with other content-sized parents still require Workbench comparison fixtures. An ordinary Frame/Panel parent with a Wrap child that requests its own content height is deliberately **not** treated as a fixed opaque extent by `ParentContent.ts`; that dependency still reports an unresolved issue.

**ScrollWidget viewport boundary:** `ScrollViewport.ts` exposes a strictly read-only `MeasureAuthoredScrollViewport` that compares the **outer authored viewport** to a union of eligible immediate **authored child rectangles**. The resulting `scrollViewports` map reports viewport dimensions, direct-child bounds, and overhang on each edge with `authored-direct-child-bounds` evidence. This is available only via `{ scrollViewportDiagnostics: true }`. It requires finite, positive authored rectangles with exact child position/size, visible children, and no unresolved managed or content-sizing requirements.

This Scroll result is **not** a native content size, scrolling range, scroll offset, clipping flag, scroll-bar width, or proof of Workbench ScrollWidget behavior. It does not modify child positions, inherited clipping, the underlying renderer, or saved `.layout` geometry. The separate `unresolved-layout-strategy` diagnostic remains until native Scroll viewport/content and scrollbar methods are recovered.

```ts
const scrollDiagnostic = ArrangeMeasuredGeometry(
  prepared, { x: 0, y: 0, width: 1280, height: 720 }, 1,
  { scrollViewportDiagnostics: true }
);
```

`tests/wrap-content.test.mjs` verifies single-source line arithmetic, nested constraints and reflow across multiple widths, anchor realignment, independent feature gates and strict fallback. `tests/scroll-viewport.test.mjs` verifies authored direct-child overhang, negative coordinates, nested viewports, unsupported content/visibility/managed cases and unchanged default geometry. Both suites run under `npm run test:geometry-engine`.

**Native parity gate:** keep all three opt-in strategies (`fixedWrap`, `wrapContentHeight`, `scrollViewportDiagnostics`) disabled in the live canvas. Compare geometry to Workbench for at least two container dimensions, multiple child sizes and alignment modes before upgrading any of these from diagnostic hypotheses.


## M3 Scroll native content extent investigation

Native analysis used the **user-provided pinned** Workbench executable (SHA-256 `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`). MSVC RTTI identifies the primary `ScrollWidget` vtable at `0x142063160` with measurement slot 13 at `0x1408E0460` and arrangement/extent slot 14 at `0x1408E0C70`. The full instruction evidence is recorded in `docs/workbench-native-widget-scope.md`.

The Scroll extent routine initializes content width/height from the widget's own dimensions, then extends them to the maximum of each eligible child's measured **right and bottom** edges relative to an adjusted child context. It also performs scroll offset, available-viewport and scaling adjustments whose parameter/property mappings are still uncertain. This is not equivalent to simply taking the union of children's authored rectangles.

`EstimateNativeScrollExtent(authoredInspection)` now reproduces only the confirmed max-extent step under a **documented zero-offset, unadjusted-viewport assumption**, returning `evidence: "native-derived-scroll-extent-prototype"`. Callers enable this via `{scrollNativeExtentDiagnostics:true}`, separately from `{scrollViewportDiagnostics:true}`. The snapshot's `scrollExtentCandidates` map provides those independent candidates; it does not change authored widget geometry, clipping, ScrollWidget scroll position, content size, scroll range or scrollbar geometry.

The existing `ProbeScrollViewport` is reused to validate eligible exact/visible direct child positions **once**, then `EstimateNativeScrollExtent` operates on the same bounding edges. Only ScrollWidget nodes enter this path; the common walker does not contain scrollbar-specific formulas. Tests cover candidate extents, viewport baseline, negative authored positions, opt-in independence, unchanged geometry, and unsupported relative/hidden/managed child conditions.

**Parity gate:** verify the offset fields (`+0x178/+0x17C`), eligibility flag (`+0x159`), scrollbar byte flags (`+0x188/+0x189/+0x18C`), DPI-dependent reservation formula and clipping behavior against property reflection and representative Workbench layout fixtures. No runtime Scroll arrangement or scroll-range estimate should be enabled until that evidence is available.

## M3 native scrollbar viewport reservation boundary

Native inspection additionally recovered reflection property names `Scrollbar H`, `Scrollbar V` and `Scrollbar V Left`, alongside the ScrollWidget unscaled viewport-reservation constant **10.0** and a separate scale-dependent branch. The diagnostic-only `ScrollSettings.ts` module centralizes those three properties and refuses unrecognized values.

`ArrangeMeasuredGeometry(prepared, rootRect, 1, {scrollScrollbarViewportDiagnostics:true})` now reports an **unscaled child viewport candidate** per eligible ScrollWidget in `scrollAdjustedViewports`. When scrollbars are enabled, native measurement reserves 10 units for each applicable scrollbar; a left-side vertical bar shifts the child origin right 10 units. This does not change child coordinates, canvas scrolling, native clipping or persistence. When scale is not 1, content-sized Scroll widgets, or ambiguous scrollbar flags are encountered, the candidate remains absent. The source reflects the unit-scale **hypothesis**, not a verified mapping of Workbench's internal scaling mode to the editor DPI field.

Importantly, a Scroll widget with an active scrollbar no longer produces the older unadjusted maximum-extent candidate: that candidate requires all scrollbar flags disabled. This prevents two diagnostic models with conflicting viewport assumptions from being applied simultaneously. Native scroll offsets, clipping boundaries, scrollbar draw dimensions and scroll range remain unimplemented pending Workbench parity fixtures.


## M3 Scroll property-setter proof and explicit native-scale helper

The pinned Workbench property's **loader-to-field mapping** is now directly established in the compiled code, rather than inferred only from reflection strings: `Scrollbar H` → `+0x188`, `Scrollbar V` → `+0x189` and `Scrollbar V Left` → `+0x18C`. The new static verifier `scripts/verify-workbench-scroll.mjs` checks these writes and the matching measurement reads without launching or committing Workbench.

A separate native branch scales the scrollbar thickness by `contextC4 / contextCC` using single-precision arithmetic. `EstimateContextScaledScrollViewport(container, settings, { numerator, denominator })` reproduces **only this known arithmetic**, with explicit native-context integer inputs, sharing the same rectangle-reservation calculation as the existing unscaled diagnostic. It is deliberately *not* hooked up to `dpiScale`: the correspondence of these native context fields to any Studio/browser setting is not proven.

Run `npm run test:geometry-engine` for the pure arithmetic and synthetic PE tests. With a legitimately installed **matching** Workbench executable, `npm run verify:workbench-scroll -- "C:\\Path\\To\\WorkbenchApp.exe"` verifies the native research pin; other binary versions are correctly rejected. No executable, extracted binary asset or copyrighted layout is included in the repo.

**Native parity remains unverified:** scroll offset state, child eligibility, native clipping and scrollbar sizing under real Workbench scale contexts. Until independent reference observations are captured, default Canvas geometry and all opt-in Scroll diagnostics remain unchanged.


## M3 shared Ignore invisible child eligibility

Static native research established a common `Ignore invisible` property and default of `1` for the managed GridSpacer, WrapSpacer and ScrollWidget paths. `ManagedVisibility.ts` is now the single eligibility decoder and index selector, operating on each widget's prepared child list. The corresponding native code uses byte `+0x159` and calls an eligibility helper before visiting children.

- With `Ignore invisible=1` (native default), an invisible immediate child does not consume grid or wrap slots and does not contribute to Scroll direct-child authored bounds.
- With `Ignore invisible=0`, invisible children remain in the native layout candidate calculation but retain their original hidden rendering state.
- With an invalid flag value, no speculative native arrangement or Scroll extent diagnostic is applied.
- The shared geometry walker continues to retain **all** widgets in their original order. The strategy-specific plan is scattered back into original child-index positions; filtered-out children fall back to authored geometry without changing serialized layout.

`tests/managed-visibility.test.mjs` exercises decoding, stable indices, sparse slot allocation, the three widget families and invalid-value isolation. Native eligibility helper semantics, parent-inherited visibility and pixel parity still need comparison against Workbench fixtures. The production Canvas is unchanged.


## M3 explicit Scroll offset comparison (diagnostic-only)

`ScrollOffset.ts` contains two independent native-derived **read-only** functions, neither of which infers state from authored `.layout` files:

- `ProjectNativeScrollChildContext(viewport, {horizontal, vertical})` subtracts the explicitly provided native fields at widget offsets `+0x178/+0x17C` from the Scroll child-context origin. The viewport must be resolved separately. No child widget is relocated or clipped.
- `MeasureNativeScrollNormalizedPosition(inputs)` uses the native content extent `+0x180/+0x184`, widget size `+0x90/+0x94`, enabled scrollbar flags and independently known scrollbar thickness to calculate H/V range and normalized position. It rejects negative/invalid ranges; it does **not** reproduce setter clamp behavior.

To compare the first function in an engine snapshot, the caller must provide an explicit `scrollOffsetSamples` map **and** opt into `scrollScrollbarViewportDiagnostics` at the independently justified unscaled viewport:

```ts
const offsets = new Map([
  ["scroll-widget-id", { horizontal: 17, vertical: 23 }]
]);
const result = ArrangeMeasuredGeometry(prepared, root, 1, {
  scrollScrollbarViewportDiagnostics: true,
  scrollOffsetSamples: offsets
});
const projected = result.scrollChildContextCandidates.get("scroll-widget-id");
```

The candidate records `native-derived-scroll-child-origin` evidence and `explicit-native-offsets-no-clipping` assumptions. Missing/invalid offset samples, unsupported DPI context, and unrelated widget classes produce no candidate; they do **not** fall back to guessed offsets. The map is allocated per snapshot, and no sample is stored in or written to the layout itself. Production Canvas geometry, clipping and normal scroll interaction are unchanged. `tests/scroll-offset.test.mjs` now runs under `npm run test:geometry-engine`, covering pure geometry and snapshot isolation.

**Still required for actual native parity:** measured ScrollWidget content, viewport and offset values from the same Workbench runtime configuration; identification of inherited/native clipping rules; scrollbar visibility and layout flag interactions; and native runtime setter semantics. Until then these are comparison instruments, not an enabled native layout strategy.


## M2 common direct-child content envelope (2026-10-28)

The previous Frame/Panel bounded-height diagnostic and Scroll direct-child
inspection each performed their own child-edge bounding calculations. Those
pure arithmetic operations are now consolidated into
`src/renderer/engine/ContentBounds.ts`:

- `MeasureContentBounds(rects, options)` computes finite, non-mutating
  `left/top/right/bottom/width/height/childCount` for an already positioned
  set of **direct child** rectangles in one traversal. Fractional and negative
  origins are preserved. Empty, nonfinite, negative-sized, and overflowing
  envelopes are rejected, never partially measured.
- **ScrollWidget** still requires strictly positive child widths and heights
  and retains its own visibility, native extent and scrollbar uncertainty.
  Only the duplicate axis min/max aggregation was replaced.
- **Frame/Panel** bounded content-height still requires acyclic top-anchored
  children with independent widths and fixed or externally measured heights.
  This path explicitly permits a zero-height child and derives final height
  from `max(0, bounds.bottom)`. Managed layout, hidden child and unresolved
  relative-height cases retain their conservative failure diagnostics.
- **WrapSpacer** retains native-derived line packing and its width-dependent
  line-height algorithm. The shared bounds helper is checked against its
  arranged line rectangles in tests; it does not replace Wrap's specialized
  packing or pretend to establish native vertical sizing.

For cross-widget diagnostics, `ArrangeMeasuredGeometry` accepts opt-in
`{ directChildBoundsDiagnostics: true }` and returns
`snapshot.directChildBoundsCandidates`. This is an O(total widgets)
**post-arrangement** pass over the already computed local rectangles. It
includes every direct child, including hidden children and fallback authored
positions for unsupported layout managers; the result is **not** a native
content-size policy or final measured parent size. Duplicate IDs disable
the candidate pass rather than guessing parent associations. The default
pass does not incur this allocation/traversal.

The native-backed regression reconstructs immediate-child envelopes from the
independently captured 32 DayZ screen rectangles across the 1120×460 and
1440×900 root sizes. The candidate bounds agree under floating-point
tolerance, but the DayZ native getter capture did **not** provide Frame/Panel
content-width/height or clipping/scissor bounds. The computation is a reusable
mathematical primitive, **not proof** that every widget family uses the same
native inclusion rules or size-to-content policy.

Relevant tests:
`tests/shared-content-bounds.test.mjs`,
`tests/direct-child-bounds.test.mjs`, alongside the existing Frame/Panel,
Scroll and Wrap regressions. Production Canvas rendering, authored property
serialization, native DPI controls and final native content negotiation have
not changed.


## M2.1 native attribute compatibility isolation (2026-10-28)

The second in-game content probe gave us a concrete native tree difference,
not a sufficiently narrow C++ parser explanation. Ordinary Frame/Panel
parents authored with `Size To Content` (enabled) were constructed
without the expected descendants, verified by both independent
`FindAnyWidget` lookups and `GetChildren` counts. A fixed Frame
retained overhanging children; a native WrapSpacer retained its children
and grew from authored 20 to measured 28 height. This supports
**per-widget-family eligibility**, but not a general deletion rule for
unsupported attributes or a conclusion about native loader internals.

We now preserve these distinctions in a separate, isolated 14-case
property matrix, `tests/fixtures/workbench-content/NIH_ContentProperty_Matrix.layout`.
Each variant has exactly the same two authored children and 190×20
parent rectangle within its own Frame, Panel or Wrap family.
The control series varies only property *absence*, `0` versus `1`,
horizontal/vertical axis, `Size To Text V`, or `clipchildren`.
Its test-only `NIH_PropertyMatrixRuntime.c` companion records native
children and sizes **immediately after creation**, **after Update**,
and **after a root resize**; it runs only after the original v2 probe,
with a separate log prefix and strict extractor.

This enables the following distinctions without guessing:
1. If a zero-value attribute also removes children, **presence or
   parsing** rather than activation is implicated.
2. If `1` removes children but `0` does not, investigate **enabled
   property execution** on that class.
3. If children exist at creation but vanish after `Update`, investigate
   layout update behavior instead of initial widget construction.
4. Compare ordinary Frame/Panel to Wrap only for **eligibility and
   observed geometry**; do not transfer Wrap's native measurement policy
   to another widget class.

No new native result exists for this matrix yet. Existing v1/v2 data
remain immutable. `ContentSizingRequests` stays passive and the
`boundedParentContent` Frame/Panel prototype remains explicit opt-in.
The production Canvas must not suppress children or apply native
content-size overrides based on unconfirmed parser hypotheses.

## M2.1 native matrix independently confirmed (2026-10-28)

The full DayZ client `script_2026-10-28_14-50-18.log` provides
three complete native property-matrix capture phases, preserved as
timestamped [filtered getter evidence](../tests/fixtures/workbench-content/capture.property-matrix.native.2026-10-28.log)
and [machine-readable native records](../tests/fixtures/workbench-content/capture.property-matrix.native.2026-10-28.json).
`tests/native-content-property-matrix.test.mjs` re-parses and verifies
all 42 native case observations.

**Observed:** `Size To Content V=0` and `=1` on the tested
ordinary Frame/Panel both correspond to zero native descendants
immediately after `CreateWidgets`. The no-flag and clipchildren
controls retain their descendants; WrapSpacer with V=0 retains
its two children and authored 20 height, while V=1 changes to
measured 28 height with both children retained. All 14 native
case values persist unchanged after update and resize.

**Inference boundary:** This establishes a **class-dependent
native property-presence effect in the tested loader context**.
No C++ parser implementation or reasons for token recovery are
exposed by these getters. Shared extent arithmetic must remain
separate from native parser eligibility; do not suppress parsed
children or mutate serialization to reproduce the anomaly.

## M2.2 independent native property syntax isolation (2026-10-28)

The tested native Frame/Panel hierarchy loses children when certain
sizing properties appear, **including when the flag is 0**, while a
known `clipchildren=1` property and the no-attribute control do not.
These are independently observed hierarchy results, not a C++
tokenizer recovery.

The new forensic matrix isolates **12 resource files**, one test
parent and two identical nested children each. It separately compares:
property absent, `Size To Content V=0` before and after children,
deliberately unknown `NIH_ProbeUnknown=0` before and after, and
a recognized `clipchildren=1` before and after (Frame), with
matching baseline, sizing and unknown-attribute cases for Panel.
One `CreateWidgets` call per resource avoids cross-case parser
contamination. The disposable client script captures both
after-creation and after-update native parent/child existence and
dimensions; a failed resource load is explicitly recorded.

The protocol is [PROPERTY-SYNTAX.md](../tests/fixtures/workbench-content/PROPERTY-SYNTAX.md)
and the strict extractor is `scripts/extract-workbench-property-syntax.mjs`.
**This stage has not run in DayZ**; results must not be inserted into
the unified runtime engine until independently captured and validated.
Production Canvas and serialization remain unchanged.

## M2.2 native parser-order conclusion (2026-10-28)

The DayZ client loaded all 12 independent resource files in
`tests/fixtures/workbench-content/syntax-matrix/`.
The 24 native getter records are preserved as original filtered
log lines and structured JSON, with a regression that reparses
and verifies every result.

On tested Frame/Panel parents, both the unsupported-looking
`Size To Content V=0` property and a deliberately unknown
`NIH_ProbeUnknown=0` property suppressed *subsequently authored*
children when placed before the child group, but preserved both
when placed afterward. Recognized `clipchildren=1` retained
children in either location. All parents existed and all child
counts were stable before and after `Update`.

This supports a **general native source-loader parsing and
attribute-order effect** for these examples, distinct from a
content-bound measurement formula. The exact C++ error recovery
path is still not recovered. Do not implement an automatic child
filter in Canvas or strip attributes from exported layouts.
Keep the geometry engine pure; a future read-only
native-compatibility diagnostics layer may classify
unsupported property names by widget family, provided evidence
is available.

Full evidence:
[actual native result](../tests/fixtures/workbench-content/2026-10-28-property-syntax-native-results.md),
[raw probe lines](../tests/fixtures/workbench-content/capture.property-syntax.native.2026-10-28.log),
[structured native getters](../tests/fixtures/workbench-content/capture.property-syntax.native.2026-10-28.json).
