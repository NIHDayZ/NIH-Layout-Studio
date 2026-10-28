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
