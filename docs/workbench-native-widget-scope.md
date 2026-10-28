# Native widget surface: script API, shipped layouts and RTTI

This is a **cross-source inventory** based on the user-supplied DayZ Tools archive. It broadens the native audit beyond the currently tested grid and wrap classes.

## Three distinct sources, three different meanings

| Evidence | Count | What it establishes |
|---|---:|---|
| `scripts.pbo` `1_Core/proto/EnWidgets.c` | 29 class declarations in the widget-related hierarchy, including the event handler | Public script inheritance and methods; not a full native implementation list |
| `gui.pbo` | 31 different `*WidgetClass` names across 227 layouts, 9,524 declarations | Native layout classes used in these particular shipped GUI files |
| WorkbenchApp.exe RTTI | 42 distinct `*WidgetClass@enf` type-name strings | Compiled class-name candidates in the engine; **not** independently proven function addresses |
| WorkbenchApp.exe RTTI | 104 `Widget`-containing type-name candidates under `@enf` | Includes runtime classes, class descriptors, style/helpers and interfaces, not 104 separate visual widgets |

RTTI extraction was performed by scanning MSVC type-name strings (`.?AV…@@`) in the pinned Workbench executable. A class string on its own is not verified inheritance, virtual-method provenance or behavior. Specific spacer methods were independently validated with RTTI complete-object-locator/vtable traversal in `workbench-native-spacer-static-analysis.md`.

## All engine RTTI WidgetClass name candidates

```text
BaseListboxWidgetClass        BasicGraphWidgetClass
ButtonWidgetClass            CanvasWidgetClass
CheckBoxWidgetClass          ConsoleWidgetClass
ContentWidgetClass           DiagMenuWidgetClass
EditBoxWidgetClass           EmbededWidgetClass
FrameWidgetClass             GenericListboxWidgetClass
GridSpacerWidgetClass        ImageWidgetClass
MultilineEditBoxWidgetClass  MultilineTextWidgetClass
PanelWidgetClass             PasswordEditBoxWidgetClass
ProgressBarWidgetClass       RTTextureWidgetClass
RenderTargetWidgetClass      RichTextWidgetClass
RingBufferGraphWidgetClass   ScrollWidgetClass
SimpleListboxWidgetClass     SimpleProgressBarWidgetClass
SliderWidgetClass            SpacerBaseWidgetClass
SpacerWidgetClass            StyledWidgetClass
TextListboxWidgetClass       TextWidgetClass
TimeBasedGraphWidgetClass    TimeBasedGraphWithAxesWidgetClass
UIWidgetClass                UniversalListboxWidgetClass
VideoWidgetClass             WidgetClass
WindowWidgetClass            WorkspaceWidgetClass
WrapSpacerWidgetClass        XComboBoxWidgetClass
```

All names above carry the `@enf` suffix in the binary's type-name strings. The list **does not** include every specialized non-`enf` class (such as `ItemPreviewWidgetClass`, `PlayerPreviewWidgetClass`, `HtmlWidgetClass`, `MapWidgetClass`, `ThreeStateCheckboxWidgetClass`, `SmartPanelWidgetClass`, `ServerBrowserWidgetClass`), several of which appear in actual GUI layouts. The inventory therefore uses **union**, not intersection, of sources.

## Public script API inheritance families

The `EnWidgets.c` declarations show these key relationships:

- `Widget` → `TextWidget` → `MultilineTextWidget` and `RichTextWidget`; `MultilineEditBoxWidget` also inherits `TextWidget`.
- `Widget` → `UIWidget` → `ButtonWidget`, `EditBoxWidget`, `SliderWidget`, `CheckBoxWidget`, `ProgressBarWidget` (via `SimpleProgressBarWidget`), `XComboBoxWidget` and listbox bases.
- `Widget` → `UIWidget` → `SpacerBaseWidget` → `SpacerWidget` → `GridSpacerWidget` and `WrapSpacerWidget`; `ScrollWidget` inherits `SpacerBaseWidget`.
- `Widget` → `ImageWidget`, `VideoWidget`, `RenderTargetWidget`, `RTTextureWidget`, `CanvasWidget`, `WorkspaceWidget`.

