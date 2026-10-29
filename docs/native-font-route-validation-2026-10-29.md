# Native font routing and glyph evidence — 2026-10-29

## Validated baseline
The user's Windows transcript `Pasted text(20261029-191312).txt` at commit `25799842d01f749cf53f69837a6ca7751a406eb1` passed **276/276 geometry tests**, **11/11 native UV tests**, TypeScript typecheck and the Vite build. No selected tests failed or were skipped.

## Independent visual evidence
All three screenshots use 1280×720 root and 68% displayed zoom:
- Studio baseline: `image(20261029-191532).png`, SHA-256 `e243158c0df5345083116c66cb981cc2668def9b3e4a7abff02b4ee420035`.
- Workbench v1.30.164200.56: `image(20261029-191539).png`, SHA-256 `51bf3e6f5fb4d955ec36f04b5d2f625d6bf8a8e00ce212977c3043a870d03fbd`.
- Studio standalone FNT5: `image(20261029-191547).png`, SHA-256 `5b1cdd67289cf9ec497fd5c5577ce9c548af13243542b6d89f9d2212b2ef52ec`.

The original images and logs are retained with the conversation and not committed.

Console evidence: baseline `Pasted text (2).txt` SHA-256 `1bbfa151a29f5b1c45c7741201082ebd4e2469e017490255890063fd4d92d367`; standalone `Pasted text (3).txt` SHA-256 `37a2ef7c8540ec207a9ca37170e3b13cd846b03d7855d8d1ae0e4523b55b2b46`.

## Results
The available short-name SDF font list increases **from 1 to 8** in standalone mode. Both `sdf_MetronBook72` controls and `sdf_MetronLight24` move from CSS fallback to the SDF route. `sdf_MetronBook24` already uses SDF via the FSDF sidecar.

**Resource resolution: PASS experimentally. Native glyph paint: FAIL.** Workbench's text is legible in all seven control cases, but standalone Book72 is irregular and clipped, Book24 is fragmented in both modes, Light24 differs in shape, and Studio's button chrome also differs from Workbench. Default text remains CSS fallback.

### Source-level confounder
`ProjectWorkspace.ts` registers standalone FNT5 first, then registers a valid FSDF sidecar under the same keys, overwriting the standalone resource. The experimental Book24 log corroborates this with `selected: "FSDF fallback"`. A separate research-only precedence correction is needed to compare Book24's **actual standalone path**; leave production defaults untouched.

The baseline Book24 diagnostic references a **512×256** FSDF coordinate atlas while the decoded EDDS is **1024×1024**; exact mapping is not yet proven. Standalone Book72 reports nominal size 72 and a 95-pixel cell inside a 34px-tall widget, with ink outside its bounds. Single-red-channel legacy SDF alpha, cell origin/bearings, and widget-relative size are independent unverified paint variables.

**Disposition:** preserve these failed results, then test experimental-only resource precedence and one rendering variable at a time. No native font-rendering parity, global FNT5 enablement or PR #47 merge is justified by these captures.
