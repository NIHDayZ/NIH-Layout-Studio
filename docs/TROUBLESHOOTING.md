# Troubleshooting

Find your symptom, try the fixes in order.

## Quick checks

1. Use a current version of Chrome or Edge on desktop.
2. Save your changes (Source mode) or export them (Upload mode) before refreshing the page and reloading your files. Unsaved changes can be lost on refresh.
3. Confirm you are on the latest release (see the [Changelog](../CHANGELOG.md)).

## Source mode is disabled or missing

**Symptom:** Source-mode menu items are greyed out, with a note about browser support.

**Cause:** Your browser does not support the File System Access API.

**Fix:**
- Use Chrome or Edge on desktop.
- Or use **Upload mode** and save with **Export / Export As**.

## I cannot save changes

| Situation | Fix |
| --- | --- |
| In Upload mode | Upload mode does not write to your original files. Use **Export / Export As** |
| In Source mode, save is refused | Re-grant access to the file or folder when the browser prompts you |
| File is in a dependency or vanilla root | Those roots are read-only. Copy the file into your project first |
| File is locked by another program | Close it elsewhere, then try again |

## My changes disappeared

- In Upload mode, refreshing or closing the tab discards the session. Export before leaving.
- In Source mode, if a file changed on disk elsewhere, use **Reload** deliberately and make sure you saved first.

## Images, fonts, or styles show as placeholders

**Cause:** The resource was not found in any root, or was found but could not be decoded.

**Fix:**
1. Check that your **project**, **dependency mods**, and **vanilla GUI** resources are all provided.
2. Check the **load order** of dependency mods. Earlier mods take priority.
3. Check the resource path in the layout matches a real file's path and name.
4. For textures, confirm the file is a valid EDDS, PNG, or TGA.
5. For fonts, confirm they are valid FNT3 fonts.

## The wrong version of a resource appears

Resources resolve in this order: project, dependency mods (load order), vanilla, fallback. A project file with the same path overrides a vanilla one. If the wrong file is used, look for a same-named file in an earlier root or an earlier dependency mod.

## The preview looks different from the game

The preview is an approximation, not the game engine. Runtime-only behavior and some specialized control or state behavior may differ. Confirm in game. If you find a clear, reproducible difference, please [open an issue](https://github.com/NIHDayZ/NIH-Layout-Studio/issues) with the layout and a screenshot of both.

## The app shows a recovery screen

A malformed or unsupported resource triggered the error boundary. The app stayed alive instead of crashing.

1. Note which file you had just opened.
2. Reload the app and open the file again to see if it repeats.
3. Report it with the file (or a reduced example) so it can be fixed.

## Large folders feel slow

- Load only the roots you need for the layouts you are working on.
- Close other heavy browser tabs.
- Report slow cases with a rough size (number of files) and your browser.

## Local development problems

| Problem | Fix |
| --- | --- |
| `npm ci` fails | Check Node.js is 20.19 or newer (22 recommended). Delete `node_modules` and retry |
| `npm run dev` does not start | Check nothing else is using the port; read the terminal error |
| Type check fails | Run `npm run typecheck` and fix reported errors before building |
| Build fails | Run `npm run typecheck` first, then `npm run build` |

## Still stuck?

[Open an issue](https://github.com/NIHDayZ/NIH-Layout-Studio/issues) and include:

- app version (or commit) and where you ran it (hosted or local),
- browser and operating system,
- Source or Upload mode,
- what you expected and what happened,
- a small sample file if possible.

Do not include private files you are not allowed to share.