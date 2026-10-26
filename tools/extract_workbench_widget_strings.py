#!/usr/bin/env python3
"""Extract readable widget/property metadata windows from WorkbenchApp.exe.

This is intentionally conservative: it does not attempt to reconstruct native code.
It records printable strings and byte offsets around widget/editor anchors so schema
entries can be reviewed before being promoted into Layout Studio.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ANCHORS = [
    b"TextWidgetClass", b"MultilineTextWidgetClass", b"RichTextWidgetClass",
    b"ImageWidgetClass", b"ButtonWidgetClass", b"CheckBoxWidgetClass",
    b"SliderWidgetClass", b"SpacerBaseWidgetClass", b"SpacerWidgetClass",
    b"GridSpacerWidgetClass", b"WrapSpacerWidgetClass", b"ScrollWidgetClass",
    b"BooleanPropertyCheckBox", b"IntegerPropertyComboBox", b"ColorProperty",
    b"FlagsProperty", b"WidgetOffsetProperty", b"WidgetAnchorProperty",
    b"AlignmentProperty",
]
PRINTABLE = re.compile(rb"[\x20-\x7e]{3,}")

def strings(data: bytes):
    return [(m.start(), m.group().decode("ascii", "replace")) for m in PRINTABLE.finditer(data)]

def main() -> int:
    if len(sys.argv) < 2:
        print("usage: extract_workbench_widget_strings.py WorkbenchApp.exe [output.json]", file=sys.stderr)
        return 2
    exe = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("workbench_widget_metadata.json")
    data = exe.read_bytes()
    found = strings(data)
    rows = []
    for anchor in ANCHORS:
        pos = data.find(anchor)
        if pos < 0:
            continue
        nearby = [{"offset": hex(off), "text": text} for off, text in found if pos - 256 <= off <= pos + 4096]
        rows.append({"anchor": anchor.decode(), "offset": hex(pos), "strings": nearby})
    out.write_text(json.dumps({"executable": exe.name, "anchors": rows}, indent=2), encoding="utf-8")
    print(f"wrote {out} ({len(rows)} anchors)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
