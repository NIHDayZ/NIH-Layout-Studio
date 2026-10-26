function ReadU32(view: DataView, offset: number) {
	return view.getUint32(offset, true);
}

function ReadI32(view: DataView, offset: number) {
	return view.getInt32(offset, true);
}

function ReadU16(view: DataView, offset: number) {
	return view.getUint16(offset, true);
}

function FourCC(bytes: Uint8Array, offset: number) {
	return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function DecompressLz4Block(source: Uint8Array, target: Uint8Array, targetOffset: number, targetLimit: number) {
	let sourceOffset = 0;
	let outputOffset = targetOffset;
	while (sourceOffset < source.length && outputOffset < targetLimit) {
		const token = source[sourceOffset++];
		let literalLength = token >>> 4;
		if (literalLength === 15) {
			let value = 255;
			while (value === 255 && sourceOffset < source.length) {
				value = source[sourceOffset++];
				literalLength += value;
			}
		}

		const literalEnd = Math.min(source.length, sourceOffset + literalLength);
		const copyLength = literalEnd - sourceOffset;
		if (outputOffset + copyLength > targetLimit)
			throw new Error("LZ4 literal exceeds target buffer");
		target.set(source.subarray(sourceOffset, literalEnd), outputOffset);
		outputOffset += copyLength;
		sourceOffset = literalEnd;

		if (sourceOffset >= source.length)
			break;
		if (sourceOffset + 2 > source.length)
			throw new Error("Truncated LZ4 match offset");

		const matchOffset = source[sourceOffset] | (source[sourceOffset + 1] << 8);
		sourceOffset += 2;
		if (matchOffset <= 0 || matchOffset > outputOffset)
			throw new Error("Invalid LZ4 match offset");

		let matchLength = token & 0x0f;
		if (matchLength === 15) {
			let value = 255;
			while (value === 255 && sourceOffset < source.length) {
				value = source[sourceOffset++];
				matchLength += value;
			}
		}
		matchLength += 4;
		if (outputOffset + matchLength > targetLimit)
			matchLength = targetLimit - outputOffset;

		let matchPosition = outputOffset - matchOffset;
		for (let i = 0; i < matchLength; ++i)
			target[outputOffset++] = target[matchPosition++];
	}
	return outputOffset - targetOffset;
}

function DecompressEdds(bytes: Uint8Array): Uint8Array {
	if (bytes.length < 128 || FourCC(bytes, 0) !== "DDS ")
		throw new Error("EDDS does not begin with a DDS header");

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const headerLength = FourCC(bytes, 84) === "DX10" ? 148 : 128;
	let cursor = headerLength;
	const copyBlocks: number[] = [];
	const lz4Blocks: number[] = [];

	while (cursor + 8 <= bytes.length) {
		const block = FourCC(bytes, cursor);
		const size = ReadI32(view, cursor + 4);
		if (size < 0)
			break;
		if (block === "COPY")
			copyBlocks.push(size);
		else if (block === "LZ4 ")
			lz4Blocks.push(size);
		else
			break;
		cursor += 8;
	}

	if (copyBlocks.length === 0 && lz4Blocks.length === 0)
		return bytes;

	const decodedParts: Uint8Array[] = [];
	for (const size of copyBlocks) {
		if (cursor + size > bytes.length)
			throw new Error("Truncated EDDS COPY block");
		decodedParts.unshift(bytes.slice(cursor, cursor + size));
		cursor += size;
	}

	for (const sectionLength of lz4Blocks) {
		if (sectionLength < 4 || cursor + sectionLength > bytes.length)
			throw new Error("Truncated EDDS LZ4 section");
		const sectionEnd = cursor + sectionLength;
		const decodedSize = ReadU32(view, cursor);
		cursor += 4;
		const decoded = new Uint8Array(decodedSize);
		let decodedOffset = 0;

		while (cursor < sectionEnd && decodedOffset < decodedSize) {
			if (cursor + 4 > sectionEnd)
				throw new Error("Truncated EDDS LZ4 chunk header");
			const encodedLength = ReadI32(view, cursor) & 0x7fffffff;
			cursor += 4;
			if (encodedLength <= 0 || cursor + encodedLength > sectionEnd)
				throw new Error("Invalid EDDS LZ4 chunk length");
			const encoded = bytes.subarray(cursor, cursor + encodedLength);
			cursor += encodedLength;
			decodedOffset += DecompressLz4Block(encoded, decoded, decodedOffset, decodedSize);
		}

		if (decodedOffset !== decodedSize)
			throw new Error(`EDDS LZ4 decoded ${decodedOffset} bytes, expected ${decodedSize}`);
		decodedParts.unshift(decoded);
		cursor = sectionEnd;
	}

	let payloadLength = 0;
	for (const part of decodedParts)
		payloadLength += part.length;
	const result = new Uint8Array(headerLength + payloadLength);
	result.set(bytes.subarray(0, headerLength), 0);
	let offset = headerLength;
	for (const part of decodedParts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

function Expand5(value: number) {
	return (value << 3) | (value >>> 2);
}

function Expand6(value: number) {
	return (value << 2) | (value >>> 4);
}

function Decode565(value: number): [number, number, number, number] {
	return [Expand5((value >>> 11) & 31), Expand6((value >>> 5) & 63), Expand5(value & 31), 255];
}

function MixColor(a: readonly number[], b: readonly number[], aWeight: number, bWeight: number, divisor: number): [number, number, number, number] {
	return [
		Math.round((a[0] * aWeight + b[0] * bWeight) / divisor),
		Math.round((a[1] * aWeight + b[1] * bWeight) / divisor),
		Math.round((a[2] * aWeight + b[2] * bWeight) / divisor),
		255
	];
}

function WritePixel(rgba: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: readonly number[], alpha?: number) {
	if (x < 0 || y < 0 || x >= width || y >= height)
		return;
	const offset = (y * width + x) * 4;
	rgba[offset] = color[0];
	rgba[offset + 1] = color[1];
	rgba[offset + 2] = color[2];
	rgba[offset + 3] = alpha ?? color[3] ?? 255;
}

function DecodeColorBlock(data: Uint8Array, offset: number, forceFourColor: boolean) {
	const c0Value = data[offset] | (data[offset + 1] << 8);
	const c1Value = data[offset + 2] | (data[offset + 3] << 8);
	const c0 = Decode565(c0Value);
	const c1 = Decode565(c1Value);
	const colors: [number, number, number, number][] = [c0, c1, [0, 0, 0, 255], [0, 0, 0, 255]];
	if (forceFourColor || c0Value > c1Value) {
		colors[2] = MixColor(c0, c1, 2, 1, 3);
		colors[3] = MixColor(c0, c1, 1, 2, 3);
	} else {
		colors[2] = MixColor(c0, c1, 1, 1, 2);
		colors[3] = [0, 0, 0, 0];
	}
	const indices = data[offset + 4] | (data[offset + 5] << 8) | (data[offset + 6] << 16) | (data[offset + 7] << 24);
	return { colors, indices: indices >>> 0 };
}

function DecodeBc1(data: Uint8Array, width: number, height: number) {
	const rgba = new Uint8ClampedArray(width * height * 4);
	let offset = 0;
	for (let by = 0; by < height; by += 4) {
		for (let bx = 0; bx < width; bx += 4) {
			if (offset + 8 > data.length)
				throw new Error("Truncated BC1 block");
			const block = DecodeColorBlock(data, offset, false);
			for (let py = 0; py < 4; ++py) {
				for (let px = 0; px < 4; ++px) {
					const index = (block.indices >>> (2 * (py * 4 + px))) & 3;
					WritePixel(rgba, width, height, bx + px, by + py, block.colors[index]);
				}
			}
			offset += 8;
		}
	}
	return rgba;
}

function DecodeBc2(data: Uint8Array, width: number, height: number) {
	const rgba = new Uint8ClampedArray(width * height * 4);
	let offset = 0;
	for (let by = 0; by < height; by += 4) {
		for (let bx = 0; bx < width; bx += 4) {
			if (offset + 16 > data.length)
				throw new Error("Truncated BC2 block");
			const color = DecodeColorBlock(data, offset + 8, true);
			for (let py = 0; py < 4; ++py) {
				for (let px = 0; px < 4; ++px) {
					const pixel = py * 4 + px;
					const alphaByte = data[offset + (pixel >>> 1)];
					const nibble = (pixel & 1) === 0 ? alphaByte & 0x0f : alphaByte >>> 4;
					const index = (color.indices >>> (2 * pixel)) & 3;
					WritePixel(rgba, width, height, bx + px, by + py, color.colors[index], nibble * 17);
				}
			}
			offset += 16;
		}
	}
	return rgba;
}

function DecodeBc3(data: Uint8Array, width: number, height: number) {
	const rgba = new Uint8ClampedArray(width * height * 4);
	let offset = 0;
	for (let by = 0; by < height; by += 4) {
		for (let bx = 0; bx < width; bx += 4) {
			if (offset + 16 > data.length)
				throw new Error("Truncated BC3 block");
			const a0 = data[offset];
			const a1 = data[offset + 1];
			const alpha = new Array<number>(8);
			alpha[0] = a0;
			alpha[1] = a1;
			if (a0 > a1) {
				for (let i = 1; i <= 6; ++i)
					alpha[i + 1] = Math.round(((7 - i) * a0 + i * a1) / 7);
			} else {
				for (let i = 1; i <= 4; ++i)
					alpha[i + 1] = Math.round(((5 - i) * a0 + i * a1) / 5);
				alpha[6] = 0;
				alpha[7] = 255;
			}
			let alphaBits = 0n;
			for (let i = 0; i < 6; ++i)
				alphaBits |= BigInt(data[offset + 2 + i]) << BigInt(i * 8);
			const color = DecodeColorBlock(data, offset + 8, true);
			for (let py = 0; py < 4; ++py) {
				for (let px = 0; px < 4; ++px) {
					const pixel = py * 4 + px;
					const alphaIndex = Number((alphaBits >> BigInt(pixel * 3)) & 7n);
					const colorIndex = (color.indices >>> (2 * pixel)) & 3;
					WritePixel(rgba, width, height, bx + px, by + py, color.colors[colorIndex], alpha[alphaIndex]);
				}
			}
			offset += 16;
		}
	}
	return rgba;
}

function MaskInfo(mask: number) {
	if (mask === 0)
		return { shift: 0, bits: 0 };
	let shift = 0;
	while (((mask >>> shift) & 1) === 0 && shift < 32)
		++shift;
	let bits = 0;
	while (((mask >>> (shift + bits)) & 1) !== 0 && shift + bits < 32)
		++bits;
	return { shift, bits };
}

function ExtractMasked(value: number, mask: number) {
	if (mask === 0)
		return 255;
	const { shift, bits } = MaskInfo(mask >>> 0);
	const raw = (value & (mask >>> 0)) >>> shift;
	const max = bits >= 32 ? 0xffffffff : (2 ** bits - 1);
	return max > 0 ? Math.round(raw * 255 / max) : 0;
}

function DecodeUncompressed(data: Uint8Array, width: number, height: number, bitsPerPixel: number, rMask: number, gMask: number, bMask: number, aMask: number) {
	const bytesPerPixel = bitsPerPixel / 8;
	if (bytesPerPixel !== 3 && bytesPerPixel !== 4)
		throw new Error(`Unsupported DDS RGB bit depth ${bitsPerPixel}`);
	const rgba = new Uint8ClampedArray(width * height * 4);
	let source = 0;
	for (let y = 0; y < height; ++y) {
		for (let x = 0; x < width; ++x) {
			if (source + bytesPerPixel > data.length)
				throw new Error("Truncated uncompressed DDS data");
			let value = data[source] | (data[source + 1] << 8) | (data[source + 2] << 16);
			if (bytesPerPixel === 4)
				value = (value | (data[source + 3] << 24)) >>> 0;
			const target = (y * width + x) * 4;
			rgba[target] = ExtractMasked(value, rMask);
			rgba[target + 1] = ExtractMasked(value, gMask);
			rgba[target + 2] = ExtractMasked(value, bMask);
			rgba[target + 3] = aMask ? ExtractMasked(value, aMask) : 255;
			source += bytesPerPixel;
		}
	}
	return rgba;
}

function DecodeDds(bytes: Uint8Array) {
	if (bytes.length < 128 || FourCC(bytes, 0) !== "DDS ")
		throw new Error("Invalid DDS header");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const height = ReadU32(view, 12);
	const width = ReadU32(view, 16);
	if (!width || !height || width > 16384 || height > 16384)
		throw new Error(`Invalid DDS size ${width}x${height}`);
	const pixelFlags = ReadU32(view, 80);
	const fourCC = FourCC(bytes, 84);
	let dataOffset = 128;
	let rgba: Uint8ClampedArray;

	if (fourCC === "DXT1")
		rgba = DecodeBc1(bytes.subarray(dataOffset), width, height);
	else if (fourCC === "DXT3")
		rgba = DecodeBc2(bytes.subarray(dataOffset), width, height);
	else if (fourCC === "DXT5")
		rgba = DecodeBc3(bytes.subarray(dataOffset), width, height);
	else if (fourCC === "DX10") {
		if (bytes.length < 148)
			throw new Error("Truncated DDS DX10 header");
		const dxgiFormat = ReadU32(view, 128);
		dataOffset = 148;
		if (dxgiFormat === 71 || dxgiFormat === 72)
			rgba = DecodeBc1(bytes.subarray(dataOffset), width, height);
		else if (dxgiFormat === 74 || dxgiFormat === 75)
			rgba = DecodeBc2(bytes.subarray(dataOffset), width, height);
		else if (dxgiFormat === 77 || dxgiFormat === 78)
			rgba = DecodeBc3(bytes.subarray(dataOffset), width, height);
		else
			throw new Error(`Unsupported DDS DXGI format ${dxgiFormat}`);
	} else if (pixelFlags & 0x40) {
		const bitsPerPixel = ReadU32(view, 88);
		const rMask = ReadU32(view, 92);
		const gMask = ReadU32(view, 96);
		const bMask = ReadU32(view, 100);
		const aMask = ReadU32(view, 104);
		rgba = DecodeUncompressed(bytes.subarray(dataOffset), width, height, bitsPerPixel, rMask, gMask, bMask, aMask);
	} else {
		throw new Error(`Unsupported DDS format ${fourCC || "unknown"}`);
	}

	return { width, height, rgba };
}

export function DecodeEddsToPixels(buffer: ArrayBuffer) {
	const dds = DecompressEdds(new Uint8Array(buffer));
	return DecodeDds(dds);
}

async function ImageDataToObjectUrl(width: number, height: number, rgba: Uint8ClampedArray) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context)
		throw new Error("Canvas 2D context unavailable");
	const imageDataBytes = new Uint8ClampedArray(rgba.length);
	imageDataBytes.set(rgba);
	context.putImageData(new ImageData(imageDataBytes, width, height), 0, 0);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
	if (!blob)
		throw new Error("Could not create PNG preview");
	return URL.createObjectURL(blob);
}

export async function DecodeEddsToObjectUrl(file: File): Promise<{ url: string; width: number; height: number } | null> {
	try {
		const decoded = DecodeEddsToPixels(await file.arrayBuffer());
		const url = await ImageDataToObjectUrl(decoded.width, decoded.height, decoded.rgba);
		return { url, width: decoded.width, height: decoded.height };
	} catch (error) {
		console.warn(`NIH Layout Studio: could not decode EDDS ${file.name}`, error);
		return null;
	}
}