Shared methods on `Widget` include position/size, screen position/size, color and alpha, rotation/transform, visibility, parenting, flags, sort order and update. These are **cross-cutting behaviors** for the proposed layout engine and renderer, not reasons to implement each class independently.

The `WidgetFlags` declaration also documents exact/relative position and size, source-alpha and blending, texture filtering, clipping, and pointer/focus options. Studio support must be verified per flag, rather than assumed because a widget class parses successfully.

## Scope boundaries for the next native recovery pass

1. Trace base `Widget` / `UIWidget` measurement, geometry and rendering calls, including their vtable overrides. Confirm class relationships by RTTI base class descriptors, not just names.
2. Trace native style/image/alpha/text paths independently from placement; distinguish texture variant selection from widget color modulation.
3. Implement a unified typed property model and measure/arrange strategy layer; verify shared geometry on Frame, Panel, Text, Image, Button and container widgets.
4. Trace Grid, Wrap and Scroll specializations against shared logic.
5. Establish explicit fallback and placeholder policies for runtime-driven map, inventory, HTML, video and 3D preview widgets.

No proprietary binary or extracted source file is committed. This inventory is a **discovery baseline**; it does not assert equivalence to native C++ or universal WidgetClass coverage.


## Native Text/Image measurement override boundary (second pass)

Verified MSVC RTTI complete-object-locators and virtual tables in the **same pinned** `WorkbenchApp.exe` used for the spacer research. Relevant primary vtables and virtual slot 13 (0-based index) are:

| Class | Primary vtable VA | Slot 13 |
|---|---|---|
| `enf::Widget` | `0x142066648` | `0x1408BCE70` |
| `enf::ImageWidget` | `0x142064418` | `0x1408BCE70` |
| `enf::TextWidget` | `0x14205CC88` | `0x140898520` |
| `enf::MultilineTextWidget` | `0x14205D100` | `0x140898520` |
| `enf::RichTextWidget` | `0x14205DCC0` | `0x140898520` |

The text-specific `0x140898520` routine **first calls the shared base `0x1408BCE70`**, calls a virtual text-related method at vtable offset `+0xF8`, reads width/height from `[widget+0x90/+0x94]` and a second pair from `[widget+0xD0/+0xD4]`, then calls `0x1408B8940` with those pairs and the measurement context. It updates the widget position floats at `[widget+0x88/+0x8C]` using the resulting vector. The visible instructions do not by themselves identify whether this adjusts a text baseline, glyph bounds, or another alignment reference.

**Conclusions supported by compiled code:** TextWidget has an additional measurement/geometry override; ImageWidget currently shares the base Widget routine in that slot. Therefore the common measurement pipeline should dispatch type-specific intrinsic providers for text versus images rather than equate their behavior. **Still unknown:** exact native text shaping, line wrapping, font fallback, glyph scale, ImageWidget's content-size semantics outside this slot, and the role of style-derived sizes.

This is a method-attribution boundary only, **not** a complete C++ source recovery or proof that native ImageWidget uses logical imageset dimensions for its final rectangle. The new TypeScript resource provider remains explicitly opt-in, separate from the production renderer.


## TextWidget size renegotiation: independent gates (third pass)

The same pinned `WorkbenchApp.exe` (SHA-256 `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`) provides an additional concrete distinction between text measurement and size-to-content feedback:

- The primary `enf::TextWidget` vtable at `0x14205CC88` has virtual slot **31** at `0x140885530`. This is distinct from its virtual slot 13 measurement override at `0x140898520`.
- `0x140885536` checks byte `[widget+0x151]` and `0x140885544` checks `[widget+0x152]` before triggering a text geometry helper (`0x1408931F0`) and a virtual call at vtable offset `+0x120`.
- When byte `[widget+0x151]` is nonzero, the method compares and updates **width** at `[widget+0x90]` from the returned integer size at `0x14088557C–0x140885594`.
- When byte `[widget+0x152]` is nonzero, it also checks **bit 23** in the widget flags at `[widget+0xA8]` before comparing and updating **height** at `[widget+0x94]` (see `0x1408855A5–0x1408855E1`). It returns a change indicator and does not blindly overwrite both axes.

