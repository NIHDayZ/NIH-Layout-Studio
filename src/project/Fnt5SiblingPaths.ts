/** Shared sibling-path resolution for standalone FNT5 atlas discovery. */
export function Fnt5SiblingPaths(fontPath: string): { atlasPath: string; resourceKey: string } {
 const normalized = fontPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").toLowerCase();
 if (!normalized.endsWith(".fnt"))
  throw new Error("Expected .fnt path");
 const resourceKey = normalized.slice(0, -4);
 return { atlasPath: resourceKey + ".edds", resourceKey };
}
