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
