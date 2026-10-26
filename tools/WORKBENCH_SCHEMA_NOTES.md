# Workbench widget-schema extraction notes

The schema seed is based on readable metadata in the supplied `WorkbenchApp.exe` plus Bohemia's public widget API and verified layouts where noted in `WidgetSchema.ts`.

## Exhaustive widget-class inventory

The October 2026 audit now enumerates every printable `*WidgetClass` token in the supplied executable instead of relying on a fixed anchor list.

The executable contains **49 layout-facing widget class names** and **52 Workbench/editor `AV*` / `AU*` wrapper class names**. The 49 layout-facing classes are:

- `BaseListboxWidgetClass`
- `BasicGraphWidgetClass`
- `ButtonWidgetClass`
- `CanvasWidgetClass`
- `CheckBoxWidgetClass`
- `ConsoleWidgetClass`
- `ContentWidgetClass`
- `ContextMenuWidgetClass`
- `DiagMenuWidgetClass`
- `EditBoxWidgetClass`
- `EmbededWidgetClass`
- `FrameWidgetClass`
- `GenericListboxWidgetClass`
- `GridSpacerWidgetClass`
- `HtmlWidgetClass`
- `ImageWidgetClass`
- `ItemPreviewWidgetClass`
- `MapWidgetClass`
- `MenuStripWidgetClass`
- `MultilineEditBoxWidgetClass`
- `MultilineTextWidgetClass`
- `PanelWidgetClass`
- `PasswordEditBoxWidgetClass`
- `PlayerPreviewWidgetClass`
- `ProgressBarWidgetClass`
- `RTTextureWidgetClass`
- `RenderTargetWidgetClass`
- `RichTextWidgetClass`
- `RingBufferGraphWidgetClass`
- `ScrollWidgetClass`
- `ServerBrowserWidgetClass`
- `SimpleProgressBarWidgetClass`
- `SliderWidgetClass`
- `SmartPanelWidgetClass`
- `SpacerBaseWidgetClass`
- `SpacerWidgetClass`
- `StyledWidgetClass`
- `TextListboxWidgetClass`
- `TextWidgetClass`
- `ThreeStateCheckboxWidgetClass`
- `TimeBasedGraphWidgetClass`
- `TimeBasedGraphWithAxesWidgetClass`
- `UniversalListboxWidgetClass`
- `VideoWidgetClass`
- `WidgetClass`
- `WindowWidgetClass`
- `WorkspaceWidgetClass`
- `WrapSpacerWidgetClass`
- `XComboBoxWidgetClass`

`ComboBoxWidgetClass` and `SimpleListboxWidgetClass` remain recognized as compatibility names because they have been observed through API/layout terminology, but they are not present as standalone class strings in this supplied executable.

A class being inventoried does **not** mean Layout Studio fully renders or emulates that widget. Specialized runtime widgets such as map, preview, graph, menu, server-browser, HTML, workspace, and window classes are now known types while their dedicated behavior/property support remains conservative.

## Property metadata

Directly observed Workbench metadata includes common widget properties such as `visible`, `clipchildren`, `inheritalpha`, `ignorepointer`, `halign`, `valign`, exact position/size flags, `scaled`, `fixaspect`, `priority`, `userID`, `draggable`, `scriptclass`, and `style`.

The executable also exposes TextWidget labels/ranges for font, text color/offset/spacing, outline/shadow controls, italic/bold, text sharpness (`0..3`, step `0.01`), exact text size (`0..1000`, step `1`), text proportion and size-to-text behavior; ImageWidget properties such as `image0`, `imageTexture`, `nocache`, rotation, pivot, mask, transition width and progress; spacer/scroll properties including padding/margin, size-to-content, content alignment, rows/columns and scrollbar toggles; button switch values `normal`, `once`, `toggle`; and slider properties including min/max/step, flipped, marker thickness, fill, marker visibility and input listening.

The executable contains editor-class names including `BooleanPropertyCheckBox`, `IntegerPropertyComboBox`, `IntegerPropertySlider`, `IntegerPropertySpinBox`, `ScalarPropertyComboBox`, `ScalarPropertySlider`, `StringPropertyComboBox`, `StringPropertyResourceNamePicker`, `ColorProperty`, `FlagsProperty`, `WidgetOffsetProperty`, `WidgetAnchorProperty`, and `AlignmentProperty`. These are evidence that Workbench uses a typed property model.

Nearby strings are treated as evidence for manual review only. The extractor deliberately does not auto-assign nearby strings to a widget because native binary layout can place unrelated metadata adjacent to a class name.

Unknown/mod-specific properties remain editable, and the extractor can be rerun against future Workbench builds to compare both widget-class inventory and metadata.
