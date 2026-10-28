# Original Metron FNT5 atlas measurement (2026-10-27)

Measured original `gui` assets: `sdf_MetronLight24`, `sdf_MetronBook24`, and `sdf_MetronBook72`. Glyphs A, F, 0, and 1 were sampled from decoded EDDS using a median(R,G,B) > 128 foreground threshold. Delta values below represent measured glyph foreground origin minus centered nominal glyph bounds (in atlas pixels), not renderer corrections.

| Font | Cell pitch | A dx,dy | F dx,dy | 0 dx,dy | 1 dx,dy |
| --- | ---: | --- | --- | --- | --- |
| sdf_MetronLight24 | 38 | -0.5,-1 | -1,-0.5 | 0,-1.5 | +0.5,0 |
| sdf_MetronBook24 | 38 | -1,-1 | -0.5,-0.5 | -0.5,-1.5 | -0.5,0 |
| sdf_MetronBook72 | 95 | +0.5,-2 | -2,0 | -1,-1.5 | 0,-0.5 |

## Conclusions and limits

- For these **12 samples**, observed foreground bounds agree with centered cell padding to within two atlas pixels, consistent with raster thresholds and distance-field expansion.
- TCRD fields 4/5 should **not** be added directly to cell origin as atlas ink offsets: the resulting candidate rectangle misses substantial median-threshold foreground.
- These tests do **not** establish final widget baseline, pen advances, bearing interpretation, or scaling correctness. Do not hard-code the measured residuals into the production renderer.
- `Fnt5Placement` uses `x = penX + (bearingX - (cellSize-width)/2)*scale` and `y = baseY + (nominalSize-bearingY-(cellSize-height)/2)*scale`. Atlas measurements constrain the padding term; they do not independently validate the meaning of either bearing field.
- Compare opt-in runtime paths with `?experimentalFnt5Cells=1&experimentalMsdf=1&debugFnt5Sampling=1` before modifying glyph placement. Standalone FNT5 now identifies its sampling path explicitly in the diagnostic log.

No original proprietary font binaries or atlas images are committed with this report.
