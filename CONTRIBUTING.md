# Contributing to NIH Layout Studio

Thanks for helping improve NIH Layout Studio. Contributions of all sizes are welcome: bug reports, documentation fixes, test cases, and code.

## Ways to help

- **Report a bug** with steps to reproduce and, if possible, a small sample file.
- **Suggest a feature** by opening an issue or discussion.
- **Improve the docs.** Typos, unclear steps, and missing screenshots all count.
- **Share compatibility findings** where the preview differs from in-game behavior.
- **Submit a pull request.**

## Before you start

- Open an issue or discussion first for large behavioral, architectural, file-format, or rendering changes.
- Keep changes focused. Avoid unrelated formatting or refactors in the same pull request.
- Preserve source-aware behavior and existing DayZ/Enfusion compatibility unless the change intentionally addresses a documented incompatibility.
- Do not add telemetry, server-side project-file uploads, or external file-processing services without prior project approval. Keeping files local is a core promise of the project.

## Development setup

**Requirements:**

- Node.js 20.19 or newer (Node.js 22 recommended)
- npm

```bash
git clone https://github.com/NIHDayZ/NIH-Layout-Studio.git
cd NIH-Layout-Studio
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm run build
```

Both must pass.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Type check with TypeScript |
| `npm run build` | Type check and build for production |
| `npm run preview` | Serve the production build locally |

## Pull request workflow

1. Fork the repository, or create a non-`main` branch if you have collaborator access.
2. Make focused commits on your branch.
3. Push the branch and open a pull request against `main`.
4. Complete the pull request template.
5. Address review comments and keep the branch current with `main`.
6. Required CI checks and review requirements must pass before merge.

The `main` branch is protected. Direct pushes, force pushes, and deletion are blocked by repository rules.

## DayZ / Enfusion compatibility

When changing parsing, rendering, schemas, styles, imagesets, fonts, EDDS handling, or layout serialization:

- Prefer vanilla DayZ files and Bohemia-provided definitions as primary behavioral evidence.
- Preserve unknown source content wherever possible instead of normalizing or discarding it.
- Avoid one-off property whitelists when a general schema or ownership rule can be used.
- Include a representative test file, reproduction case, or before/after description when practical.

## Test files and examples

- Use small, minimal files that show the issue.
- Do not commit proprietary assets or content you do not have the right to share.
- Keep examples generic. Avoid mod-specific names, branding, or private project content unless the file is clearly labeled as an example and you have permission to share it.

## Documentation changes

When documenting UI features, verify the current implementation rather than assuming planned behavior is available. Avoid adding references to screenshots that do not yet exist.


- Describe what the app actually does. If you are unsure, say so or mark it as a limitation.
- Prefer practical, plain language over jargon.
- Add alt text and captions to screenshots.
- Check that relative links work.

## Reporting security issues

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Licensing

NIH Layout Studio is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE).

By submitting a contribution, you agree that your contribution may be distributed as part of NIH Layout Studio under the repository's license and that you have the right to submit the contribution.

Commercial-use rights are not granted by contributing code.