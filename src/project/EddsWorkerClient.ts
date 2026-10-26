import { DecodeEddsToObjectUrl } from "./EddsDecoder";

type WorkerResponse = { blob?: Blob; width?: number; height?: number; error?: string };

export function CreateEddsDecodeSession() {
	let worker: Worker | null = null;
	try {
		if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined")
			worker = new Worker(new URL("./EddsDecodeWorker.ts", import.meta.url), { type: "module" });
	} catch {
		// Existing decoder remains available in browsers without module workers.
	}

	return {
		async Decode(file: File) {
			if (!worker)
				return DecodeEddsToObjectUrl(file);
			const active = worker;
			try {
				const buffer = await file.arrayBuffer();
				const response = await new Promise<WorkerResponse>((resolve, reject) => {
					const cleanup = () => {
						active.removeEventListener("message", onMessage);
						active.removeEventListener("error", onError);
						active.removeEventListener("messageerror", onError);
					};
					const onMessage = (event: MessageEvent<WorkerResponse>) => {
						cleanup();
						resolve(event.data);
					};
					const onError = () => {
						cleanup();
						reject(new Error("EDDS worker failed"));
					};
					active.addEventListener("message", onMessage);
					active.addEventListener("error", onError);
					active.addEventListener("messageerror", onError);
					try {
						active.postMessage({ buffer }, [buffer]);
					} catch (error) {
						cleanup();
						reject(error);
					}
				});
				if (response.error) {
					console.warn(`NIH Layout Studio: could not decode EDDS ${file.name}: ${response.error}`);
					return null;
				}
				if (!response.blob || !response.width || !response.height)
					throw new Error("Invalid EDDS worker response");
				return { url: URL.createObjectURL(response.blob), width: response.width, height: response.height };
			} catch {
				active.terminate();
				worker = null;
				return DecodeEddsToObjectUrl(file);
			}
		},
		Dispose() {
			worker?.terminate();
			worker = null;
		}
	};
}
