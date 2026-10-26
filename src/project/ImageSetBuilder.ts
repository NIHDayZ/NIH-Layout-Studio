import { DecodeImageSourceToRgba, EncodeRgbaToEdds, type EddsEncodeOptions, type EddsEncodeResult, type RgbaLevel } from "./EddsEncoder";
import { ParseImageSetSource } from "./ProjectWorkspace";

export const MAX_DAYZ_ATLAS_SIZE = 4096;

export interface AtlasEntry {
	name: string;
	file: File;
	x: number;
	y: number;
	width: number;
	height: number;
	flags: number;
}

export interface ImageSetSourceFile {
	file: File;
	flags?: number;
}

export interface ImageSetBuildOptions extends EddsEncodeOptions {
	name: string;
	padding: number;
	texturePathPrefix?: string;
}

export interface ImageSetBuildPart {
	name: string;
	atlas: RgbaLevel;
	entries: AtlasEntry[];
	edds: EddsEncodeResult;
	imageSetText: string;
}

export interface ImageSetBuildResult {
	parts: ImageSetBuildPart[];
	entryCount: number;
}

interface DecodedItem {
	file: File;
	level: RgbaLevel;
	name: string;
	flags: number;
}

interface Placement {
	item: DecodedItem;
	x: number;
	y: number;
}

function NextPowerOfTwo(value: number) {
	let result = 1;
	while (result < value)
		result <<= 1;
	return result;
}

function SafeName(fileName: string) {
	const stem = fileName.replace(/\.[^.]+$/, "");
	const cleaned = stem.replace(/[^A-Za-z0-9_]/g, "_").replace(/^([0-9])/, "_$1");
	return cleaned || "Image";
}

function UniqueNames(items: Array<{ file: File; level: RgbaLevel; flags: number }>): DecodedItem[] {
	const usedNames = new Set<string>();
	return items.map((item) => {
		const baseName = SafeName(item.file.name);
		let name = baseName;
		let suffix = 2;
		while (usedNames.has(name.toLowerCase()))
			name = `${baseName}_${suffix++}`;
		usedNames.add(name.toLowerCase());
		return { ...item, name };
	});
}

function TryPlaceOnShelf(
	placements: Placement[],
	item: DecodedItem,
	padding: number,
	state: { x: number; y: number; rowHeight: number }
) {
	let { x, y, rowHeight } = state;
	if (x + item.level.width + padding > MAX_DAYZ_ATLAS_SIZE) {
		x = padding;
		y += rowHeight + padding;
		rowHeight = 0;
	}
	if (y + item.level.height + padding > MAX_DAYZ_ATLAS_SIZE)
		return false;
	placements.push({ item, x, y });
	state.x = x + item.level.width + padding;
	state.y = y;
	state.rowHeight = Math.max(rowHeight, item.level.height);
	return true;
}

function PackIntoParts(items: DecodedItem[], padding: number) {
	const parts: Placement[][] = [];
	let placements: Placement[] = [];
	let state = { x: padding, y: padding, rowHeight: 0 };

	for (const item of items) {
		if (item.level.width + padding * 2 > MAX_DAYZ_ATLAS_SIZE || item.level.height + padding * 2 > MAX_DAYZ_ATLAS_SIZE)
			throw new Error(`${item.file.name} is ${item.level.width}×${item.level.height} and cannot fit inside a ${MAX_DAYZ_ATLAS_SIZE}×${MAX_DAYZ_ATLAS_SIZE} DayZ atlas with ${padding}px padding`);

		if (!TryPlaceOnShelf(placements, item, padding, state)) {
			if (placements.length === 0)
				throw new Error(`${item.file.name} cannot fit inside a ${MAX_DAYZ_ATLAS_SIZE}×${MAX_DAYZ_ATLAS_SIZE} DayZ atlas`);
			parts.push(placements);
			placements = [];
			state = { x: padding, y: padding, rowHeight: 0 };
			if (!TryPlaceOnShelf(placements, item, padding, state))
				throw new Error(`${item.file.name} cannot fit inside a ${MAX_DAYZ_ATLAS_SIZE}×${MAX_DAYZ_ATLAS_SIZE} DayZ atlas`);
		}
	}
	if (placements.length > 0)
		parts.push(placements);
	return parts;
}

