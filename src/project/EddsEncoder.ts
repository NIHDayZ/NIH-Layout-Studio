export type EddsPixelFormat = "bgra8" | "dxt1" | "dxt5";

export interface EddsEncodeOptions {
	generateMipmaps: boolean;
	format?: EddsPixelFormat;
}

export interface EddsEncodeResult {
	blob: Blob;
	width: number;
	height: number;
	mipCount: number;
	byteLength: number;
	format: EddsPixelFormat;
}

export interface RgbaLevel {
	width: number;
	height: number;
	rgba: Uint8ClampedArray;
}

function WriteFourCc(bytes: Uint8Array, offset: number, value: string) {
	for (let i = 0; i < 4; ++i)
		bytes[offset + i] = value.charCodeAt(i) || 0;
}

async function DecodeBrowserImage(file: File): Promise<RgbaLevel> {
	const bitmap = await createImageBitmap(file);
	try {
		const canvas = document.createElement("canvas");
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context)
			throw new Error("Canvas 2D context unavailable");
		context.drawImage(bitmap, 0, 0);
		const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
		return { width: bitmap.width, height: bitmap.height, rgba: image.data };
	} finally {
		bitmap.close();
	}
}

async function DecodeTga(file: File): Promise<RgbaLevel> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (bytes.length < 18)
		throw new Error("TGA header is truncated");
	const idLength = bytes[0];
	const colorMapType = bytes[1];
	const imageType = bytes[2];
	const width = bytes[12] | (bytes[13] << 8);
	const height = bytes[14] | (bytes[15] << 8);
	const bitsPerPixel = bytes[16];
	const descriptor = bytes[17];
	if (colorMapType !== 0 || (imageType !== 2 && imageType !== 10) || (bitsPerPixel !== 24 && bitsPerPixel !== 32) || width <= 0 || height <= 0)
		throw new Error("Only uncompressed/RLE 24-bit and 32-bit true-color TGA is supported");

	const bytesPerPixel = bitsPerPixel / 8;
	let offset = 18 + idLength;
	const pixelCount = width * height;
	const raw = new Uint8ClampedArray(pixelCount * 4);
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
		raw[target] = pixel[0];
		raw[target + 1] = pixel[1];
		raw[target + 2] = pixel[2];
		raw[target + 3] = pixel[3];
		++pixelIndex;
	};
	if (imageType === 2) {
		while (pixelIndex < pixelCount) {
			const pixel = ReadPixel();
			if (!pixel)
				throw new Error("TGA pixel data is truncated");
			WritePixel(pixel);
		}
	} else {
		while (pixelIndex < pixelCount && offset < bytes.length) {
			const packet = bytes[offset++];
			const count = (packet & 0x7f) + 1;
			if (packet & 0x80) {
				const pixel = ReadPixel();
				if (!pixel)
					throw new Error("TGA RLE packet is truncated");
				for (let i = 0; i < count && pixelIndex < pixelCount; ++i)
					WritePixel(pixel);
			} else {
				for (let i = 0; i < count && pixelIndex < pixelCount; ++i) {
					const pixel = ReadPixel();
					if (!pixel)
						throw new Error("TGA raw packet is truncated");
					WritePixel(pixel);
				}
			}
		}
	}
	if (pixelIndex !== pixelCount)
		throw new Error("TGA pixel data ended early");

	const topOrigin = (descriptor & 0x20) !== 0;
	const rightOrigin = (descriptor & 0x10) !== 0;
	const rgba = new Uint8ClampedArray(raw.length);
	for (let y = 0; y < height; ++y) {
		for (let x = 0; x < width; ++x) {
			const sourceX = rightOrigin ? width - 1 - x : x;
			const sourceY = topOrigin ? y : height - 1 - y;
			const source = (sourceY * width + sourceX) * 4;
			const target = (y * width + x) * 4;
			rgba[target] = raw[source];
			rgba[target + 1] = raw[source + 1];
			rgba[target + 2] = raw[source + 2];
			rgba[target + 3] = raw[source + 3];
		}
	}
	return { width, height, rgba };
}

