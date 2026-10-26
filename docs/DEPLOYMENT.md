# Deployment

NIH Layout Studio is a static [Vite](https://vite.dev) application. Parsing, rendering, editing, EDDS conversion, imageset work, and resource indexing all run in the user's browser, so hosting it only means serving static files.

The supplied application requires no application server, database, file-upload endpoint, or runtime environment variables.

## Build

**Requirements:** Node.js 20.19 or newer (Node.js 22 recommended) and npm.

```bash
npm ci
npm run typecheck
npm run build
```

The production output is written to `dist/`.

### Preview the production build locally

```bash
npm run preview
```

## Cloudflare Pages (recommended)

Cloudflare Pages has a free tier and works well for static apps.

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |
| Node.js | 22 |

### Steps

1. Fork or clone the repository to your own Git host.
2. In Cloudflare, create a Pages project and connect the repository.
3. Enter the settings above.
4. Deploy. Add a custom domain afterward if you want one.

## Other static hosts

Any host that serves static files works, such as GitHub Pages, Netlify, or your own web server.

- Upload or publish the contents of `dist/`.
- Serve over **HTTPS**. Source mode relies on the File System Access API, which requires a secure context (HTTPS or `localhost`).
- If you host under a sub-path, set the base path in `vite.config.ts` before building.

## Security headers

Production security headers are defined in `public/_headers`. Vite copies the file into `dist/`, and Cloudflare Pages applies it automatically. **Preserve this file** if you change the deployment pipeline.

On hosts that do not read `_headers`, configure equivalent headers in that host's own settings.

## Privacy model

- Selected project, dependency, vanilla GUI, layout, image, font, imageset, and EDDS files are processed locally by browser JavaScript.
- The app does not need to upload those files to a server.
- **Upload mode** reads selected files into the current browser session and uses export/download to save results.
- **Source mode** uses the File System Access API for direct read/write access to files or folders the user explicitly grants. Chromium-family desktop browsers provide the best support. Other browsers can use Upload mode.

If you host your own copy, do not add telemetry, server-side project-file uploads, or external file-processing services without reviewing the project's [contribution guidelines](../CONTRIBUTING.md). Doing so would change the privacy promise users expect.

## Checklist before going live

- [ ] `npm run typecheck` and `npm run build` pass
- [ ] `dist/_headers` is present (or equivalent headers are set on your host)
- [ ] Site is served over HTTPS
- [ ] Upload mode works with a sample layout
- [ ] Source mode works in Chrome or Edge on desktop
- [ ] License terms are respected. Commercial hosting needs separate permission. See [LICENSE](../LICENSE)