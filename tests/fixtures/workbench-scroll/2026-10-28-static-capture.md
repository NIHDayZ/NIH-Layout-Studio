# Workbench ScrollWidget static capture — 2026-10-28

**Evidence:** Five user-supplied Workbench screenshots in the project conversation (full editor, and four panels from the `ScrollLeft` property inspector). Screenshots remain in the conversation; none are checked into this repository. This is **observational evidence**, not native numeric viewport telemetry.

## Verified environment visible in the capture

- DayZ Workbench (bottom status text appears to show version **1.30.164200.56**; confirm if needed for binary-to-build matching).
- Opened the original `NIH_Scroll_Parity.layout` fixture, with `NIHScrollParity` as root.
- Root size: `1120 × 460`, editor zoom: `46%`, **Root DPI scaling unchecked**.
- `ScrollLeft` property panel: `X=860`, `Y=78`, `W=240`, `H=180`; `Scaled` checkbox checked, `Clipchildren` checked, `Ignore invisible` checked.
- `Scrollbar H`, `Scrollbar V`, and `Scrollbar V Left` are checked for `ScrollLeft`.
- All four panels load and display their `ORIGIN` controls. Their `OVERHANG` buttons are **partially visible** at the lower boundary; the capture shows apparent clipping, but does **not** establish pixel-precise native clip geometry.
- Static preview shows a right-side vertical scrollbar on `ScrollVertical`, right-side vertical plus bottom horizontal bars on `ScrollBoth`, and a **left-side** vertical plus bottom horizontal bars on `ScrollLeft`. `ScrollNone` shows neither bar.

## Important limits

The user confirms that **interactive scrolling cannot really be tested in this Workbench layout editor**. This is not evidence that scrolling is broken at runtime. No wheel, dragging, or button interaction was successfully exercised; consequently native offset setters, scroll range, clipping while content moves, and input interaction remain **not tested**.

The snapshot uses `46%` editor **zoom** and Root DPI scaling disabled, but `ScrollLeft`'s own **Scaled** property is checked. The native branch that selects the unscaled 10-unit scrollbar formula uses a widget flag and context fields whose relationship to these UI controls is not fully established. Do **not** convert an approximate screenshot bar width to a definitive 10-native-unit parity claim or infer that the UI zoom is the context scaling ratio.

The four cases in `capture.template.json` must keep `observed: null` until a native runtime tool provides actual child viewport and child-context measurements. Workbench **visual** observations belong in `capture.visual.2026-10-28.json` and do not count as numeric parity passes.

## Status and next test environment

| Feature | Captured observation | Confidence |
|---|---|---|
| Four original Scroll panels load | Yes | Direct screenshot |
| Vertical bar on right | Yes, Vertical and Both | Direct screenshot |
| Horizontal bar at bottom | Yes, Both and Left | Direct screenshot |
| Left-positioned vertical bar | Yes, Left | Direct screenshot and property inspector |
| `Clipchildren` on ScrollLeft | Checked | Direct property screenshot |
| `Ignore invisible` on ScrollLeft | Checked | Direct property screenshot |
| Content outside initial visible area | Partially obscured at lower boundary | Visual, not numeric clip bounds |
| Scroll offset updates | Not tested | Editor lacks usable interaction |
| Wheel/drag behavior | Not tested | Editor lacks usable interaction |
| Correct native scroll position normalization | Not tested | Requires runtime context values |

**No further Workbench screenshots of this static layout are necessary.** Any future functional scroll validation should run a minimal layout in a **DayZ runtime UI**, where mouse wheel and scrollbar movement are available, and gather both before/after visuals plus native viewport/offset readings if such instrumentation is available. Do not enable real ScrollWidget placement or clip logic in production Canvas based on these static screenshots alone.
