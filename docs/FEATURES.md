# Features

A summary of what NIH Layout Studio supports today, and what it does not. Based on the current release (0.36.0). See the [Changelog](../CHANGELOG.md) for history.

## Editing

| Feature | Notes |
| --- | --- |
| Visual `.layout` rendering | Rendered in the browser |
| Source-aware editing | Edits are made against the source file; unknown content is preserved where possible |
| Drag and resize | On the canvas |
| Duplicate, copy/paste | Widgets can be reused |
| Reparent and reorder | Change hierarchy and sibling order |
| Align and distribute | Multi-widget layout tools |
| Hierarchy view | Browse the widget tree |
| Property inspector | Properties and validation based on a Workbench-derived schema |

## Resources

| Feature | Notes |
| --- | --- |
| Project resources | Writable in Source mode |
| Dependency mod resources | Read-only, resolved in load order |
| Vanilla DayZ GUI (`P:\gui`) | Read-only |
| Precedence | Project → dependencies → vanilla → fallback |
| `.styles` | Real parsing; resolved styles applied to the preview |
| State-aware styles | Normal, Focus, Disabled, hover-like, pressed-like |
| `.imageset` | Inspect, edit, generate atlases |
| EDDS | Native decode; PNG/TGA → EDDS encode |
| FNT3 fonts | Native support |

## Loading and saving

| Feature | Notes |
| --- | --- |
| Source mode | Direct open, Save, and Reload via the File System Access API. Chromium-family desktop browsers recommended |
| Upload mode | Temporary session copy; save with Export / Export As. Works in more browsers |
| Capability detection | Source mode items are disabled with an explanation if unsupported |

## Privacy and reliability

- **Local processing.** Files are processed in the browser. The app has a visible local-processing indicator in the toolbar.
- **No server uploads.** There is no file-upload pipeline.
- **Error recovery.** A React error boundary shows a recovery screen if a malformed or unsupported resource would otherwise crash the app.
- **Static hosting.** The app is plain static files with no backend, database, or runtime environment variables.

## Not supported / known constraints

- **Not the game engine.** The preview approximates DayZ/Enfusion rendering. Runtime-only behavior and some specialized control or state behavior may differ in game.
- **Source mode needs browser support.** Without the File System Access API, use Upload mode.
- **Read-only roots.** Dependency and vanilla roots cannot be modified from the app.
- **Active development.** Features and behavior may change between versions.

If you rely on a behavior not listed here, check the app or [open an issue](https://github.com/NIHDayZ/NIH-Layout-Studio/issues) rather than assuming it is supported.