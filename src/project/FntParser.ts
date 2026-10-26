export interface BitmapFontGlyph {
	codePoint: number;
	x: number;
	y: number;
	width: number;
	height: number;
	leftBearing: number;
	rightBearing: number;
	advance: number;
}

export interface BitmapFontDefinition {
	name: string;
	path: string;
	nominalSize: number;
	lineHeight: number;
	ascent: number;
	descent: number;
	atlasPath: string;
	atlasUrl: string;
	atlasWidth: number;
	atlasHeight: number;
	glyphs: Map<number, BitmapFontGlyph>;
	kerning: Map<string, number>;
}

function FourCC(bytes: Uint8Array, offset: number) {
	return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function ReadU32BE(view: DataView, offset: number) {
	return view.getUint32(offset, false);
}

function ReadU32LE(view: DataView, offset: number) {
	return view.getUint32(offset, true);
}

function ReadU16LE(view: DataView, offset: number) {
	return view.getUint16(offset, true);
}

function ReadI16LE(view: DataView, offset: number) {
	return view.getInt16(offset, true);
}

function FileStem(path: string) {
	const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	const name = slash >= 0 ? path.slice(slash + 1) : path;
	return name.replace(/\.[^.]+$/, "");
}

export async function ParseDayZFnt(
	file: File,
	path: string,
	atlasPath: string,
	atlasUrl: string,
	atlasWidth: number,
	atlasHeight: number
): Promise<BitmapFontDefinition | null> {
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (bytes.length < 20 || FourCC(bytes, 0) !== "FORM" || FourCC(bytes, 8) !== "FNT3")
			return null;
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const chunks = new Map<string, Uint8Array>();
		let cursor = 12;
		while (cursor + 8 <= bytes.length) {
			const id = FourCC(bytes, cursor);
			const size = ReadU32BE(view, cursor + 4);
			const bodyStart = cursor + 8;
			const bodyEnd = bodyStart + size;
			if (bodyEnd > bytes.length)
				return null;
			chunks.set(id, bytes.slice(bodyStart, bodyEnd));
			cursor = bodyEnd;
		}

		const head = chunks.get("HEAD");
		const glps = chunks.get("GLPS");
		const tcrd = chunks.get("TCRD");
		if (!head || !glps || !tcrd || head.length < 13 || glps.length < 16 || tcrd.length % 12 !== 0)
			return null;

		const headView = new DataView(head.buffer, head.byteOffset, head.byteLength);
		const nameLength = ReadU32LE(headView, 0);
		let name = FileStem(path);
		if (nameLength > 0 && 4 + nameLength <= head.length) {
			const raw = new TextDecoder().decode(head.slice(4, 4 + nameLength));
			name = raw.replace(/\0+$/, "") || name;
		}
		const nominalOffset = 4 + nameLength;
		const nominalSize = nominalOffset + 4 <= head.length ? ReadU32LE(headView, nominalOffset) : 12;

		const glpsView = new DataView(glps.buffer, glps.byteOffset, glps.byteLength);

		// FNT3 stores two compact vertical metrics before the GLPS counters.
		// Existing DayZ fonts use 1/16-pixel fixed-point values here. For example,
		// Bender12 contains 176 and 50, which correspond to an ~11 px ascent and
		// ~3.125 px descent. Fall back to atlas-cell metrics if a font does not fit
		// that pattern.
		const rawAscent = ReadU16LE(glpsView, 0);
		const rawDescent = ReadU16LE(glpsView, 2);
		let ascent = rawAscent / 16;
		let descent = rawDescent / 16;
		if (!(ascent > 0 && ascent < nominalSize * 2.5 && descent >= 0 && descent < nominalSize * 1.5)) {
			ascent = nominalSize;
			descent = Math.max(1, nominalSize * 0.2);
		}
		let lineHeight = Math.max(1, ascent + descent);

		const glyphCount = ReadU32LE(glpsView, 8);
		const rangeCount = ReadU32LE(glpsView, 12);
		if (glyphCount <= 0 || glyphCount > 65536 || rangeCount > 4096 || 16 + rangeCount * 4 > glps.length)
			return null;

		const codePoints: number[] = [];
		for (let i = 0; i < rangeCount; ++i) {
			const offset = 16 + i * 4;
			const start = ReadU16LE(glpsView, offset);
			const count = ReadU16LE(glpsView, offset + 2);
			for (let codePoint = start; codePoint < start + count; ++codePoint)
				codePoints.push(codePoint);
		}

		const recordCount = Math.min(glyphCount, Math.floor(tcrd.length / 12), codePoints.length);
		const tcrdView = new DataView(tcrd.buffer, tcrd.byteOffset, tcrd.byteLength);
		const rawGlyphs: Omit<BitmapFontGlyph, "advance">[] = [];
		for (let i = 0; i < recordCount; ++i) {
			const offset = i * 12;
			rawGlyphs.push({
				codePoint: codePoints[i],
				x: ReadU16LE(tcrdView, offset),
				y: ReadU16LE(tcrdView, offset + 2),
				width: ReadU16LE(tcrdView, offset + 4),
				height: ReadU16LE(tcrdView, offset + 6),
				leftBearing: ReadI16LE(tcrdView, offset + 8),
				rightBearing: ReadI16LE(tcrdView, offset + 10)
			});
		}

		const maxCellHeight = rawGlyphs.reduce((maximum, glyph) => Math.max(maximum, glyph.height), 0);
		lineHeight = Math.max(lineHeight, maxCellHeight);

		const glyphs = new Map<number, BitmapFontGlyph>();
		for (const glyph of rawGlyphs) {
			// The two signed TCRD values are horizontal side bearings. This is
			// visible in DayZ fonts such as Bender12: space is width 0 with a
			// +4 right bearing, while narrow/wide glyphs carry small negative or
			// positive side adjustments. They are not X/Y drawing offsets.
			const advance = Math.max(0, glyph.leftBearing + glyph.width + glyph.rightBearing);
			glyphs.set(glyph.codePoint, { ...glyph, advance });
		}

		const kerning = new Map<string, number>();
		const kern = chunks.get("KERN");
		if (kern && kern.length % 8 === 0) {
			const kernView = new DataView(kern.buffer, kern.byteOffset, kern.byteLength);
			for (let offset = 0; offset < kern.length; offset += 8) {
				const left = ReadU16LE(kernView, offset);
				const right = ReadU16LE(kernView, offset + 2);
				const xAdjust = ReadI16LE(kernView, offset + 4);
				kerning.set(`${left}:${right}`, xAdjust);
			}
		}

		return {
			name,
			path,
			nominalSize: nominalSize > 0 && nominalSize < 512 ? nominalSize : 12,
			lineHeight,
			ascent,
			descent,
			atlasPath,
			atlasUrl,
			atlasWidth,
			atlasHeight,
			glyphs,
			kerning
		};
	} catch (error) {
		console.warn(`NIH Layout Studio: could not parse FNT ${file.name}`, error);
		return null;
	}
}
