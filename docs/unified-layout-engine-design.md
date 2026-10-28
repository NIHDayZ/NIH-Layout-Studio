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

Only turn off the current experimental URL flags after the new engine passes representative tests. PR #45 remains unmerged while the architecture and native rules are investigated.

## Reference datasets and reproducibility

Use a **local** Workbench install for golden images and geometry notes. Keep proprietary PBO/EDDS/executable assets out of the repository. Commit manually generated fixtures with explicit original property values and expected coordinates where licensing permits, or store only numerical measurements and hashes. The `scripts/audit-workbench-widgets.mjs` tool can repeat the class inventory when DayZ Tools changes.

Prioritize wide coverage from bundled vanilla examples and additional mod layouts, not the order in which a mismatch was first noticed.
