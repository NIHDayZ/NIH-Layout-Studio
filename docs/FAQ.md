# FAQ

## General

### What is NIH Layout Studio?
A browser-based editor and viewer for DayZ / Enfusion `.layout` UI files. It also lets you inspect imagesets, styles, and fonts.

### Does it replace Workbench?
It is meant to reduce how much you need Workbench for **layout editing**. It does not replace Workbench for everything else, and it is not the game engine. Test final results in DayZ.

### Is it free?
Yes, for noncommercial use. It is released under the PolyForm Noncommercial License 1.0.0. Commercial use requires separate written permission. See [LICENSE](../LICENSE).

### Is it open source?
The source is public and you may use, modify, and redistribute it for noncommercial purposes. Because the license restricts commercial use, it is "source-available" rather than OSI-approved open source.

### Is it affiliated with Bohemia Interactive?
No. It is an independent community tool.

## Privacy and files

### Are my files uploaded anywhere?
No. Layouts, images, fonts, imagesets, and EDDS files are processed locally in your browser. There is no file-upload server.

### Can I use it offline?
File processing runs in your browser. For reliable offline use, [run a local copy](../README.md#run-locally). Do not assume the hosted app will work without a network connection merely because you visited it previously.

### Will it change my dependency mods or vanilla files?
No. Dependency and vanilla roots are read-only.

## Modes

### What is the difference between Source mode and Upload mode?
Source mode opens files directly and lets you **Save** and **Reload** in place. Upload mode loads a temporary copy and you save with **Export / Export As**. See the [User Guide](USER_GUIDE.md#loading-files).

### Why is Source mode greyed out?
Your browser likely does not support the File System Access API. Use Chrome or Edge on desktop, or use Upload mode.

### Why did I lose my changes in Upload mode?
Upload mode keeps a temporary session copy. Refreshing or closing the tab discards it. Export before leaving.

## Resources

### Why do I see placeholders instead of my images or fonts?
The app could not find the resource in any root. Make sure your project, dependency mods, and vanilla GUI resources are all provided. See [Troubleshooting](TROUBLESHOOTING.md).

### Which resource wins if the same file exists in several places?
In order: current project, dependency mods (load order), vanilla `P:\gui`, fallback.

### Do I need a copy of vanilla `P:\gui`?
For an accurate preview of layouts that use vanilla styles, images, or fonts, yes. Without it, those resources fall back to placeholder behavior.

### Does it convert images to EDDS?
Yes. It can encode PNG and TGA to EDDS and decode EDDS for display.

## Accuracy

### Will my layout look exactly like it does in game?
Not always. The preview aims for practical fidelity, but runtime-only behavior and some specialized control or state behavior may differ. Always verify in game.

### Will saving strip content the app does not understand?
The editor is designed to preserve unknown source content. If you see something being lost or rewritten unexpectedly, please report it with an example.

## Contributing and support

### How do I report a bug?
[Open an issue](https://github.com/NIHDayZ/NIH-Layout-Studio/issues) with your browser and version, the mode you used, what you expected, and what happened. A small sample file helps.

### How do I report a security issue?
See [SECURITY.md](../SECURITY.md). Do not post vulnerabilities in public issues.

### Can I contribute?
Yes. See [CONTRIBUTING.md](../CONTRIBUTING.md).