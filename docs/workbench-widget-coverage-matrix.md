# DayZ Workbench widget inventory and NIH Layout Studio parity matrix

**Scope:** all widget families, not solely `GridSpacerWidget` and `WrapSpacerWidget`.
**Evidence:** user-supplied DayZ Tools, `Bin/Workbench/dta/gui.pbo` and `scripts.pbo` (`1_Core/proto/EnWidgets.c`); static RTTI string inspection of `WorkbenchApp.exe`; current Studio `src/components/Canvas.tsx`, `src/renderer/LayoutMath.ts`, and `src/project/ProjectWorkspace.ts` from PR #45. No binary is committed or executed.

## Census and reproducibility

The 227 vanilla GUI `.layout` files contain **9,524 widget declarations in 31 distinct classes**. Counts are declarations, not unique screens or evidence of native correctness.

The most common families also appear across many **different layout files**: Panel (159 files), Text (157), Frame (147), GridSpacer (132), Image (126), Button (100), WrapSpacer (84), and Scroll (42). These layout-level counts demonstrate why the core geometry, painting, and scrolling contracts deserve broader priority than any one comparison screenshot. The scripts API declares 29 widget-related classes (including abstract/base classes and a nonwidget event handler); it is **not exhaustive** for specialized Workbench/DayZ widgets. RTTI class-name strings are supplemental discovery indicators, **not** proof of particular virtual methods or layouts.

Re-run against a local, legally obtained Workbench install:

```powershell
node scripts/audit-workbench-widgets.mjs "D:\\DayZ Tools\\Bin\\Workbench\\dta\\gui.pbo" "D:\\DayZ Tools\\Bin\\Workbench\\WorkbenchApp.exe"
node scripts/audit-workbench-widgets.mjs "D:\\DayZ Tools\\Bin\\Workbench\\dta\\gui.pbo" --json > widget-census.json
npm run test:widget-census
```

The census does not redistribute extracted layouts, inspect executable behavior, or use OCR. Changes in DayZ Tools releases should produce new dated baselines rather than silently replacing these counts.

## Parity terminology

- **Partial preview**: some visuals appear, but native geometry, style, state, or interaction is incomplete.
- **Container only**: hierarchy or clipping may render, but specialized widget semantics are missing.
- **Experimental**: opt-in algorithm, not sufficiently cross-validated against Workbench.
- **Unsupported**: no native-equivalent presentation or behavior is implemented.
- **Not audited**: a class may have an incidental generic representation; no native parity test exists.

Every row below needs a Workbench golden fixture, including smaller or user-authored fixtures where a shipped layout cannot isolate the behavior.

## Class-by-class inventory (source-based)

| Workbench layout class | Count | Current Studio rendering | Main gap / next verification |
|---|---:|---|---|
| ImageWidgetClass | 1,913 | Partial preview | Image flags, aspect/UVs, alpha composition, atlas variant resolution, inherited state |
| PanelWidgetClass | 1,629 | Partial preview | Native style/color behavior, alpha inheritance, children and clipping |
| TextWidgetClass | 1,403 | Partial preview | Native glyph metrics, exact text size, line-break, outline/shadow, font fallback |
| FrameWidgetClass | 1,210 | Container only | General alignment, scaling, clipping, parent and child sizing |
| GridSpacerWidgetClass | 1,149 | Experimental | Native measure/arrange, fixed vs size-to-content, row/column defaults, visibility |
| ButtonWidgetClass | 737 | Partial preview | Control text proportion, styles and states, hit-test/focus |
| MultilineTextWidgetClass | 339 | Partial text | Native multiline wrapping and line spacing |
| RichTextWidgetClass | 292 | Partial text | Rich markup, inline images, content height/offset and line layout |
| WrapSpacerWidgetClass | 261 | Experimental/incomplete | True line wrapping, measurement, content alignment and flexible children |
| EditBoxWidgetClass | 126 | Partial preview | Native input behavior, text offset, selection/caret, styles |
| WindowWidgetClass | 57 | Generic container; not audited | Window chrome, hierarchy, focus and modal semantics |
| ScrollWidgetClass | 54 | Clipping only | Native content extents, scroll offsets, scrollbar and child position |
| ItemPreviewWidgetClass | 52 | Unsupported | 3D item render target/asset preview, controls and fallback |
| SliderWidgetClass | 51 | Partial preview | Native min/max, fill/handle, step and states |
| CheckBoxWidgetClass | 48 | Partial preview | Checked state and appearance, focus and text placement |
| ProgressBarWidgetClass | 47 | Partial preview | Bar/texture fill, clipping, color and range semantics |
| TextListboxWidgetClass | 40 | Generic preview | Columns, rows, selection, scrolling and data-driven contents |
| CanvasWidgetClass | 27 | Container only | Script-drawn line primitives and canvas pixels |
| ContentWidgetClass | 20 | Generic container | Content measurement, alignment and native sizing |
| XComboBoxWidgetClass | 18 | Partial preview | Item dropdown, selection, popup placement |
| SpacerWidgetClass | 17 | Container only | Native spacer-base content alignment and sizes |
| ThreeStateCheckboxWidgetClass | 10 | Generic control | Three-state transitions and style states |
| MultilineEditBoxWidgetClass | 6 | Partial text/control | Text editor wrapping, caret and scrolling |
| PlayerPreviewWidgetClass | 4 | Unsupported | 3D character rendering and pose/slot behavior |
| MapWidgetClass | 3 | Placeholder | Map textures, transforms, markers and interactive pan/zoom |
| EmbededWidgetClass | 3 | Container only | Embedded external layout loading and inherited constraints |
| VideoWidgetClass | 3 | Unsupported preview | Media surface and placeholder behavior |
| HtmlWidgetClass | 2 | Unsupported | HTML document surface and flow |
| ServerBrowserWidgetClass | 1 | Unsupported | Dynamic server entries and specialized presentation |
| PasswordEditBoxWidgetClass | 1 | Partial input/control | Password masking and native styling |
| SmartPanelWidgetClass | 1 | Generic container | Specialized sizing and layout semantics |

