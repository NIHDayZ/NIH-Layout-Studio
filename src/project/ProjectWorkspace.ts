import type {
	ImageSetDefinition,
	ImageSetImage,
	ProjectFile,
	ProjectWorkspaceModel,
	ResolvedImageResource,
	WidgetStyleDefinition
} from "./ProjectTypes";
import { DecodeEddsToObjectUrl } from "./EddsDecoder";
import { ParseDayZFnt, type BitmapFontDefinition } from "./FntParser";

function NormalizePath(path: string) {
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}

function StripGuid(path: string) {
	return path.replace(/^\{[0-9A-Fa-f]+\}/, "");
}

function Unquote(value: string) {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"'))
		return trimmed.slice(1, -1);
	return trimmed;
}

function ParsePair(value: string | undefined, fallbackA = 0, fallbackB = 0): [number, number] {
	if (!value)
		return [fallbackA, fallbackB];
	const parts = value.trim().split(/\s+/).map(Number);
	return [Number.isFinite(parts[0]) ? parts[0] : fallbackA, Number.isFinite(parts[1]) ? parts[1] : fallbackB];
}

function ExtractProperty(block: string, name: string): string | undefined {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = block.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s+([^\\r\\n]+)`, "i"));
	return match?.[1]?.trim();
}

function FindBlockBody(source: string, startIndex: number): string | null {
	const open = source.indexOf("{", startIndex);
	if (open < 0)
		return null;
	let depth = 0;
	let quoted = false;
	let escaped = false;
	for (let i = open; i < source.length; ++i) {
		const char = source[i];
		if (quoted) {
			if (escaped)
				escaped = false;
			else if (char === "\\")
				escaped = true;
			else if (char === '"')
				quoted = false;
			continue;
		}
		if (char === '"') {
			quoted = true;
			continue;
		}
		if (char === "{")
			++depth;
		else if (char === "}") {
			--depth;
			if (depth === 0)
				return source.slice(open + 1, i);
		}
	}
	return null;
}

function ParseImageSetFlags(value: string | undefined): number {
	if (!value)
		return 0;
	const trimmed = value.trim();
	const numeric = Number(trimmed);
	if (Number.isFinite(numeric))
		return numeric | 0;
	let flags = 0;
	for (const token of trimmed.split(/[+|\s]+/).filter(Boolean)) {
		if (token.toLowerCase() === "ishorizontaltile")
			flags |= 1;
		else if (token.toLowerCase() === "isverticaltile")
			flags |= 2;
	}
	return flags;
}

function ParseNativeImageSet(path: string, source: string): ImageSetDefinition | null {
	const rootMatch = source.match(/ImageSetClass\s*(?:[\w".-]+)?\s*\{/i);
	if (!rootMatch || rootMatch.index === undefined)
		return null;
	const body = FindBlockBody(source, rootMatch.index);
	if (!body)
		return null;
	const name = Unquote(ExtractProperty(body, "Name") ?? path.split("/").pop()?.replace(/\.imageset$/i, "") ?? "imageset");
	const [refWidth, refHeight] = ParsePair(ExtractProperty(body, "RefSize"), 1, 1);
	const textureBlocks = [...body.matchAll(/ImageSetTextureClass(?:\s+[\w".-]+)?\s*\{/gi)];
	let texturePath: string | null = null;
	let bestMpix = -Infinity;
	for (const match of textureBlocks) {
		if (match.index === undefined)
			continue;
		const textureBody = FindBlockBody(body, match.index);
		if (!textureBody)
			continue;
		const mpix = Number(ExtractProperty(textureBody, "mpix") ?? 0);
		const candidate = ExtractProperty(textureBody, "path");
		if (candidate && mpix >= bestMpix) {
			bestMpix = mpix;
			texturePath = StripGuid(Unquote(candidate));
		}
	}
	const images = new Map<string, ImageSetImage>();
	for (const match of body.matchAll(/ImageSetDefClass\s+("[^"]+"|[\w.-]+)\s*\{/gi)) {
		if (match.index === undefined)
			continue;
		const imageBody = FindBlockBody(body, match.index);
		if (!imageBody)
			continue;
		const imageName = Unquote(ExtractProperty(imageBody, "Name") ?? match[1]);
		const [x, y] = ParsePair(ExtractProperty(imageBody, "Pos"));
		const [width, height] = ParsePair(ExtractProperty(imageBody, "Size"));
		const flags = ParseImageSetFlags(ExtractProperty(imageBody, "Flags"));
		images.set(imageName.toLowerCase(), { name: imageName, x, y, width, height, flags });
	}
	return { name, path, texturePath, refWidth, refHeight, images };
}

function ParseXmlImageSet(path: string, source: string): ImageSetDefinition | null {
	if (!source.trimStart().startsWith("<"))
		return null;
	const root = source.match(/<imageset\b([^>]*)>/i);
	if (!root)
		return null;
	const Attr = (text: string, name: string) => text.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
	const name = Attr(root[1], "name") ?? path.split("/").pop()?.replace(/\.imageset$/i, "") ?? "imageset";
	const texturePath = Attr(root[1], "file") ?? null;
	const images = new Map<string, ImageSetImage>();
	for (const match of source.matchAll(/<image\b([^>]*)\/?\s*>/gi)) {
		const imageName = Attr(match[1], "name");
		if (!imageName)
			continue;
		const [x, y] = ParsePair(Attr(match[1], "pos"));
		const [width, height] = ParsePair(Attr(match[1], "size"));
		images.set(imageName.toLowerCase(), { name: imageName, x, y, width, height, flags: 0 });
	}
	let refWidth = 1;
	let refHeight = 1;
	for (const image of images.values()) {
		refWidth = Math.max(refWidth, image.x + image.width);
		refHeight = Math.max(refHeight, image.y + image.height);
	}
	return { name, path, texturePath, refWidth, refHeight, images };
}


function ParseWidgetStyles(path: string, source: string): WidgetStyleDefinition[] {
	const result: WidgetStyleDefinition[] = [];
	if (!source.includes("<WidgetStyles"))
		return result;
	const parser = new DOMParser();
	const xml = parser.parseFromString(source, "application/xml");
	// Reject actual DTD declarations, not declaration-like text in comments or CDATA.
	if (xml.doctype || xml.querySelector("parsererror") || xml.documentElement?.tagName !== "WidgetStyles")
		return result;
	for (const widget of Array.from(xml.querySelectorAll("Widget"))) {
		const widgetType = widget.getAttribute("Name") ?? "";
		if (!widgetType)
			continue;
		for (const style of Array.from(widget.children).filter((child) => child.tagName === "Style")) {
			const name = style.getAttribute("Name") ?? "";
			if (!name)
				continue;
			const states = new Map<string, Map<string, string>>();
			for (const state of Array.from(style.children).filter((child) => child.tagName === "State")) {
				const stateName = (state.getAttribute("Name") ?? "").trim().toLowerCase();
				if (!stateName)
					continue;
				const items = new Map<string, string>();
				for (const item of Array.from(state.children).filter((child) => child.tagName === "Item")) {
					const itemName = item.getAttribute("Name") ?? "";
					const image = item.getAttribute("Image") ?? "";
					if (itemName)
						items.set(itemName.toLowerCase(), image);
				}
				states.set(stateName, items);
			}
			const normalItems = states.get("normal") ?? new Map<string, string>();
			const colorRaw = style.getAttribute("Color");
			const color = colorRaw !== null && /^\d+$/.test(colorRaw) ? Number(colorRaw) : null;
			result.push({ name, widgetType, font: style.getAttribute("Font"), imageSet: style.getAttribute("ImageSet"), color, states, normalItems, sourcePath: path });
		}
	}
	return result;
}

export function ParseImageSetSource(path: string, source: string): ImageSetDefinition | null {
	return ParseXmlImageSet(path, source) ?? ParseNativeImageSet(path, source);
}

function GetProjectRelativePath(file: File): string {
	const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
	return NormalizePath(relative || file.name);
}

function GetRootName(files: File[]) {
	const first = files[0];
	if (!first)
		return "Project";
	const path = GetProjectRelativePath(first);
	return path.includes("/") ? path.split("/")[0] : "Project";
}

function RemoveRoot(path: string, rootName: string) {
	const prefix = `${rootName}/`;
	return path.toLowerCase().startsWith(prefix.toLowerCase()) ? path.slice(prefix.length) : path;
}

function FindFile(files: ProjectFile[], resourcePath: string): ProjectFile | undefined {
	const cleaned = NormalizePath(StripGuid(resourcePath)).replace(/^\//, "").toLowerCase();
	return files.find((candidate) => {
		const path = candidate.path.toLowerCase();
		return path === cleaned || path.endsWith(`/${cleaned}`) || cleaned.endsWith(`/${path}`);
	});
}

function FileStem(path: string) {
	const normalized = NormalizePath(path);
	const name = normalized.split("/").pop() ?? normalized;
	return name.replace(/\.[^.]+$/, "").toLowerCase();
}

function AddImageSetAlias(aliases: Map<string, ImageSetDefinition>, key: string | null | undefined, set: ImageSetDefinition) {
	if (!key)
		return;
	const normalized = NormalizePath(StripGuid(key)).replace(/^\//, "").toLowerCase();
	if (!normalized)
		return;
	aliases.set(normalized, set);
	aliases.set(FileStem(normalized), set);
}

function FindAtlasSource(files: ProjectFile[], texturePath: string): ProjectFile | undefined {
	const renderableExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tga"];
	const direct = FindFile(files, texturePath);
	if (direct && renderableExtensions.includes(direct.extension))
		return direct;

	const cleanTexturePath = NormalizePath(StripGuid(texturePath));
	const base = cleanTexturePath.replace(/\.(edds|paa)$/i, "");
	for (const extension of renderableExtensions) {
		const candidate = FindFile(files, `${base}${extension}`);
		if (candidate)
			return candidate;
	}

	// Source atlases are frequently kept outside the packed GUI tree (for example
	// under .gui-sources). Fall back to an unambiguous basename match.
	const wantedStem = FileStem(base);
	const stemMatches = files.filter((candidate) => renderableExtensions.includes(candidate.extension) && FileStem(candidate.path) === wantedStem);
	if (stemMatches.length === 1)
		return stemMatches[0];

	return undefined;
}

async function DecodeTgaToObjectUrl(file: File): Promise<string | null> {
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (bytes.length < 18)
			return null;
		const idLength = bytes[0];
		const colorMapType = bytes[1];
		const imageType = bytes[2];
		const width = bytes[12] | (bytes[13] << 8);
		const height = bytes[14] | (bytes[15] << 8);
		const bitsPerPixel = bytes[16];
		const descriptor = bytes[17];
		if (colorMapType !== 0 || (imageType !== 2 && imageType !== 10) || (bitsPerPixel !== 24 && bitsPerPixel !== 32) || width <= 0 || height <= 0)
			return null;
		const bytesPerPixel = bitsPerPixel / 8;
		let offset = 18 + idLength;
		const pixelCount = width * height;
		const rgba = new Uint8ClampedArray(pixelCount * 4);
		let pixelIndex = 0;
		const ReadPixel = () => {
			if (offset + bytesPerPixel > bytes.length)
				return null;
			const b = bytes[offset++];
			const g = bytes[offset++];
			const r = bytes[offset++];
			const a = bytesPerPixel === 4 ? bytes[offset++] : 255;
			return [r, g, b, a] as const;
		};
		const WritePixel = (pixel: readonly [number, number, number, number]) => {
			const target = pixelIndex * 4;
			rgba[target] = pixel[0];
			rgba[target + 1] = pixel[1];
			rgba[target + 2] = pixel[2];
			rgba[target + 3] = pixel[3];
			++pixelIndex;
		};
		if (imageType === 2) {
			while (pixelIndex < pixelCount) {
				const pixel = ReadPixel();
				if (!pixel)
					return null;
				WritePixel(pixel);
			}
		} else {
			while (pixelIndex < pixelCount && offset < bytes.length) {
				const packet = bytes[offset++];
				const count = (packet & 0x7f) + 1;
				if (packet & 0x80) {
					const pixel = ReadPixel();
					if (!pixel)
						return null;
					for (let i = 0; i < count && pixelIndex < pixelCount; ++i)
						WritePixel(pixel);
				} else {
					for (let i = 0; i < count && pixelIndex < pixelCount; ++i) {
						const pixel = ReadPixel();
						if (!pixel)
							return null;
						WritePixel(pixel);
					}
				}
			}
		}
		const topOrigin = (descriptor & 0x20) !== 0;
		const rightOrigin = (descriptor & 0x10) !== 0;
		const normalized = new Uint8ClampedArray(rgba.length);
		for (let y = 0; y < height; ++y) {
			for (let x = 0; x < width; ++x) {
				const sourceX = rightOrigin ? width - 1 - x : x;
				const sourceY = topOrigin ? y : height - 1 - y;
				const source = (sourceY * width + sourceX) * 4;
				const target = (y * width + x) * 4;
				normalized[target] = rgba[source];
				normalized[target + 1] = rgba[source + 1];
				normalized[target + 2] = rgba[source + 2];
				normalized[target + 3] = rgba[source + 3];
			}
		}
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context)
			return null;
		context.putImageData(new ImageData(normalized, width, height), 0, 0);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
		return blob ? URL.createObjectURL(blob) : null;
	} catch {
		return null;
	}
}

export async function BuildProjectWorkspace(inputFiles: File[]): Promise<ProjectWorkspaceModel> {
	// Timings are diagnostic only: no resource-processing order or output changes.
	const timingStart = performance.now();
	let timingLast = timingStart;
	const timingStages: Array<{ stage: string; milliseconds: number }> = [];
	function MarkStage(stage: string) {
		const now = performance.now();
		timingStages.push({ stage, milliseconds: Math.round((now - timingLast) * 10) / 10 });
		timingLast = now;
	}
	const name = GetRootName(inputFiles);
	const files: ProjectFile[] = inputFiles.map((file) => {
		const fullPath = GetProjectRelativePath(file);
		const path = RemoveRoot(fullPath, name);
		const lowerName = file.name.toLowerCase();
		const dot = lowerName.lastIndexOf(".");
		return { path, name: file.name, extension: dot >= 0 ? lowerName.slice(dot) : "", file };
	}).sort((a, b) => a.path.localeCompare(b.path));
	const filesByPath = new Map(files.map((file) => [file.path.toLowerCase(), file]));
	MarkStage("file paths / indexing");
	const imageSets = new Map<string, ImageSetDefinition>();
	const imageSetAliases = new Map<string, ImageSetDefinition>();
	const widgetStyles = new Map<string, WidgetStyleDefinition[]>();
	for (const file of files.filter((candidate) => candidate.extension === ".imageset")) {
		const source = await file.file.text();
		const parsed = ParseImageSetSource(file.path, source);
		if (!parsed)
			continue;

		imageSets.set(parsed.name.toLowerCase(), parsed);
		AddImageSetAlias(imageSetAliases, parsed.name, parsed);
		AddImageSetAlias(imageSetAliases, file.path, parsed);
		AddImageSetAlias(imageSetAliases, file.name, parsed);
		AddImageSetAlias(imageSetAliases, parsed.texturePath, parsed);
	}

	MarkStage("imageset metadata");
	for (const file of files.filter((candidate) => candidate.extension === ".styles")) {
		const source = await file.file.text();
		for (const style of ParseWidgetStyles(file.path, source)) {
			const key = style.widgetType.toLowerCase();
			const list = widgetStyles.get(key) ?? [];
			list.push(style);
			widgetStyles.set(key, list);
		}
	}

	MarkStage("widget styles");
	const resourceObjectUrls = new Map<string, string>();
	const resourceDimensions = new Map<string, { width: number; height: number }>();
	const eddsDecoded = new Set<string>();
	const eddsFailed = new Map<string, string>();
	for (const file of files.filter((candidate) => candidate.extension === ".tga")) {
		const url = await DecodeTgaToObjectUrl(file.file);
		if (url)
			resourceObjectUrls.set(file.path, url);
	}

	MarkStage("TGA decoding");
	for (const file of files.filter((candidate) => candidate.extension === ".edds")) {
		const decoded = await DecodeEddsToObjectUrl(file.file);
		if (decoded) {
			resourceObjectUrls.set(file.path, decoded.url);
			resourceDimensions.set(file.path, { width: decoded.width, height: decoded.height });
			eddsDecoded.add(file.path);
		} else {
			eddsFailed.set(file.path, "Unsupported or invalid EDDS/DDS format");
		}
	}

	MarkStage("EDDS decoding");
	const bitmapFonts = new Map<string, BitmapFontDefinition>();
	for (const fontFile of files.filter((candidate) => candidate.extension === ".fnt")) {
		const stem = FileStem(fontFile.path);
		const atlas = files.find((candidate) => candidate.extension === ".edds" && FileStem(candidate.path) === stem);
		if (!atlas)
			continue;
		const atlasUrl = resourceObjectUrls.get(atlas.path);
		const dimensions = resourceDimensions.get(atlas.path);
		if (!atlasUrl || !dimensions)
			continue;
		const parsed = await ParseDayZFnt(fontFile.file, fontFile.path, atlas.path, atlasUrl, dimensions.width, dimensions.height);
		if (!parsed)
			continue;
		const pathKey = NormalizePath(fontFile.path).replace(/\.fnt$/i, "").toLowerCase();
		bitmapFonts.set(pathKey, parsed);
		bitmapFonts.set(stem.toLowerCase(), parsed);
	}

	MarkStage("bitmap font parsing");
	const fontFamilies = new Map<string, string>();
	const fontObjectUrls: string[] = [];
	for (const file of files.filter((candidate) => [".ttf", ".otf", ".woff", ".woff2"].includes(candidate.extension))) {
		const family = `NIH_${file.path.replace(/[^a-zA-Z0-9]+/g, "_")}`;
		const url = URL.createObjectURL(file.file);
		fontObjectUrls.push(url);
		try {
			const font = new FontFace(family, `url(${url})`);
			await font.load();
			(document.fonts as FontFaceSet & { add(font: FontFace): void }).add(font);
			const normalizedPath = file.path.replace(/\.(ttf|otf|woff2?)$/i, "").toLowerCase();
			fontFamilies.set(normalizedPath, family);
			fontFamilies.set(file.name.replace(/\.(ttf|otf|woff2?)$/i, "").toLowerCase(), family);
		} catch {
			// Keep the project usable even if one font cannot be decoded by the browser.
		}
	}
	MarkStage("browser font loading");
	const totalMilliseconds = Math.round((performance.now() - timingStart) * 10) / 10;
	console.info("[NIH Layout Studio] Resource indexing timings", {
		workspace: name,
		fileCount: files.length,
		counts: {
			imagesets: files.filter((file) => file.extension === ".imageset").length,
			styles: files.filter((file) => file.extension === ".styles").length,
			tga: files.filter((file) => file.extension === ".tga").length,
			edds: files.filter((file) => file.extension === ".edds").length,
			eddsDecoded: eddsDecoded.size,
			eddsFailed: eddsFailed.size,
			bitmapFonts: files.filter((file) => file.extension === ".fnt").length,
			webFonts: files.filter((file) => [".ttf", ".otf", ".woff", ".woff2"].includes(file.extension)).length
		},
		totalMilliseconds,
		stages: timingStages
	});
	return { name, files, filesByPath, imageSets, imageSetAliases, widgetStyles, fontFamilies, bitmapFonts, fontObjectUrls, resourceObjectUrls, eddsDecoded, eddsFailed };
}

export function DisposeProjectWorkspace(project: ProjectWorkspaceModel | null) {
	if (!project)
		return;
	for (const url of project.fontObjectUrls)
		URL.revokeObjectURL(url);
	for (const url of project.resourceObjectUrls.values())
		URL.revokeObjectURL(url);
}


export function ResolveProjectBitmapFont(project: ProjectWorkspaceModel | null, fontPath: string | undefined): BitmapFontDefinition | undefined {
	if (!project || !fontPath)
		return undefined;
	const cleaned = NormalizePath(StripGuid(Unquote(fontPath))).replace(/\.fnt$/i, "").toLowerCase();
	for (const [path, font] of project.bitmapFonts) {
		if (path === cleaned || path.endsWith(`/${cleaned}`) || cleaned.endsWith(`/${path}`) || cleaned.endsWith(path))
			return font;
	}
	return undefined;
}

export function ResolveProjectFont(project: ProjectWorkspaceModel | null, fontPath: string | undefined): string | undefined {
	if (!project || !fontPath)
		return undefined;
	const cleaned = NormalizePath(StripGuid(Unquote(fontPath))).replace(/\.(ttf|otf|woff2?)$/i, "").toLowerCase();
	for (const [path, family] of project.fontFamilies) {
		if (path === cleaned || path.endsWith(`/${cleaned}`) || cleaned.endsWith(`/${path}`) || cleaned.endsWith(path))
			return family;
	}
	return undefined;
}

function GetResourceObjectUrl(project: ProjectWorkspaceModel, file: ProjectFile) {
	let url = project.resourceObjectUrls.get(file.path);
	if (!url) {
		url = URL.createObjectURL(file.file);
		project.resourceObjectUrls.set(file.path, url);
	}
	return url;
}

export function ResolveImageSetAtlasUrl(project: ProjectWorkspaceModel | null, set: ImageSetDefinition | null | undefined): string | null {
	if (!project || !set?.texturePath)
		return null;
	const atlas = FindAtlasSource(project.files, set.texturePath);
	if (atlas)
		return GetResourceObjectUrl(project, atlas);
	const cookedAtlas = FindFile(project.files, set.texturePath);
	if (cookedAtlas?.extension === ".edds")
		return project.resourceObjectUrls.get(cookedAtlas.path) ?? null;
	return null;
}

export function ResolveProjectImage(project: ProjectWorkspaceModel | null, imageReference: string | undefined): ResolvedImageResource | null {
	if (!project || !imageReference)
		return null;
	const unquoted = Unquote(imageReference);
	const setMatch = unquoted.match(/set:([^\s]+)\s+image:(.+)$/i);
	if (setMatch) {
		const requestedSet = setMatch[1].trim().toLowerCase();
		const requestedImage = setMatch[2].trim().replace(/^"|"$/g, "").toLowerCase();
		let set = project.imageSets.get(requestedSet) ?? project.imageSetAliases.get(requestedSet);

		// When the set alias differs from the authoring filename, a unique image-name
		// match is still useful and mirrors how a human would diagnose the resource.
		if (!set) {
			const candidates = Array.from(project.imageSets.values()).filter((candidate) => candidate.images.has(requestedImage));
			if (candidates.length === 1)
				set = candidates[0];
		}

		// Some mod projects keep individual authoring images (for example
		// defaultraid.png) but only ship an .edds atlas at runtime. Prefer the
		// imageset metadata when available, but fall back to a unique source image
		// whose basename matches the requested sprite.
		if (!set) {
			const directByImageName = project.files.filter((candidate) =>
				[".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tga"].includes(candidate.extension) &&
				FileStem(candidate.path) === requestedImage
			);
			if (directByImageName.length === 1) {
				const direct = directByImageName[0];
				return { url: GetResourceObjectUrl(project, direct), x: 0, y: 0, width: 1, height: 1, atlasWidth: 1, atlasHeight: 1 };
			}
			return null;
		}
		const image = set.images.get(requestedImage);
		if (!image)
			return null;
		if (!set.texturePath)
			return null;
		const atlas = FindAtlasSource(project.files, set.texturePath);
		let atlasUrl: string | null = atlas ? GetResourceObjectUrl(project, atlas) : null;
		if (!atlasUrl) {
			const cookedAtlas = FindFile(project.files, set.texturePath);
			if (cookedAtlas?.extension === ".edds")
				atlasUrl = project.resourceObjectUrls.get(cookedAtlas.path) ?? null;
		}
		if (!atlasUrl) {
			const directByImageName = project.files.filter((candidate) =>
				[".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tga"].includes(candidate.extension) &&
				FileStem(candidate.path) === requestedImage
			);
			if (directByImageName.length === 1) {
				const direct = directByImageName[0];
				return { url: GetResourceObjectUrl(project, direct), x: 0, y: 0, width: 1, height: 1, atlasWidth: 1, atlasHeight: 1 };
			}
			return null;
		}
		return {
			url: atlasUrl,
			x: image.x,
			y: image.y,
			width: image.width,
			height: image.height,
			atlasWidth: set.refWidth,
			atlasHeight: set.refHeight
		};
	}
	const direct = FindFile(project.files, unquoted);
	if (direct && [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tga"].includes(direct.extension)) {
		return { url: GetResourceObjectUrl(project, direct), x: 0, y: 0, width: 1, height: 1, atlasWidth: 1, atlasHeight: 1 };
	}

	// If a layout points at a cooked .edds/.paa texture, try to find its authoring
	// source image elsewhere in the opened project.
	if (/\.(edds|paa)$/i.test(unquoted)) {
		const cooked = FindFile(project.files, unquoted);
		if (cooked?.extension === ".edds") {
			const decodedUrl = project.resourceObjectUrls.get(cooked.path);
			if (decodedUrl)
				return { url: decodedUrl, x: 0, y: 0, width: 1, height: 1, atlasWidth: 1, atlasHeight: 1 };
		}
		const source = FindAtlasSource(project.files, unquoted);
		if (source)
			return { url: GetResourceObjectUrl(project, source), x: 0, y: 0, width: 1, height: 1, atlasWidth: 1, atlasHeight: 1 };
	}

	return null;
}


export function ResolveProjectWidgetStyle(project: ProjectWorkspaceModel | null, widgetType: string, styleName: string | undefined): WidgetStyleDefinition | undefined {
	if (!project || !styleName)
		return undefined;
	const normalizedWidget = widgetType.replace(/Class$/i, "").toLowerCase();
	const styles = project.widgetStyles.get(normalizedWidget);
	if (!styles)
		return undefined;
	const wanted = Unquote(styleName).toLowerCase();
	return styles.find((style) => style.name.toLowerCase() === wanted);
}
