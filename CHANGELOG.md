# Changelog

## 0.36.0 - Distribution readiness

- Added explicit local-processing/privacy indicator in the application toolbar.
- Added browser capability detection for File System Access API source mode.
- Source-mode menu items are disabled with an explanation when the browser does not support direct filesystem access; Upload mode remains available.
- Added a React error boundary so malformed/unsupported resources cannot take down the entire app without a recovery screen.
- Added `npm run typecheck`, Node engine metadata, license metadata, `.gitignore`, deployment documentation, and GitHub Actions CI.
- Prepared the project for static hosting while retaining fully client-side file processing.

## 0.35.0

- State-aware `.styles` rendering for Normal, Focus, Disabled, hover-like, and pressed-like states.
- Added `disabled` schema support and parser completeness improvements.

## 0.34.0

- Applied resolved project/dependency/vanilla `.styles` definitions in the preview.
- Added style-provided fonts/colors, Normal-state nine-slice rendering, and ProgressBar `BarCenter` support.

## 0.33.0

- Added Workbench/API schema completeness improvements and real `.styles` parsing.

Earlier versions were iterative development builds leading to the public repository baseline.
