# Workbench widget-schema extraction notes

The 0.23 schema seed is based on readable metadata in the supplied `WorkbenchApp.exe` plus Bohemia's public widget API for a small number of alignment enum choices that were not contiguous with the inspector metadata.

Directly observed Workbench metadata includes common widget properties such as `visible`, `clipchildren`, `inheritalpha`, `ignorepointer`, `halign`, `valign`, exact position/size flags, `scaled`, `fixaspect`, `priority`, `userID`, `draggable`, `scriptclass`, and `style`.

The executable also exposes TextWidget labels/ranges for font, text color/offset/spacing, outline/shadow controls, italic/bold, text sharpness (`0..3`, step `0.01`), exact text size (`0..1000`, step `1`), text proportion and size-to-text behavior; ImageWidget properties such as `image0`, `imageTexture`, `nocache`, rotation, pivot, mask, transition width and progress; spacer/scroll properties including padding/margin, size-to-content, content alignment, rows/columns and scrollbar toggles; button switch values `normal`, `once`, `toggle`; and slider properties including min/max/step, flipped, marker thickness, fill, marker visibility and input listening.

The executable contains editor-class names including `BooleanPropertyCheckBox`, `IntegerPropertyComboBox`, `IntegerPropertySlider`, `IntegerPropertySpinBox`, `ScalarPropertyComboBox`, `ScalarPropertySlider`, `StringPropertyComboBox`, `StringPropertyResourceNamePicker`, `ColorProperty`, `FlagsProperty`, `WidgetOffsetProperty`, `WidgetAnchorProperty`, and `AlignmentProperty`. These are useful evidence that Workbench uses a typed property model.

This remains a conservative seed rather than a claim of complete Workbench parity. Unknown/mod-specific properties stay editable, and the extractor script can be rerun against future Workbench builds to compare metadata.
