# Contributing to NIH Layout Studio

Thanks for helping improve NIH Layout Studio.

## Before you start

- Open an issue or discussion first for large behavioral, architectural, file-format, or rendering changes.
- Keep changes focused. Avoid unrelated formatting or refactors in the same pull request.
- Preserve source-aware behavior and existing DayZ/Enfusion compatibility unless the change intentionally addresses a documented incompatibility.
- Do not add telemetry, server-side project-file uploads, or external file-processing services without prior project approval.

## Development

Requirements:

- Node.js 20 or newer
- npm

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm run build
```

Both commands must pass.

## Pull request workflow

1. Fork the repository or create a non-`main` branch if you have collaborator access.
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
- Avoid one-off property whitelists when a general schema/ownership rule can be used.
- Include a representative test file, reproduction case, or before/after description when practical.

## Licensing

NIH Layout Studio is source-available under the PolyForm Noncommercial License 1.0.0.

By submitting a contribution, you agree that your contribution may be distributed as part of NIH Layout Studio under the repository's license and that you have the right to submit the contribution.

Commercial-use rights are not granted by contributing code.