**Evidence boundary:** width and height have distinct native guards, and the text size can be revised after resource-dependent calculation. The byte-to-authored-property mapping, the meaning of flag bit 23, exact text shaping/line wrapping, and the recursive parent feedback schedule are **not** established by these instructions. Do not assert that native height is always the preview's `fontSize * 1.25` or that these native flags are equivalent to GridSpacer's content flags at other offsets.

The new width-constrained text diagnostic prototype evaluates height **after width arrangement**, refuses horizontal content sizing feedback and managed-container slot overrides, and records its source as `sdf-preview-flow`. This separation follows the measured/arranged distinction supported by the native trace without treating the preview algorithm as recovered Workbench behavior.


## ScrollWidget native measurement and extent passes (third inspection)

Re-inspected the user-supplied **pinned** `WorkbenchApp.exe` (SHA-256 `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`) with MSVC RTTI complete-object locator decoding and static `objdump -M intel`. `enf::ScrollWidget` primary vtable at **`0x142063160`** uses virtual slot 13 **`0x1408E0460`** and slot 14 **`0x1408E0C70`**. These are distinct from the previously recovered Grid and Wrap routines. No proprietary binary is committed to the repository.

The slot-13 method at `0x1408E0460` first calls visibility/eligibility helper `0x1408BB070` and then the common Widget measurement method `0x1408BCE70`. It constructs a child context from `[ScrollWidget+0x88]` and subtracts floating-point fields at **`[+0x178]` and `[+0x17C]`** from its X/Y origin (`0x1408E04A8–0x1408E04B8`). It branches on byte fields **`[+0x188]`, `[+0x189]` and `[+0x18C]`** and adjusts child context dimensions/origin using a calculated scalar; the arithmetic conditionally reads a parent scaling context. It then passes the modified context to eligible children via virtual `+0x68`. The property names for all these byte/float offsets, scrollbar thickness, scroll position/offset transforms, and DPI behavior have **not** been proven.

The slot-14 routine at `0x1408E0C70` again constructs a child context with offset and dimension adjustments. Crucially, it **initializes two extent fields** at `[ScrollWidget+0x180]` and `[+0x184]` to its current width/height (`0x1408E0D4C–0x1408E0D5E`). After virtual child measurement and arrangement calls (`+0x68` and `+0x70` at `0x1408E0DAB/0x1408E0DB9`), it maxes those extent fields against each child's measured **X+width** and **Y+height**, relative to the adjusted child-context origin (`0x1408E0DBC–0x1408E0E0F`). A conditional skip/eligibility path based on `[+0x159]` appears in both routines, and its authored-property mapping is not established.

**Defensible conclusion:** ScrollWidget has a native two-stage child-constraint and content-extent process. The content extent baseline is at least the current widget width/height, then each eligible child's right and bottom edges can increase it. **Not yet established:** clip defaults, scrollbars, their consumed area, offset sign/mapping, visibility filtering semantics, and native scroll range or interaction.

For controlled comparison, the shared engine now exposes `EstimateNativeScrollExtent`, explicitly labeled **`native-derived-scroll-extent-prototype`**, after the existing authored-only direct-child bounds inspection. This candidate implements the observed max operation **only under a zero-scroll-offset, unadjusted-viewport assumption**, and it does not set the widget size, apply scrolling, or modify the canvas. The `scrollNativeExtentDiagnostics` option is separate from `scrollViewportDiagnostics`, so this must not be conflated with a complete ScrollWidget renderer. Static disassembly is evidence of the arithmetic, **not** proof of pixel parity for real Workbench ScrollWidget layouts.


## Scroll reflected scrollbar flags and unit-scale reservation (fourth inspection)

The pinned WorkbenchApp.exe includes the exact authored property names **`Scrollbar H`**, **`Scrollbar V`**, and **`Scrollbar V Left`** in its ScrollWidgetClass reflection region (file offsets `0x206EF58–0x206EFD0`). The ScrollWidget constructor at `0x1408DE500` zeroes its newly allocated fields at `+0x160..+0x18D`, including the three relevant flags; a new widget starts with these flags disabled.

