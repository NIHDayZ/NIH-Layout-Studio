# Quick Start

Get a `.layout` file open and editable in a few minutes.

## 1. Choose how to run it

| Option | Best for | What you need |
| --- | --- | --- |
| **Hosted app** | Fastest start | A modern browser. Open [layout-studio.nihdayz.com](https://layout-studio.nihdayz.com) |
| **Run locally** | Offline use, development, or your own copy | Node.js 20.19+ and npm. See [Run locally](#run-locally) |

In both modes, selected files are processed locally in your browser by the application; there is no application upload endpoint.

## 2. Choose a loading mode

NIH Layout Studio has two ways to load files. Pick one before you start.

| | **Source mode** | **Upload mode** |
| --- | --- | --- |
| How it works | Opens local files or folders directly | Loads a temporary copy into the browser session |
| Saving | **Save** writes back to your files; **Reload** re-reads them | Use **Export** or **Export As** to download results |
| Browser support | Chrome or Edge on desktop (File System Access API) | Most modern browsers |
| Good for | Working on a real project folder | Quick looks, or browsers without Source mode |

If your browser does not support Source mode, those menu items are disabled and the app explains why. Upload mode still works.

## 3. Open your first layout

1. Open the app.
2. Select a mode (see above) and open a `.layout` file, or a project folder in Source mode.
3. The layout renders on the canvas. The widget hierarchy and properties are shown alongside it.

> **Tip:** If the preview shows placeholders instead of images or fonts, the app has not found those resources yet. Add your dependency mods and vanilla GUI resources (next step).

## 4. Add resource roots (recommended)

Layouts usually reference images, styles, and fonts from other places. NIH Layout Studio looks for each resource in this order:

1. Current project
2. Dependency mods, in load order
3. Vanilla DayZ GUI (`P:\gui`)
4. Fallback / placeholder

To get an accurate preview, provide:

- your **project** folder,
- any **dependency mods** your layouts rely on,
- the **vanilla GUI** resources (the contents of `P:\gui`, or an equivalent extracted copy).

Dependency and vanilla roots are read-only. They are never modified.

## 5. Edit and save

- **Select** widgets on the canvas or in the hierarchy.
- **Move and resize** by dragging, or edit values in the property panel.
- **Duplicate, copy/paste, reparent, reorder, align, and distribute** widgets from the editing tools.
- **Save** (Source mode) or **Export / Export As** (Upload mode).

Open the saved file in DayZ or Workbench to confirm it behaves as expected. The preview is a close approximation, not the game engine.

## Run locally

```bash
git clone https://github.com/NIHDayZ/NIH-Layout-Studio.git
cd NIH-Layout-Studio
npm ci
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

## Next steps

- [User Guide](USER_GUIDE.md): everyday workflows in detail
- [Features](FEATURES.md): what the app supports
- [Troubleshooting](TROUBLESHOOTING.md): if something looks wrong