# Workbench native font chunk trace — Run 12

Source: `NIH_Workbench_EngineRecon_Results_12.zip`, analyzed 2026-10-29. Pinned `WorkbenchApp.exe` SHA-256: `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`.

## Status and scope

The read-only Ghidra Safe-project trace completed and found four matching chunk words. Results are pseudo-instruction candidates, not a complete function boundary or validated call graph. The key new conclusion is that this region is **very likely a chunk *writer/exporter***, not yet a verified FNT3/FNT5 file reader.

## Instruction evidence

| Tag | VA of ASCII immediate | Identified plausible instruction start | Meaning |
| --- | --- | --- | --- |
| HEAD | `0x140F1B3C4` | `0x140F1B3C1` | Move constant `0x44414548` into stack local |
| GLPS | `0x140F1B533` | `0x140F1B52D` | Move constant `0x53504C47` into stack local |
| TCRD | `0x140F1B57D` | `0x140F1B577` | Move constant `0x44524354` into stack local |
| KERN | `0x140F1B682` | `0x140F1B67C` | Move constant `0x4E52454B` into stack local |

Each tag is followed by passing a pointer to that local into direct call `0x140B75370`, using a common context object at `[RBP+0x2B0]`. Other writer-side helpers include `0x140B75660`, `0x140B75BE0`, and `0x140B75450`. Several data transfer operations call a virtual method at `[vtable+0x28]`. As the saved Safe-project lacks boundaries for this region, the instructions' contextual meaning remains a strong inference, not a full decompilation proof.

### Record-width evidence

- **TCRD** path near `0x140F1B5A5` multiplies a count by **14** (`IMUL ...,0xE`) in one conditional branch; the alternate branch multiplies it by **12** (`3 * 4`). This is a genuine distinction that demands an explicit font-format/version check before applying either record schema.
- **KERN** path near `0x140F1B6A6` multiplies a count by **8** (`SHL ...,3`). This is consistent with the 8-byte in-memory pair records separately established by Runs 09/10, but does not by itself prove on-disk field ordering or value semantics.

The nearby `FNT2/FNT3/FNT4/FNT5` names appear in read-only data around `0x142071100`. Their mere presence does not establish the selected writer variant or reader entry point.

## Implementation implications

1. Preserve existing FNT5/bitmap preview behavior; do **not** insert a guessed KERN decoder or assume every TCRD record is 14 bytes.
2. Retain the existing native pair-lookup and per-glyph advance evidence; only connect pair data once the resource read path is verified.
3. Target the common chunk helper functions and independent format-tag usages in the next bounded trace. If the reader is not in `WorkbenchApp.exe`, inspect the actual font runtime module rather than continue searching editor-side methods.
4. Keep all native research detached from PR #47. This document records evidence, not an implementation authorization.

The Run 12 ZIP and Ghidra logs remain in the user's local research output; proprietary binary bytes and decompiler listings are not committed.
