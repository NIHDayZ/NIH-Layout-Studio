import { DecodeEddsToPixels } from "./EddsDecoder";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer }>) => {
	try {
		const { width, height, rgba } = DecodeEddsToPixels(event.data.buffer);
		const canvas = new OffscreenCanvas(width, height);
		const context = canvas.getContext("2d");
		if (!context)
			throw new Error("Worker canvas context unavailable");
		context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
		const blob = await canvas.convertToBlob({ type: "image/png" });
		self.postMessage({ blob, width, height });
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error), fallback: !(error instanceof Error && /^(Unsupported|Invalid DDS|EDDS|Truncated)/.test(error.message)) });
	}
};
