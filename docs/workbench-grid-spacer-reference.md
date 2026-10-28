# Workbench grid and spacer reference notes

Source: user-supplied DayZ Tools archive, inspected as data only (no executable launched).
These notes describe bundled resources, not a reimplementation of unpublished native code.
Do not commit or redistribute binary Workbench resources or extracted vanilla layouts.

## Reference assets

- `Bin/Workbench/dta/gui.pbo`: 227 `.layout` files; 132 reference `GridSpacerWidgetClass`.
- `gui/layouts/examples/spacertest.layout`: nested GridSpacer and WrapSpacer, mixed exact and relative child sizes, `Columns`, `Rows`, and size-to-content.
- `gui/layouts/examples/spacertest2.layout`: grid with both exact-size and relative-size children, horizontal/vertical size-to-content enabled.
- `gui/layouts/examples/scrolltest.layout`: WrapSpacer with vertical size-to-content nested in a ScrollWidget.
- `Bin/Workbench/dta/scripts.pbo`, `1_Core/proto/EnWidgets.c`: `GridSpacerWidget` and `WrapSpacerWidget` derive from `SpacerWidget`. The exposed declarations do **not** define their native C++ layout algorithms.
- `3_Game/gui/spacers/*.c`: separate **scripted** layout helpers. They should not be conflated with native `GridSpacerWidget` or `WrapSpacerWidget`.

## Supported observations

- Both exact-size and parent-relative children appear in native grid example layouts.
- `Columns`, `Rows`, `Margin`, `Padding`, `Size To Content H/V`, and `content_halign/content_valign` appear in shipped layouts.
- A static grid can declare fewer rows than it has child widgets; treat row count as a configuration input, not as permission to silently discard widgets.
- Measuring a parent-relative child's current size and feeding that measurement back into the parent can make an editor's intrinsic-size computation self-referential.

## Current experimental renderer

`experimentalGridLayout=1` enables the provisional grid model. Measurement and placement share `GetGridPlan`; parent-relative dimensions do not contribute to intrinsic sizing, but their resolved render bounds are retained. `Margin` is recognized as an inter-item spacing input.

This prevents one feedback loop, **not** proof of native Workbench parity. A relative child can still visually overflow a content-sized parent, and native cell sizing, padding, visibility handling, alignment and mixed exact/relative sizing need comparison against Workbench before enabling by default.

## Regression matrix for Workbench

1. `gui/layouts/examples/spacertest.layout`: mixed-size nested grid and wrap.
2. `gui/layouts/examples/spacertest2.layout`: relative-size cells with size-to-content on both axes.
3. `gui/layouts/examples/scrolltest.layout`: spacer sizing in a scrolling parent.
4. `gui/layouts/day_z_hud.layout`: nested bottom-referenced grid and overlapping status variants.
5. `gui/layouts/inventory_new/medium/day_z_inventory_new.layout`: inventory layout with varied nested spacers.

Match root resolution and preview zoom between Workbench and Studio. Compare both positions and element dimensions; avoid widget-name-specific offsets or hardcoded layout filenames.

## Workbench presentation comparison (opt-in)

The shipped `gui/fonts/MetronBook.xml` font generator lists 12, 14, 16, 22, 28, 48 and 58 px tiers. The default CSS fallback's 32 px cap visibly undersizes the button labels in `spacertest2.layout` (60 px cells). `experimentalWorkbenchControlFonts=1` tries the largest available tier not exceeding each button height, only for CSS fallback buttons using a recognized Metron font family. It does **not** affect explicit text sizes, parsed FNT3/FNT5 resources or unfamiliar mod fonts. Native font sizing is still subject to visual confirmation.

The Workbench comparison screenshot's editor canvas is approximately RGB(130,130,130). `experimentalWorkbenchBackdrop=1` changes **only the Studio canvas preview** to that neutral gray, allowing transparent sprite compositing to be compared against the same backing color. This must not be confused with the color of the game's live HUD or a layout's actual background. The default preview stays unchanged.

Use these presentation flags together with `experimentalGridLayout=1` to compare styled buttons at matched root resolution and zoom. The Workbench background and Metron sizing are experimental diagnostics, not established engine parity.
