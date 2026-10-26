# User Guide

This guide covers everyday workflows in NIH Layout Studio. For a fast first run, see the [Quick Start](QUICKSTART.md).

> **Note on wording:** NIH Layout Studio is under active development. Menu labels and panel names may change between releases. This guide describes workflows and concepts rather than exact button positions. If something differs in your version, check the [Changelog](../CHANGELOG.md).

## Contents

- [Core concepts](#core-concepts)
- [Loading files](#loading-files)
- [Setting up resource roots](#setting-up-resource-roots)
- [Viewing a layout](#viewing-a-layout)
- [Editing widgets](#editing-widgets)
- [Working with styles](#working-with-styles)
- [Working with imagesets](#working-with-imagesets)
- [Working with textures and fonts](#working-with-textures-and-fonts)
- [Saving your work](#saving-your-work)
- [Good habits](#good-habits)

## Core concepts

**Layout.** A `.layout` file describes a tree of UI widgets: containers, text, images, buttons, and so on. Each widget has properties such as position, size, color, and alignment.

**Resources.** Layouts refer to other files: imagesets, styles, fonts, and textures. NIH Layout Studio finds these for you.

**Resource roots.** The places NIH Layout Studio searches. There are three kinds:

| Root | Purpose | Writable? |
| --- | --- | --- |
| Project | The mod you are working on | Yes, in Source mode |
| Dependency mods | Other mods your project relies on | No |
| Vanilla DayZ GUI (`P:\gui`) | Base game UI resources | No |

**Resolution order.** When a resource exists in more than one root, the first match wins: project, then dependency mods (in load order), then vanilla, then a fallback placeholder.

**Source mode vs Upload mode.** Source mode opens files directly and can save back to them. Upload mode loads a temporary copy and saves by exporting. See [Loading files](#loading-files).

## Loading files

### Source mode

Use Source mode when you work on a real project folder and want **Save** and **Reload** to act on the actual files.

- Requires File System Access API support. Chrome and Edge on desktop are recommended.
- You grant access to specific files or folders. The app can only read and write what you select.
- Use **Reload** if files were changed outside the app (for example by another tool).

### Upload mode

Use Upload mode for quick inspection, or when your browser does not support Source mode.

- Files are read into the current browser session as a temporary copy.
- Your original files are not changed.
- Use **Export** or **Export As** to download your edits.
- Closing or refreshing the tab discards the session, so export before you leave.

## Setting up resource roots

For the most accurate preview, give the app all three kinds of roots:

1. **Project:** your mod's folder.
2. **Dependency mods:** add each mod your layouts use. Order matters: earlier entries take priority over later ones (load order).
3. **Vanilla GUI:** the vanilla `P:\gui` content, or an extracted copy of it.

If an image, font, or style is missing from all roots, the app shows fallback or placeholder behavior instead of failing.

## Viewing a layout

Open a `.layout` file to see it rendered. You can:

- Browse the **widget hierarchy** to see parent/child structure.
- Select a widget to see its **properties**.
- Check how styles apply, including state-aware previews (Normal, Focus, Disabled, hover-like, pressed-like).

> **Fidelity:** The preview aims for practical DayZ/Enfusion accuracy but is not the game engine. Runtime-only behavior and some specialized control or state behavior may look different in game. Always test final results in DayZ.

## Editing widgets

Typical editing actions:

| Action | What it does |
| --- | --- |
| Drag / resize | Change position and size on the canvas |
| Edit properties | Change values in the property panel |
| Duplicate | Make a copy of a widget |
| Copy / paste | Move or reuse widgets, including between layouts |
| Reparent | Move a widget under a different parent |
| Reorder | Change sibling order in the hierarchy |
| Align / distribute | Line up or evenly space selected widgets |

Available properties and valid values come from a schema derived from Workbench widget definitions. The app validates values against it.

**Unknown content is preserved.** When you edit a file, content the app does not recognize is kept rather than removed, so saving should not silently strip data. If you notice otherwise, please [open an issue](https://github.com/NIHDayZ/NIH-Layout-Studio/issues).

## Working with styles

`.styles` files define fonts, colors, and images for widget states. NIH Layout Studio parses them and applies the resolved definitions in the preview, including:

- style-provided fonts and colors,
- Normal-state nine-slice rendering,
- Normal, Focus, Disabled, hover-like, and pressed-like state previews,
- ProgressBar `BarCenter`.

Styles are resolved through the same root order as everything else, so a style in your project overrides a vanilla style with the same name.

## Working with imagesets

An `.imageset` maps named image regions onto a texture atlas.

- **Inspect** the regions and the texture they reference.
- **Edit** region definitions.
- **Generate atlases** from source images.

## Colors, fonts, and widget properties

The property inspector presents the selected widget's editable values. Color controls use 0–255 RGBA channel values; widget font choices include fonts resolved from the loaded project resources where available.

If a property is marked unknown, unsupported, or possibly invalid for a widget, review its original source and Workbench behavior before removing it. Do not assume every parsed property is safe to discard.

## Working with textures and fonts

- **EDDS:** the app decodes EDDS textures for display and can encode PNG or TGA files to EDDS. Conversion runs in your browser.
- **Fonts:** native DayZ FNT3 fonts are supported for text rendering.

## Saving your work

| Mode | How to save |
| --- | --- |
| Source | **Save** writes to the files you opened |
| Upload | **Export** or **Export As** downloads the result |

Dependency and vanilla roots are never written to.

## Good habits

- Keep your project in version control (such as Git) so you can review and revert changes.
- Keep a backup before large edits, especially when first trying the tool on important files.
- Compare the saved `.layout` against the original (a diff tool works well) the first time you edit a complex file.
- Test in game. Treat the preview as a fast approximation.
- Report problems with a small example file if you can. See [CONTRIBUTING.md](../CONTRIBUTING.md).