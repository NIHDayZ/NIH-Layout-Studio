# Workbench native target trace — Run 09 (2026-10-29)

**Scope:** static interoperability analysis of the pinned `WorkbenchApp.exe` build. This document records native behavior and addresses, not Bohemia source code. No original binaries or decompiled pseudocode are committed.

**Binary SHA-256:** `8fa4c688f28cb1214bb339aa93b451c4208a692a69ece8001d0f0ad0dd9fba85`

## Extraction results

- Ghidra Safe-project reuse; full automatic analysis disabled; 22 functions attempted, 20 decompiled, zero decompiler errors and zero truncations.
- Two sites lack recognized function boundaries: `0x1408B4BE8` (property-registration instruction inside code, **not** a function entry) and `0x140B55030` (resource helper).
- Memory probes are not on their own proof of a call graph. Cross-check instructions and field usage separately.

## Confirmed: `fixaspect` controls common widget aspect modes

1. At VA `0x1408B4BE8`, the bytes `4C 8D 05 01 10 7B 01` are an x64 RIP-relative LEA. Its target is `0x142065BF0`, the ASCII `fixaspect` property string.
2. At VA `0x1408B4C0B`, the bytes `89 05 7F EE 88 05` are an x64 RIP-relative store; destination `0x146143A90`. These two instructions occur in the same registration sequence.
3. Common widget property loader `0x1408BA840` uses global property token `0x146143A90`, defaults missing value to zero, and writes its two low bits into widget flags bits 13:12 at object offset `+0xA8`.
4. Shared rectangle resolver `0x1408B8C70` consumes the bits and applies the corresponding sizing rules before calling common anchor/alignment helper `0x1408B8940`.

| Mode | Native shared rectangle sizing |
| --- | --- |
| 0 | Leave normally resolved width/height unchanged |
| 1 | Derive width from authored width/height ratio and the resolved height |
| 2 | Contain/fit within the available parent rectangle |
| 3 | Cover the available parent rectangle |

Any exact-size axis (native flag bits 4 or 5) bypasses the aspect adjustment. Zero authored dimensions or zero parent dimensions lead to no-op cases in modes 1–3.

The reusable `NativeAspectSizing.ts` size-only helper was prototyped in Run 08; Run 09 closes the missing authored-property mapping. Research branch `research/native-fixaspect-run09` wires it to `WidgetGeometry.ts` and adds direct regression tests; this is **not** merged into PR #47. Parent-relative measurements, DPI paths, safe-area constraints, and container-specific arrangement are separate native concerns.

## Confirmed: font pair-adjustment table lookup

- Distance font pair helper `0x1408E2980` uses a sorted table of 8-byte records, pointer at object offset `+0x78`, count at `+0x84`.
- Bitmap font pair helper `0x1408EEBA0` uses the same search shape, pointer at `+0x88`, count at `+0x94`.
- Search key is packed from two 16-bit character arguments into one 32-bit key. It performs a binary search and returns zero when no match exists; matched records have a 32-bit value at `+4`.
- Each class's per-glyph advance helper (`0x1408E2890` for distance, `0x1408ED740` for bitmap) adds/scales the pair contribution alongside glyph metrics.

**Not yet proven:** source FNT3/FNT5 chunk/record encoding for pair data; whether the saved 32-bit value is float or integral in a particular loader; exact current/next character order at every call site; fallback and optional spacing policy in all TextWidget modes. Do not silently inject speculative kerning into the production preview.

## Confirmed: ImageWidget dispatch chain

- Native ImageWidget render method `0x1408B2480` selects a resource from the image slots using index at object offset `+0x188`. It builds an optional texture-rectangle argument from a selected resource and calls `0x1408EA750`.
- Helper `0x1408EA750` reads the native widget rectangle (`+0x88` through `+0x94`). Under a flag passed from the widget, it applies a coordinate transformation/rounding helper, then forwards the drawing request to a renderer virtual method at offset `+0x90`.
- ImageWidget property loader `0x1408B1790` populates additional drawing parameters, resource pointers, and flags.

**Not yet proven:** complete mapping from all authored image properties to native arguments, drawing mode semantics, texture-rectangle interpretation, blending/scissor behavior, and the final renderer implementation.

## Next research priorities

1. Identify the serializer/resource loader that fills the pair-adjustment arrays, then map those records to actual FNT3/FNT5 chunks.
2. Trace the ImageWidget rendering interface virtual method called at `+0x90` and map authored image drawing flags.
3. Extend the common widget measurement/arrangement specification with aspect mode, scale, safe-area, and clipping distinctions. Use native evidence and multiple test layouts, not single-widget patches.

Research artifacts remain local/private; do not commit native binaries or lengthy proprietary decompilation output.
