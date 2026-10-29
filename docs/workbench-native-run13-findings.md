# Workbench native font I/O trace — Run 13

**Source:** `NIH_Workbench_EngineRecon_Results_13.zip`, processed 2026-10-29. Pinned WorkbenchApp.exe SHA-256 `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`.

## Run status

- `COMPLETE_WITH_UNVERIFIED_CANDIDATES`; read-only Ghidra Safe project, automatic analysis disabled.
- 16 function/address targets attempted: **10 decompiled, 6 lacked recognized function boundaries**, no decompiler errors or incomplete results.
- Executable-code raw marker census: `HEAD` 4 occurrences; `GLPS`, `TCRD`, `KERN` one each; `FNT2`, `FNT3`, `FNT4`, `FNT5` zero. The four version names occur separately in the read-only tag table around `0x142071100`.
- Marker byte occurrences are not validated instruction references. The safe project lacks function boundaries at the `0x140F1B...` writer code locations.

## Stronger writer evidence: helper decompilation

The helper implementations substantiate the Run 12 writer interpretation:

- `0x140B754C0` begins a `FORM` container and can emit a `VERS` subchunk; it uses a virtual stream **write** at offset `+0x28`.
- `0x140B75370` emits a 4-byte chunk tag, writes an initial 4-byte size placeholder, then stores stream position and chunk metadata in a stack of active chunks.
- `0x140B75660` closes the active chunk, obtains current stream offset, seeks backward and writes its payload size, with distinct 32-bit and 16-bit length handling, then seeks back to the end position.
- `0x140B75BE0` and `0x140B75B80` copy four-byte scalar values to the stream; `0x140B75BB0` copies two-byte values.

The linked `TCRD` writer branch selects 12-byte or 14-byte element widths; the `KERN` writer branch uses 8-byte records. These are **serialization transfer widths**, not by themselves verified on-disk field semantics or reader logic.

**Conclusion:** this is a `FORM` chunk **writer/exporter**. Runs 12–13 did not identify a FNT3/FNT5 reader. A separate reader could still exist; the lack of a second code-literal match is not proof of absence.

## Next test

Run 14 follows RIP-relative code references and initialized data pointers to the compact `FNT2`–`FNT5`/`HEAD`/`GLPS`/`TCRD`/`KERN` static format table, rather than repeating chunk string searches. Candidate references will be labeled separately from validated instruction boundaries. If no useful reader is found, pivot to file-open/resource-manager tracing or relevant runtime binary instead of forcing an unsupported FNT5 decoder.

**Implementation:** no new font parsing/kerning has been committed. Preserve existing preview behavior; keep production and PR #47 unchanged. Research branch may contain separately isolated native geometry and image UV work.
