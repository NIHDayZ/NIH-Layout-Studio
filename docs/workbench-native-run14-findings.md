# Workbench native font reader map — Run 14

**Source:** `NIH_Workbench_EngineRecon_Results_14.zip`, executed 2026-10-29. Pinned `WorkbenchApp.exe` SHA-256: `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`.

## Result

- Headless execution succeeded, read-only, full automatic analysis disabled.
- Script status: `COMPLETE_WITH_CANDIDATES`.
- **20 raw RIP-relative/reference pattern matches**, but some describe the same instruction twice (REX-prefixed and prefix-skipped matching).
- **Zero** initialized data-pointer candidates.
- **Zero** candidate references assigned to a recognized Ghidra function.
- **Zero** decompiler excerpts exported; no FNT reader verified.

The confirmed read-only format table begins at VA `0x142071100`:

| VA | Tag |
| --- | --- |
| `0x142071100` | FNT2 |
| `0x142071108` | FNT3 |
| `0x142071110` | FNT4 |
| `0x142071118` | FNT5 |
| `0x142071120` | HEAD |
| `0x142071128` | GLPS |
| `0x142071130` | TCRD |
| `0x142071138` | KERN |
| `0x142071140` | LYRS |

## Candidate sites and caveats

- `0x1408EF41B` points near `fontGenerator` text at `0x142071148`; `0x1408EF606` and `0x1408F020E` point to neighboring strings. These are not confirmed font-file reader code.
- `0x140F1B31D` references `0x142071118` (FNT5): it is in the previously identified writer/serializer region, not independent reader evidence.
- `0x141AFEFA2`, `0x141B0C257`, `0x141B0D39A`, `0x141B0E17F`, `0x141B60D52`, and `0x141B619C1` are candidate `HEAD` references. No containing function or call context was recovered.
- `0x140B750E1` was marked as an indirect table-range call pattern and is not evidence of FNT parsing.
- All reference candidates carry `PATTERN_ONLY_NO_SAVED_INSTRUCTION`, not a validated disassembler cross-reference.

The two differently aligned matches for many instructions mean the count **must not** be reported as 20 verified xrefs, functions, or distinct callers.

## Decision

**Stop repeating broad raw string/pointer scans of `WorkbenchApp.exe`.** Runs 12–13 have established a FORM chunk writer and transfer sizes (TCRD 12 or 14 bytes; KERN 8 bytes). Runs 11 and 14 have not established the corresponding reader. The reader may be in another runtime module, or in code that the current Safe-project analysis cannot resolve by simple string references. Absence of verified reader here is **not** proof that Workbench does not contain it.

For the next font investigation, obtain an inventory of relevant DayZ/Workbench runtime EXE/DLL modules and inspect only evidence-backed candidates, or trace actual resource-open/stream read entry points. No production FNT5 or kerning changes should be made on these results.

Do not block common widget layout, clipping, image UV, or other engine work on font decoding. Continue verifying and promoting those independent native-derived changes through project tests and Workbench comparison. PR #47 remains separate.

Native executables and full proprietary decompilation outputs are not stored in this repository.
