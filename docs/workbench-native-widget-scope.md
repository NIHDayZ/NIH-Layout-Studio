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
