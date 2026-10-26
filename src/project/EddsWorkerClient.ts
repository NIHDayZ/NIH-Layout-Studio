import { DecodeEddsToObjectUrl } from "./EddsDecoder";

type WorkerResponse = { blob?: Blob; width?: number; height?: number; error?: string; fallback?: boolean };

export function CreateEddsDecodeSession() {
	let worker: Worker | null = null;
	let workerFailed = false;
	let rejectPending: (() => void) | null = null;
	let workerConfirmed = false;
	let fallbackReported = false;
	function ReportFallback(reason: string) {
		if (fallbackReported)
			return;
		fallbackReported = true;
		console.warn(`[NIH Layout Studio] EDDS worker fallback: ${reason}; decoding on main thread`);
	}
	const handleWorkerError = () => {
		ReportFallback("worker error or message error");
		workerFailed = true;
		rejectPending?.();
	};
	try {
		if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined")
			worker = new Worker(new URL("./EddsDecodeWorker.ts", import.meta.url), { type: "module" });
		if (worker) {
			worker.addEventListener("error", handleWorkerError);
			worker.addEventListener("messageerror", handleWorkerError);
		}
	} catch (error) {
		ReportFallback(`worker creation failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!worker)
		ReportFallback("module Worker or OffscreenCanvas unavailable");

	return {
		async Decode(file: File) {
			if (!worker || workerFailed)
				return DecodeEddsToObjectUrl(file);
			const active = worker;
			try {
				const buffer = await file.arrayBuffer();
				if (workerFailed)
					throw new Error("EDDS worker failed while reading file");
				const response = await new Promise<WorkerResponse>((resolve, reject) => {
					const cleanup = () => {
						active.removeEventListener("message", onMessage);
						rejectPending = null;
					};
					const onMessage = (event: MessageEvent<WorkerResponse>) => {
						cleanup();
						resolve(event.data);
					};
					rejectPending = () => {
						cleanup();
						reject(new Error("EDDS worker failed"));
					};
					active.addEventListener("message", onMessage);
					if (workerFailed) {
						rejectPending();
						return;
					}
					try {
						active.postMessage({ buffer }, [buffer]);
					} catch (error) {
						cleanup();
						reject(error);
					}
				});
				if (!workerConfirmed) {
					workerConfirmed = true;
					console.info("[NIH Layout Studio] EDDS worker active; decoding off main thread");
				}
				if (response.error) {
					if (response.fallback) {
						ReportFallback(`worker canvas failure: ${response.error}`);
						workerFailed = true;
						active.terminate();
						worker = null;
						return DecodeEddsToObjectUrl(file);
					}
					console.warn(`NIH Layout Studio: could not decode EDDS ${file.name}: ${response.error}`);
					return null;
				}
				if (!response.blob || !response.width || !response.height)
					throw new Error("Invalid EDDS worker response");
				return { url: URL.createObjectURL(response.blob), width: response.width, height: response.height };
			} catch (error) {
				ReportFallback(`worker request failed: ${error instanceof Error ? error.message : String(error)}`);
				active.terminate();
				worker = null;
				workerFailed = true;
				return DecodeEddsToObjectUrl(file);
			}
		},
		Dispose() {
			worker?.terminate();
			worker = null;
			rejectPending = null;
		}
	};
}
