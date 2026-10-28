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
