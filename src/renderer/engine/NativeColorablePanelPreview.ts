/**
 * Phase 2Q research-only hypothesis for DayZ rover_sim_colorable panels.
 *
 * Native Workbench screenshot swatches appear gamma-encoded relative to
 * authored linear RGB channels. A power 1/2.2 curve fits five sampled
 * colors closely, but shader transfer and alpha blending remain unverified.
 * Do NOT use as the production default or as a generic widget color parser.
 */
const s_NativeColorGammaCandidate = 2.2;

function ParseNativePanelChannels(value?: string): [number, number, number, number] | null {
	if (!value)
		return null;
	const tokens = value.trim().split(/\s+/);
	if (tokens.length !== 3 && tokens.length !== 4)
		return null;
	const numbers = tokens.map(Number);
	if (numbers.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 1))
		return null;
	const alpha = numbers.length === 4 ? numbers[3] : 1;
	return [numbers[0], numbers[1], numbers[2], alpha];
}

/**
 * Candidate transfer of linear authored RGB into CSS-display gamma-coded
 * channels. Alpha is preserved separately: no screenshot-fitting alpha
 * constant or assumed native background is baked into this transform.
 */
export function PreviewNativeColorablePanelColor(value?: string): string | undefined {
	const channels = ParseNativePanelChannels(value);
	if (!channels)
		return undefined;
	const [r, g, b, alpha] = channels;
	const encodedR = Math.round(Math.pow(r, 1 / s_NativeColorGammaCandidate) * 255);
	const encodedG = Math.round(Math.pow(g, 1 / s_NativeColorGammaCandidate) * 255);
	const encodedB = Math.round(Math.pow(b, 1 / s_NativeColorGammaCandidate) * 255);
	return `rgba(${encodedR}, ${encodedG}, ${encodedB}, ${alpha})`;
}

/**
 * Phase 2U: controlled alternative to the original 1/2.2 approximation.
 *
 * Native GetColor() stores authored linear floats as rounded 8-bit ARGB.
 * Encoding the quantized channels through the standard sRGB transfer exactly
 * reproduces the 15 Workbench opaque color channels and both test backdrops.
 *
 * This is a research-only preview; the native alpha-compositing operation
 * remains unverified. Keep the existing power-2.2 preview for A/B comparison.
 */
function EncodeLinearSrgbChannel(channel: number): number {
	const byte = Math.round(channel * 255);
	const linear = byte / 255;
	let display = linear * 12.92;
	if (linear > 0.0031308)
		display = 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
	return Math.round(display * 255);
}

export function PreviewNativeColorablePanelSrgbColor(value?: string): string | undefined {
	const channels = ParseNativePanelChannels(value);
	if (!channels)
		return undefined;
	const [r, g, b, alpha] = channels;
	const encodedR = EncodeLinearSrgbChannel(r);
	const encodedG = EncodeLinearSrgbChannel(g);
	const encodedB = EncodeLinearSrgbChannel(b);
	const nativeAlpha = Math.round(alpha * 255) / 255;
	return `rgba(${encodedR}, ${encodedG}, ${encodedB}, ${nativeAlpha})`;
}

/**
 * Prediction only, not an implementation of confirmed native blending.
 * Useful for comparing screenshot swatches against simple models.
 */
export function PredictColorablePanelOverBackground(
	value: string,
	backdrop: readonly [number, number, number],
	gammaCandidate = s_NativeColorGammaCandidate
): [number, number, number] | null {
	const channels = ParseNativePanelChannels(value);
	if (!channels || !Number.isFinite(gammaCandidate) || gammaCandidate <= 0
		|| backdrop.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255))
		return null;
	const alpha = channels[3];
	const prediction: number[] = [];
	for (let i = 0; i < 3; ++i) {
		const encoded = Math.pow(channels[i], 1 / gammaCandidate) * 255;
		prediction.push(Math.round(alpha * encoded + (1 - alpha) * backdrop[i]));
	}
	return [prediction[0], prediction[1], prediction[2]];
}
