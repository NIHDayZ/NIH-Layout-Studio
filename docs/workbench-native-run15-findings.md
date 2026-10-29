# Workbench runtime PE module survey — Run 15 (2026-10-29)

**Source:** `NIH_Workbench_RuntimeModuleSurvey_Results_15.zip`. This is an inventory of **literal bytes**, not verified instructions or confirmed font-file readers.

## Coverage and status

Three source installations were accessible: `DayZ Tools\\Bin`, `DayZ`, and `DayZServer`.

| Measure | Count |
| --- | ---: |
| PE filenames inspected | 155 |
| Modules with at least one marker | 99 |
| No marker hits | 56 |
| Modules with full FNT2–FNT5 + GLPS/TCRD/KERN/LYRS + font-interface family | **5** |
| Modules with isolated or sparse markers | 94 |
| Skipped or failed modules | 0 |

## Strong candidates

The following five distinct 64-bit executables each contain the ordered `FNT2`, `FNT3`, `FNT4`, `FNT5`, `GLPS`, `TCRD`, `KERN`, `LYRS`, `IRenderFont`, `IRenderDistanceFont`, `MatFontInternal`, and `fontGenerator` signatures.

| Executable | SHA-256 | FNT5 file offset |
| --- | --- | --- |
| WorkbenchApp.exe | `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85` | `0x2070318` |
| DayZ_x64.exe | `c6709ece5468fadeb7eda085355a7dc5157601ddc589fb2beac6f5726a99f933` | `0x1165cd0` |
| DayZDiag_x64.exe | `a500be804ffed5cde369337aeb6ab477ef5ee0b5015764be2b1953c85ec3060d` | `0x1386f80` |
| DayZServer_x64.exe | `ee1add8bb6ded0b6e913f31d62c93d1326d5a44106d558bbd3d19adb78b73bb1` | `0x109b860` |
| binarize.exe | `1998db17d8eb7b633413855d28af8483d30baafcc0e9a45f992d83f23766b03e` | `0x107f530` |

All five have the same **relative order** of the core signatures, but are distinct binaries. The scan alone does **not** prove a shared implementation, function identity, presence of an FNT5 reader, or runtime behavior. Survey offsets are **file offsets**, not image virtual addresses. Do not accidentally compare them to Ghidra VAs without PE-section mapping.

`NavMeshGenerator_x64.exe` had only `KERN` and `IRenderDistanceFont` hits. Other positive modules mostly had isolated `KERN` byte matches, which are non-specific and low value.

## Decision

1. No evidence favors an external DLL as the font-format reader. An engine-level implementation compiled into multiple executables is plausible, **not yet verified**.
2. Do **not** automatically import DayZ_x64, DayZDiag_x64, DayZServer_x64, or binarize into Ghidra simply because they carry the same format strings. The existing Workbench Safe project already holds verified font interface and writer-side evidence.
3. Further font work should trace **actual file-open/stream-read call sites**, or improve bounded disassembly around the existing candidate region. Avoid another full-program analysis and broad repeated marker scans.
4. Resume advancing common GUI-engine implementation: native `fixaspect` geometry, ImageWidget `flip u/v` integration, clipping, layout measurement and arrangement, and Workbench parity tests.
5. Keep speculative FNT5 kerning, unsupported TCRD format selection and font fallback behavior out of production preview until verified.

Provenance remains the local research ZIP; no proprietary executable code or unbounded decompiler listings are committed.