The ScrollWidget measurement routine `0x1408E0460` has branches consistent with these names and dimensions: `[widget+0x189]` reserves horizontal viewport width (vertical scrollbar), `[widget+0x188]` reserves vertical viewport height (horizontal scrollbar), and `[widget+0x18C]` additionally shifts the child origin to the right when the vertical scrollbar occupies the left side. The unscaled path at `0x1408E04F3` loads float constant **10.0** from `0x141F1DCE0`. An alternate branch at `0x1408E04C8–0x1408E04F0` scales that constant by parent context values under a widget bit flag. These observations support an **unscaled diagnostic candidate**, not a universal 10px assertion under all Workbench conditions.

`ScrollSettings.ts` adds first-property-wins decoding for the three reflected scrollbar names, refusing invalid boolean representations. It exposes an independent `EstimateUnscaledScrollViewport` that reserves 10 units of height for `Scrollbar H`, 10 units of width for `Scrollbar V`, and applies a 10-unit rightward child-origin shift when both `Scrollbar V` and `Scrollbar V Left` are enabled. It requires an explicit unit-scale assumption; it does not set scroll position, remove authored children, calculate DPI-adjusted scrollbar thickness, or claim native clipping parity. The property-loader mappings have now been **directly traced**: native `0x1408DEDD0` loads the three property identifiers in reflection order and writes their boolean values to `+0x188`, `+0x189`, and `+0x18C` at `0x1408DEE23`, `0x1408DEE43`, and `0x1408DEE60`, respectively.

When scrollbar settings are enabled, the older `scrollNativeExtentDiagnostics` candidate is now suppressed because its stated `unadjusted-viewport` assumption no longer holds. The independent `scrollScrollbarViewportDiagnostics` option writes only to `scrollAdjustedViewports`, leaving actual layout and clipping unchanged.


## Direct Scroll property-loader verification and native scale inputs (fifth inspection)

The **same user-provided pinned executable**, SHA-256 `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`, was re-examined at `0x1408DEDD0–0x1408DEE84`. The loader reads three property identifiers at `0x1461541FC`, `0x146154200` and `0x146154204` and writes their values to:

| Authored reflection name | Native property-loader write | Scroll measurement guard |
|---|---|---|
| `Scrollbar H` | `0x1408DEE23` → byte `+0x188` | `0x1408E0527` |
| `Scrollbar V` | `0x1408DEE43` → byte `+0x189` | `0x1408E04FB` |
| `Scrollbar V Left` | `0x1408DEE60` → byte `+0x18C` | `0x1408E0504` |

This **closes the previous loader-to-field mapping gap** in the pinned binary. It does not establish whether other Workbench builds use identical offsets. The loader also reads an earlier property identifier at `0x1461541D8` into byte `+0x159`; its user-facing name and filtering semantics remain unproven.

The scrollbar scaling branch at `0x1408E04C8–0x1408E04F0` reads an integer at native context `+0xC4`, a positive divisor at `+0xCC`, converts the operands to single-precision floats, divides, and multiplies by the same 10-unit constant used by the unscaled path. It is enabled by bit 29 in Widget flags at `+0xA8`. Thus the **arithmetic** can be represented as `float32(10 × float32(float32(contextC4) / float32(contextCC)))`, but the meaning of those context fields relative to root resolution, monitor scale and Studio zoom is still unknown.

`ScrollSettings.ts` now shares one rectangle-reservation calculation between `EstimateUnscaledScrollViewport` and `EstimateContextScaledScrollViewport`. The latter accepts the **actual native integer numerator and denominator explicitly**, with range checks and single-precision arithmetic. It is not automatically connected to canvas DPI or the layout snapshot, because doing so would invent the missing context mapping.

### Reproducible evidence check

`scripts/verify-workbench-scroll.mjs` is a read-only static PE verifier. It checks the **pinned SHA-256**, the exact property-loader instructions, measurement-guard opcodes, context-scale field accesses, reflection strings and a RIP-relative 10.0 constant. It never executes the Windows binary.

```powershell
npm run verify:workbench-scroll -- "C:\\Path\\To\\WorkbenchApp.exe"
```

The script has synthetic PE parser tests in CI; the full pinned-binary check was run against the user-provided Workbench binary in the research environment. The executable is not part of the repository.

**Still missing for pixel parity:** observed Workbench child rectangles at multiple root resolutions, scrollbar modes and DPI settings; native scroll offset setters and direction; `+0x159` eligibility semantics; and the actual child clipping policy. These must be measured before enabling ScrollWidget runtime placement.