Native `EnWidgets.c` additionally exposes base and API types not necessarily instantiated in these layouts: `Widget`, `UIWidget`, `WorkspaceWidget`, `SpacerBaseWidget`, `BaseListboxWidget`, `SimpleListboxWidget`, `RenderTargetWidget`, `RTTextureWidget` and others. RTTI contains further compiled widget classes (e.g., `GenericListboxWidget`, `UniversalListboxWidget`, `ConsoleWidget`, `MenuStripWidget`, `DiagMenuWidget`, `BasicGraphWidget`). A **layout census is not a complete native class inventory**; those classes also require a second stage of signature/property inspection.

## Shared runtime behavior to recover before more per-widget fixes

**Phase A — Common widget geometry.** Parent-child transforms, pixel vs normalized units, anchoring (`*_ref` and plain), content reference points, padding/margins, DPI/safe-zone, rotation, z/sort, clipping, flags, visibility and size-to-content. Establish a measurement pass followed by an arrangement pass that produces immutable rectangles; `Canvas.tsx` should consume geometry rather than compute it recursively.

**Phase B — Layout managers.** Grid equal-cell versus content-sized modes; native 3×3 defaults, explicit counts, spacing; WrapSpacer line formation/alignment; ScrollWidget content measurement and clipping; embedded layouts. The native-spacer static-analysis report documents confirmed function addresses and unknowns. Do not automatically apply an experimental rule to all spacer types.

**Phase C — Shared presentation and typography.** Widget style state resolution, nine-slice rendering, texture filtering, imageset mpix choice, alpha/opacity inheritance, font sizes/metrics, RichText and multiline wrapping. Differentiate editor theme from native layout appearance.

**Phase D — Control mechanics.** Button/check/slider/edit/combobox/list controls; focus and keyboard state; inputs versus preview-only behavior. Implement static Workbench parity before interactive editing parity, with clear placeholder policy for runtime data-driven contents.

**Phase E — Specialized surfaces.** Inventory/player previews, map, video, HTML, script-driven canvas, server browser, embedded/layout-host behavior. Some require unavailable engine rendering resources; mark as unsupported rather than drawing misleading proxies.

## Cross-layout regression suite

Use the same root resolution and zoom; compare *canvas-relative* child rectangles and representative pixels. These files test different system behaviors:

| Fixture | What it stresses |
|---|---|
| `gui/layouts/examples/spacertest.layout` | Unconfigured and explicitly configured grids, nested wrap, sizes exceeding parent |
| `gui/layouts/examples/spacertest2.layout` | 3×3 grid, fixed/relative child sizes, content sizing, button styles |
| `gui/layouts/examples/scrolltest.layout` | Nested scroll and size-to-content |
| `gui/layouts/day_z_hud.layout` | Bottom-reference alignment, alternative status states, images and fonts |
| `gui/layouts/inventory_new/medium/day_z_inventory_new.layout` | Deep containers, previews and controls |
| `gui/layouts/day_z_map.layout` | Specialized map surface |
| `gui/layouts/day_z_book.layout` | Embedded HTML and text |
| `gui/layouts/script_console/script_console.layout` | Mixed widgets and complex controls |

For every discovered discrepancy, record: **source property**, **expected native geometry/state**, **Studio geometry/state**, **root resolution**, **asset variant**, and **test case**. Avoid patches conditional on layout filenames, node IDs or widget names.

## Exit criteria for merging architecture work

1. A common measure/arrange API owns child geometry, with well-defined native-property translations.
2. Grid, wrap and scroll behavior have independent tests at multiple resolutions and nested depths.
3. No regression in FNT5/FNT3 rendering, imageset assets, styles, text, or existing controls.
4. Representative screenshots show comparable placement, sizes and colors at matched preview parameters.
5. Every supported widget family has an explicit coverage status; unsupported specialized surfaces remain honest placeholders.
6. Experimental feature flags can be removed only after cross-layout evidence supports the change.

**This report is a dated baseline, not a claim that all 31 classes are fully implemented or that the entire native C++ algorithm has been recovered.**
