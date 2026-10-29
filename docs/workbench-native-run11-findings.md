# Workbench native property/format trace — Run 11

**Pinned executable SHA-256:** `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`

Run 11 reused the saved Ghidra Safe project with full automatic analysis disabled. Status: `COMPLETE_WITH_CANDIDATES`; 42 RIP-relative property-token references, including 18 candidate stores; 119 four-byte format-marker matches. These are **byte-pattern results**, not automatically verified code references.

## ImageWidget: authored flip properties (high confidence)

The registration-initialization sequence at the following addresses matches the property token globals used by the independently decompiled ImageWidget loader:

| Authored property string | String data | Registration store | Token global | Native image flag |
| --- | --- | --- | --- | --- |
| `flip u` | `0x14205BA00` | `0x1408B07A3` | `0x146143A10` | bit 26 (`0x04000000`) |
| `flip v` | `0x14205BA08` | `0x1408B0892` | `0x146143A14` | bit 27 (`0x08000000`) |

Each string is loaded into the property descriptor preceding its corresponding token registration. Workbench's native ImageWidget property loader `0x1408B1790` consumes the two globals and writes those flag masks. Native renderer `0x1408EA020` reads the masks to choose U/V texture-coordinate permutations (Run 10 evidence).

This is a coherent registration → loader → renderer chain. It justifies decoding the case-insensitive layout properties and mapping them to the shared UV behavior. Rendering parity still requires side-by-side Workbench tests, including the source-rectangle path.

## Font resources: stronger parser candidate, not yet verified

Four-byte format markers in raw executable code occur close together:

- `GLPS` at `0x140F1B533`
- `TCRD` at `0x140F1B57D`
- `KERN` at `0x140F1B682`

Related `FNT3`/`FNT5` and chunk-name constants form a contiguous data table near `0x1420710F8`. This suggests a potential common binary-font loader, but these are raw matches within the `.text` and `.rdata` blocks. The Ghidra Safe project recognizes no function boundary at the code locations, so the extraction **does not yet establish** the instruction context, call graph, KERN record layout, or connection to the in-memory glyph-pair tables.

Next: use read-only pseudo-disassembly in this bounded region, verify instructions and referenced data, enumerate direct calls, and check whether the code is a parser/serializer rather than an unrelated immediate literal.

## NIH Layout Studio implementation (research branch only)

Branch `research/native-image-flags-run11` descends from the Run 10 UV branch, which descends from Run 09. It introduces:
- `DecodeNativeImageWidgetFlags`: decodes `flip u` and `flip v` into bits 26/27 without guessing other ImageWidget options.
- `NativeImageFlipCssTransform`: mirror equivalent for the current axis-aligned web preview (the separate native UV routine retains exact component-level permutation for future draw paths).
- `Canvas.tsx`: applies flags to resolved ImageWidget image surfaces for both CSS background and modulated canvas paths; preserves debug labels unflipped and keeps style-chrome paths unchanged.
- Additional regression tests in `tests/native-image-uv.test.mjs`.

Native-derived helper and unit tests: 11/11 passed with strict TypeScript compilation in isolated test harness. **The full repository build/CI and Workbench visual parity have not yet been verified.**

Caution: `Canvas.tsx` still contains a legacy image-specific textual `fixaspect` interpretation. Native `fixaspect` is a shared widget geometry mode (Run 09); it should be consolidated separately rather than treated as an image texture-scaling knob.