export async function DecodeImageSourceToRgba(file: File): Promise<RgbaLevel> {
	if (file.name.toLowerCase().endsWith(".tga"))
		return DecodeTga(file);
	return DecodeBrowserImage(file);
}

function GenerateNextMip(level: RgbaLevel): RgbaLevel {
	const width = Math.max(1, Math.floor(level.width / 2));
	const height = Math.max(1, Math.floor(level.height / 2));
	const canvas = document.createElement("canvas");
	canvas.width = level.width;
	canvas.height = level.height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context)
		throw new Error("Canvas 2D context unavailable");
	context.putImageData(new ImageData(level.rgba, level.width, level.height), 0, 0);
	const nextCanvas = document.createElement("canvas");
	nextCanvas.width = width;
	nextCanvas.height = height;
	const nextContext = nextCanvas.getContext("2d", { willReadFrequently: true });
	if (!nextContext)
		throw new Error("Canvas 2D context unavailable");
	nextContext.imageSmoothingEnabled = true;
	nextContext.imageSmoothingQuality = "high";
	nextContext.drawImage(canvas, 0, 0, width, height);
	return { width, height, rgba: nextContext.getImageData(0, 0, width, height).data };
}

function BuildMipChain(base: RgbaLevel, generateMipmaps: boolean) {
	const levels = [base];
	if (!generateMipmaps)
		return levels;
	while (levels[levels.length - 1].width > 1 || levels[levels.length - 1].height > 1)
		levels.push(GenerateNextMip(levels[levels.length - 1]));
	return levels;
}

function RgbaToBgra(level: RgbaLevel) {
	const output = new Uint8Array(level.width * level.height * 4);
	for (let source = 0, target = 0; source < level.rgba.length; source += 4, target += 4) {
		output[target] = level.rgba[source + 2];
		output[target + 1] = level.rgba[source + 1];
		output[target + 2] = level.rgba[source];
		output[target + 3] = level.rgba[source + 3];
	}
	return output;
}

