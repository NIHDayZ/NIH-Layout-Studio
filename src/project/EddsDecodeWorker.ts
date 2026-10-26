import { DecodeEddsToPixels } from "./EddsDecoder";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer }>) => {
	let decoded: ReturnType<typeof DecodeEddsToPixels>;
	try {
		decoded = DecodeEddsToPixels(event.data.buffer);
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error), fallback: false });
		return;
	}

	try {
		const { width, height, rgba } = decoded;
		const canvas = new OffscreenCanvas(width, height);
		const context = canvas.getContext("2d");
		if (!context)
			throw new Error("Worker canvas context unavailable");
		context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
		const blob = await canvas.convertToBlob({ type: "image/png" });
		self.postMessage({ blob, width, height });
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error), fallback: true });
	}
};
