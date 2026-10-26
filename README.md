# NIH Layout Studio

NIH Layout Studio is a browser-based visual editor, renderer, resource inspector, and authoring toolkit for DayZ / Enfusion `.layout` UI files.

It was built as a practical alternative to unstable or incomplete Workbench UI workflows and supports source-aware editing, project/dependency/vanilla resources, native DayZ fonts, imagesets, EDDS decoding/encoding, atlas generation, and increasingly accurate widget/style rendering.

## Privacy

**Your files stay local.** Project, dependency, vanilla GUI, layout, image, font, imageset, and EDDS files are processed in your browser. NIH Layout Studio does not require a server-side upload pipeline.

- **Source mode:** directly opens local files/folders with Save and Reload support using the File System Access API. Chrome/Edge desktop are recommended.
- **Upload mode:** loads a temporary copy into the browser session and uses Export/Export As to save changes. This works more broadly across browsers.

## Current version

**0.36.0** — distribution-readiness release based on the 0.35 editor/style baseline.

Highlights include:

- visual `.layout` rendering and source-aware editing
- drag, resize, duplicate, copy/paste, reparent, reorder, align, and distribute tools
- Project → dependency mods → vanilla `P:\gui` resource precedence
- `.styles` parsing and state-aware preview rendering
- `.imageset` inspection/editing and atlas generation
- native EDDS decoding and PNG/TGA → EDDS encoding
- native FNT3 font support
- Workbench-derived widget/property schema and validation
- Upload and direct Source filesystem workflows

## Run locally

Requirements: Node.js 20.19 or newer (Node.js 22 recommended).

```bash
npm ci
npm run dev
```

For a production build:

```bash
npm run typecheck
npm run build
npm run preview
```

## Hosted deployment

The app can be deployed as static files. Cloudflare Pages is the recommended free host.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Resource resolution

When the same resource exists in multiple roots, Layout Studio resolves it in this order:

1. current project
2. dependency mods in load order
3. vanilla DayZ GUI (`P:\gui`)
4. fallback/placeholder behavior

Dependency and vanilla resource roots are read-only. The current Source-mode project is writable.

## Contributing

Contributions are welcome through pull requests. The `main` branch is protected; changes must go through review and required CI checks.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development, validation, compatibility, and licensing expectations.

## License

NIH Layout Studio is **source-available for noncommercial use** under the **PolyForm Noncommercial License 1.0.0**.

You may use, inspect, modify, and redistribute the software for noncommercial purposes under the license terms. Commercial use, resale, paid redistribution, or use in a commercial product/service requires separate written permission from NIH DayZ.

See [`LICENSE`](LICENSE).

## Development status

Layout Studio is under active development. Its preview aims for practical DayZ/Enfusion fidelity but is not the engine itself; some runtime-only behavior and highly specialized control/state behavior may still differ from in-game rendering.

See [`CHANGELOG.md`](CHANGELOG.md) for release notes.
