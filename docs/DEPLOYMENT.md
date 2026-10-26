# Deployment

NIH Layout Studio is a static Vite application. File parsing, rendering, editing, EDDS conversion, imageset work, and project/dependency resource indexing run in the user's browser.

## Cloudflare Pages

Recommended settings:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
- Node.js: 22

No application server, database, file-upload endpoint, or runtime environment variables are required.

## Privacy model

Selected project, dependency, vanilla GUI, layout, image, font, imageset, and EDDS files are processed locally by browser JavaScript. NIH Layout Studio does not need to upload those files to a server.

`Upload` mode reads selected files into the current browser session and uses export/download to save results.

`Source` mode uses the File System Access API for direct read/write access to files or folders the user explicitly grants. Chromium-family desktop browsers provide the best support. Unsupported browsers can continue using Upload mode.

## Local production preview

```bash
npm install
npm run build
npm run preview
```