function RgbTo565(r: number, g: number, b: number) {
	return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function RgbFrom565(value: number): [number, number, number] {
	return [
		Math.round(((value >> 11) & 31) * 255 / 31),
		Math.round(((value >> 5) & 63) * 255 / 63),
		Math.round((value & 31) * 255 / 31)
	];
}

function ReadBlock(level: RgbaLevel, blockX: number, blockY: number) {
	const pixels: number[][] = [];
	for (let y = 0; y < 4; ++y) {
		for (let x = 0; x < 4; ++x) {
			const px = Math.min(level.width - 1, blockX * 4 + x);
			const py = Math.min(level.height - 1, blockY * 4 + y);
			const offset = (py * level.width + px) * 4;
			pixels.push([level.rgba[offset], level.rgba[offset + 1], level.rgba[offset + 2], level.rgba[offset + 3]]);
		}
	}
	return pixels;
}

function ChooseColorEndpoints(pixels: number[][]) {
	let min = pixels[0];
	let max = pixels[0];
	let minLum = Infinity;
	let maxLum = -Infinity;
	for (const pixel of pixels) {
		const lum = pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114;
		if (lum < minLum) { minLum = lum; min = pixel; }
		if (lum > maxLum) { maxLum = lum; max = pixel; }
	}
	let c0 = RgbTo565(max[0], max[1], max[2]);
	let c1 = RgbTo565(min[0], min[1], min[2]);
	if (c0 === c1)
		c1 = c0 > 0 ? c0 - 1 : 1;
	if (c0 < c1)
		[c0, c1] = [c1, c0];
	return [c0, c1] as const;
}

function BuildBcColorPalette(c0: number, c1: number) {
	const a = RgbFrom565(c0);
	const b = RgbFrom565(c1);
	return [
		a,
		b,
		[a[0] * 2 / 3 + b[0] / 3, a[1] * 2 / 3 + b[1] / 3, a[2] * 2 / 3 + b[2] / 3],
		[a[0] / 3 + b[0] * 2 / 3, a[1] / 3 + b[1] * 2 / 3, a[2] / 3 + b[2] * 2 / 3]
	];
}

function ColorDistance(pixel: number[], color: number[]) {
	const dr = pixel[0] - color[0];
	const dg = pixel[1] - color[1];
	const db = pixel[2] - color[2];
	return dr * dr + dg * dg + db * db;
}

function EncodeBc1Level(level: RgbaLevel) {
	const blocksX = Math.max(1, Math.ceil(level.width / 4));
	const blocksY = Math.max(1, Math.ceil(level.height / 4));
	const output = new Uint8Array(blocksX * blocksY * 8);
	const view = new DataView(output.buffer);
	let offset = 0;
	for (let by = 0; by < blocksY; ++by) {
		for (let bx = 0; bx < blocksX; ++bx) {
			const pixels = ReadBlock(level, bx, by);
			const [c0, c1] = ChooseColorEndpoints(pixels);
			const palette = BuildBcColorPalette(c0, c1);
			let indices = 0;
			for (let i = 0; i < 16; ++i) {
				let best = 0;
				let bestDistance = Infinity;
				for (let p = 0; p < 4; ++p) {
					const distance = ColorDistance(pixels[i], palette[p]);
					if (distance < bestDistance) { bestDistance = distance; best = p; }
				}
				indices |= best << (i * 2);
			}
			view.setUint16(offset, c0, true);
			view.setUint16(offset + 2, c1, true);
			view.setUint32(offset + 4, indices >>> 0, true);
			offset += 8;
		}
	}
	return output;
}

function BuildAlphaPalette(a0: number, a1: number) {
	const values = [a0, a1];
	if (a0 > a1) {
		for (let i = 1; i <= 6; ++i)
			values.push(Math.round(((7 - i) * a0 + i * a1) / 7));
	} else {
		for (let i = 1; i <= 4; ++i)
			values.push(Math.round(((5 - i) * a0 + i * a1) / 5));
		values.push(0, 255);
	}
	return values;
}

function EncodeBc3Level(level: RgbaLevel) {
	const blocksX = Math.max(1, Math.ceil(level.width / 4));
	const blocksY = Math.max(1, Math.ceil(level.height / 4));
	const output = new Uint8Array(blocksX * blocksY * 16);
	const view = new DataView(output.buffer);
	let offset = 0;
	for (let by = 0; by < blocksY; ++by) {
		for (let bx = 0; bx < blocksX; ++bx) {
			const pixels = ReadBlock(level, bx, by);
			let a0 = 0;
			let a1 = 255;
			for (const pixel of pixels) {
				a0 = Math.max(a0, pixel[3]);
				a1 = Math.min(a1, pixel[3]);
			}
			const alphaPalette = BuildAlphaPalette(a0, a1);
			output[offset] = a0;
			output[offset + 1] = a1;
			let alphaBits = 0n;
			for (let i = 0; i < 16; ++i) {
				let best = 0;
				let bestDistance = Infinity;
				for (let p = 0; p < 8; ++p) {
					const distance = Math.abs(pixels[i][3] - alphaPalette[p]);
					if (distance < bestDistance) { bestDistance = distance; best = p; }
				}
				alphaBits |= BigInt(best) << BigInt(i * 3);
			}
			for (let i = 0; i < 6; ++i)
				output[offset + 2 + i] = Number((alphaBits >> BigInt(i * 8)) & 0xffn);

			const [c0, c1] = ChooseColorEndpoints(pixels);
			const palette = BuildBcColorPalette(c0, c1);
			let indices = 0;
			for (let i = 0; i < 16; ++i) {
				let best = 0;
				let bestDistance = Infinity;
				for (let p = 0; p < 4; ++p) {
					const distance = ColorDistance(pixels[i], palette[p]);
					if (distance < bestDistance) { bestDistance = distance; best = p; }
				}
				indices |= best << (i * 2);
			}
			view.setUint16(offset + 8, c0, true);
			view.setUint16(offset + 10, c1, true);
			view.setUint32(offset + 12, indices >>> 0, true);
			offset += 16;
		}
	}
	return output;
}

function BuildDdsHeader(width: number, height: number, mipCount: number, format: EddsPixelFormat) {
	const bytes = new Uint8Array(128);
	const view = new DataView(bytes.buffer);
	WriteFourCc(bytes, 0, "DDS ");
	view.setUint32(4, 124, true);
	const DDSD_CAPS = 0x1;
	const DDSD_HEIGHT = 0x2;
	const DDSD_WIDTH = 0x4;
	const DDSD_PITCH = 0x8;
	const DDSD_LINEARSIZE = 0x80000;
	const DDSD_PIXELFORMAT = 0x1000;
	const DDSD_MIPMAPCOUNT = 0x20000;
	let flags = DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT;
	flags |= format === "bgra8" ? DDSD_PITCH : DDSD_LINEARSIZE;
	if (mipCount > 1)
		flags |= DDSD_MIPMAPCOUNT;
	view.setUint32(8, flags, true);
	view.setUint32(12, height, true);
	view.setUint32(16, width, true);
	if (format === "bgra8")
		view.setUint32(20, width * 4, true);
	else {
		const blockBytes = format === "dxt1" ? 8 : 16;
		view.setUint32(20, Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * blockBytes, true);
	}
	view.setUint32(24, 0, true);
	view.setUint32(28, mipCount, true);
	view.setUint32(76, 32, true);
	if (format === "bgra8") {
		view.setUint32(80, 0x41, true);
		view.setUint32(84, 0, true);
		view.setUint32(88, 32, true);
		view.setUint32(92, 0x00ff0000, true);
		view.setUint32(96, 0x0000ff00, true);
		view.setUint32(100, 0x000000ff, true);
		view.setUint32(104, 0xff000000, true);
	} else {
		view.setUint32(80, 0x4, true); // DDPF_FOURCC
		WriteFourCc(bytes, 84, format === "dxt1" ? "DXT1" : "DXT5");
	}
	let caps = 0x1000;
	if (mipCount > 1)
		caps |= 0x8 | 0x400000;
	view.setUint32(108, caps, true);
	return bytes;
}

function EncodeLevel(level: RgbaLevel, format: EddsPixelFormat) {
	if (format === "dxt1")
		return EncodeBc1Level(level);
	if (format === "dxt5")
		return EncodeBc3Level(level);
	return RgbaToBgra(level);
}

function BuildCopyEdds(levels: RgbaLevel[], format: EddsPixelFormat) {
	const encoded = levels.map((level) => EncodeLevel(level, format));
	const descriptorsLength = encoded.length * 8;
	const payloadLength = encoded.reduce((sum, level) => sum + level.length, 0);
	const result = new Uint8Array(128 + descriptorsLength + payloadLength);
	result.set(BuildDdsHeader(levels[0].width, levels[0].height, levels.length, format), 0);
	const view = new DataView(result.buffer);
	let descriptorOffset = 128;
	for (let i = encoded.length - 1; i >= 0; --i) {
		WriteFourCc(result, descriptorOffset, "COPY");
		view.setInt32(descriptorOffset + 4, encoded[i].length, true);
		descriptorOffset += 8;
	}
	let payloadOffset = 128 + descriptorsLength;
	for (let i = encoded.length - 1; i >= 0; --i) {
		result.set(encoded[i], payloadOffset);
		payloadOffset += encoded[i].length;
	}
	return result;
}

export function EncodeRgbaToEdds(base: RgbaLevel, options: EddsEncodeOptions): EddsEncodeResult {
	if (base.width > 16384 || base.height > 16384)
		throw new Error(`Texture ${base.width}x${base.height} exceeds the supported 16384px limit`);
	const format = options.format ?? "bgra8";
	const levels = BuildMipChain(base, options.generateMipmaps);
	const bytes = BuildCopyEdds(levels, format);
	return {
		blob: new Blob([bytes], { type: "application/octet-stream" }),
		width: base.width,
		height: base.height,
		mipCount: levels.length,
		byteLength: bytes.byteLength,
		format
	};
}

export async function EncodeImageToEdds(file: File, options: EddsEncodeOptions): Promise<EddsEncodeResult> {
	return EncodeRgbaToEdds(await DecodeImageSourceToRgba(file), options);
}