function BuildPart(name: string, placements: Placement[], padding: number, options: ImageSetBuildOptions): ImageSetBuildPart {
	const usedWidth = Math.max(...placements.map((placement) => placement.x + placement.item.level.width + padding));
	const usedHeight = Math.max(...placements.map((placement) => placement.y + placement.item.level.height + padding));
	const atlasWidth = Math.min(MAX_DAYZ_ATLAS_SIZE, NextPowerOfTwo(Math.max(1, usedWidth)));
	const atlasHeight = Math.min(MAX_DAYZ_ATLAS_SIZE, NextPowerOfTwo(Math.max(1, usedHeight)));
	if (atlasWidth > MAX_DAYZ_ATLAS_SIZE || atlasHeight > MAX_DAYZ_ATLAS_SIZE)
		throw new Error(`Packed atlas ${atlasWidth}×${atlasHeight} exceeds ${MAX_DAYZ_ATLAS_SIZE}×${MAX_DAYZ_ATLAS_SIZE}`);

	const entries: AtlasEntry[] = placements.map((placement) => ({
		name: placement.item.name,
		file: placement.item.file,
		x: placement.x,
		y: placement.y,
		width: placement.item.level.width,
		height: placement.item.level.height,
		flags: placement.item.flags
	}));
	const rgba = new Uint8ClampedArray(atlasWidth * atlasHeight * 4);
	for (let i = 0; i < placements.length; ++i) {
		const placement = placements[i];
		const entry = entries[i];
		for (let py = 0; py < placement.item.level.height; ++py) {
			const sourceStart = py * placement.item.level.width * 4;
			const targetStart = ((entry.y + py) * atlasWidth + entry.x) * 4;
			rgba.set(placement.item.level.rgba.subarray(sourceStart, sourceStart + placement.item.level.width * 4), targetStart);
		}
	}
	const atlas = { width: atlasWidth, height: atlasHeight, rgba };
	const edds = EncodeRgbaToEdds(atlas, options);
	const prefix = (options.texturePathPrefix ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const texturePath = prefix ? `${prefix}/${name}.edds` : `${name}.edds`;
	const imageSetText = [
		"ImageSetClass {",
		` Name \"${name}\"`,
		` RefSize ${atlasWidth} ${atlasHeight}`,
		" Textures {",
		"  ImageSetTextureClass {",
		"   mpix 1",
		`   path \"${texturePath}\"`,
		"  }",
		" }",
		" Images {",
		...entries.flatMap((entry) => [
			`  ImageSetDefClass ${entry.name} {`,
			`   Name \"${entry.name}\"`,
			`   Pos ${entry.x} ${entry.y}`,
			`   Size ${entry.width} ${entry.height}`,
			`   Flags ${entry.flags}` ,
			"  }"
		]),
		" }",
		" Groups {",
		" }",
		"}"
	].join("\n") + "\n";

	// Keep generated output structurally aligned with native DayZ/Workbench imagesets.
	// The project parser is intentionally permissive, so validate the canonical sections
	// separately before using it for semantic round-trip checks.
	if (!/^ImageSetClass\s*\{/m.test(imageSetText))
		throw new Error(`Generated ${name}.imageset is missing the ImageSetClass root`);
	if (!/\bTextures\s*\{/m.test(imageSetText) || !/\bImages\s*\{/m.test(imageSetText) || !/\bGroups\s*\{/m.test(imageSetText))
		throw new Error(`Generated ${name}.imageset is missing a canonical Textures, Images, or Groups section`);
	const emittedDefinitions = [...imageSetText.matchAll(/\bImageSetDefClass\s+[^\s{]+\s*\{/g)];
	const emittedFlags = [...imageSetText.matchAll(/\bFlags\s+[^\r\n}]+/g)];
	if (emittedDefinitions.length !== entries.length || emittedFlags.length !== entries.length)
		throw new Error(`Generated ${name}.imageset failed canonical sprite/Flags validation`);

	const parsed = ParseImageSetSource(`${name}.imageset`, imageSetText);
	if (!parsed)
		throw new Error(`Generated ${name}.imageset failed native imageset validation`);
	if (parsed.name !== name || parsed.refWidth !== atlasWidth || parsed.refHeight !== atlasHeight)
		throw new Error(`Generated ${name}.imageset failed header validation`);
	if (parsed.texturePath?.replace(/\\/g, "/") !== texturePath)
		throw new Error(`Generated ${name}.imageset failed texture-path validation`);
	if (parsed.images.size !== entries.length)
		throw new Error(`Generated ${name}.imageset failed sprite-count validation (${parsed.images.size}/${entries.length})`);
	for (const entry of entries) {
		const parsedEntry = parsed.images.get(entry.name.toLowerCase());
		if (!parsedEntry || parsedEntry.x !== entry.x || parsedEntry.y !== entry.y || parsedEntry.width !== entry.width || parsedEntry.height !== entry.height)
			throw new Error(`Generated ${name}.imageset failed sprite validation for ${entry.name}`);
	}

	return { name, atlas, entries, edds, imageSetText };
}

export async function BuildImageSet(inputs: Array<File | ImageSetSourceFile>, options: ImageSetBuildOptions): Promise<ImageSetBuildResult> {
	if (inputs.length === 0)
		throw new Error("Choose at least one PNG/TGA image");
	const normalizedInputs = inputs.map((input) => input instanceof File ? { file: input, flags: 0 } : { file: input.file, flags: input.flags ?? 0 });
	const decodedRaw = await Promise.all(normalizedInputs.map(async ({ file, flags }) => ({ file, flags, level: await DecodeImageSourceToRgba(file) })));
	const decoded = UniqueNames(decodedRaw);
	decoded.sort((a, b) => {
		const heightDelta = b.level.height - a.level.height;
		if (heightDelta !== 0)
			return heightDelta;
		return b.level.width - a.level.width;
	});
	const padding = Math.max(0, Math.floor(options.padding));
	const baseName = options.name.trim().replace(/[^A-Za-z0-9_]/g, "_") || "Imageset";
	const packed = PackIntoParts(decoded, padding);
	const multiple = packed.length > 1;
	const parts = packed.map((placements, index) => BuildPart(multiple ? `${baseName}_${index + 1}` : baseName, placements, padding, options));
	return { parts, entryCount: decoded.length };
}
