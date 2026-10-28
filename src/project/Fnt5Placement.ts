/** Experimental centering of nominal TCRD glyph extents inside the padded MSDF atlas cell. */
export function Fnt5Placement(cellSize: number, width: number, height: number, bearingX: number, bearingY: number, nominalSize: number, requestedSize: number, penX: number, baseY: number) {
 if (![cellSize,width,height,bearingX,bearingY,nominalSize,requestedSize,penX,baseY].every(Number.isFinite) || nominalSize <= 0 || requestedSize <= 0 || cellSize <= 0 || width < 0 || height < 0)
  return null;
 const scale = requestedSize / nominalSize;
 const paddingX = Math.max(0, (cellSize - width) / 2);
 const paddingY = Math.max(0, (cellSize - height) / 2);
 return { x: penX + (bearingX - paddingX) * scale, y: baseY + (nominalSize - bearingY - paddingY) * scale, size: cellSize * scale };
}
