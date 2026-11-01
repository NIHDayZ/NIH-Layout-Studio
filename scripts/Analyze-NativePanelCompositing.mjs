/**
 * Phase 2U: read-only comparison of panel color-space / alpha models against
 * screenshot pixels from Workbench. No live widget rendering is modified.
 *
 * Usage: node scripts/Analyze-NativePanelCompositing.mjs
 */
import { readFileSync } from "node:fs";

const colorEvidence = JSON.parse(readFileSync(
	new URL("../tests/fixtures/workbench-grid/panel-color-phase2q-screenshot-evidence.json", import.meta.url), "utf8"
));
const evidence = JSON.parse(readFileSync(
	new URL("../tests/fixtures/workbench-grid/panel-color-phase2r-background-evidence.json", import.meta.url), "utf8"
));

const authoredColors = colorEvidence.samples.map(item => item.authored.slice(0, 3));
const colors = evidence.colorOrder;
const alphaRows = evidence.alphaRows;
const backgrounds = evidence.backgrounds;

function Quantize(value) {
	return Math.round(value * 255) / 255;
}
function SrgbEncode(value) {
	if (value <= 0.0031308)
		return value * 12.92;
	return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}
function SrgbDecode(value) {
	if (value <= 0.04045)
		return value / 12.92;
	return Math.pow((value + 0.055) / 1.055, 2.4);
}
function Gamma22Encode(value) {
	return Math.pow(value, 1 / 2.2);
}
function ChannelData(backgroundIndex, alphaIndex, colorIndex, channel) {
	const backdrop = backgrounds[backgroundIndex];
	return {
		source: authoredColors[colorIndex][channel],
		alpha: alphaRows[alphaIndex],
		background: backdrop.authored[channel],
		backgroundByte: backdrop.workbench[channel],
		nativeByte: evidence.pixels.workbench[backdrop.name][alphaIndex][colorIndex][channel]
	};
}
function Models() {
	return [
		{
			name: "legacy-power22-display-source-over",
			predict: ({source, alpha, backgroundByte}) =>
				255 * (alpha * Gamma22Encode(source) + (1 - alpha) * backgroundByte / 255)
		},
		{
			name: "quantized-srgb-display-source-over",
			predict: ({source, alpha, backgroundByte}) =>
				255 * (Quantize(alpha) * SrgbEncode(Quantize(source)) +
					(1 - Quantize(alpha)) * backgroundByte / 255)
		},
		{
			name: "quantized-srgb-linear-source-over",
			predict: ({source, alpha, background}) =>
				255 * SrgbEncode(Quantize(alpha) * Quantize(source) +
					(1 - Quantize(alpha)) * Quantize(background))
		},
		{
			name: "quantized-srgb-double-source-premultiply-linear",
			predict: ({source, alpha, background}) =>
				255 * SrgbEncode(Math.pow(Quantize(alpha), 2) * Quantize(source) +
					(1 - Quantize(alpha)) * Quantize(background))
		}
	];
}
function EvaluateModel(model) {
	const rowErrors = [];
	const byBackdrop = {};
	let total = 0;
	let count = 0;
	for (let backgroundIndex = 0; backgroundIndex < backgrounds.length; ++backgroundIndex) {
		const name = backgrounds[backgroundIndex].name;
		byBackdrop[name] = [];
		for (let alphaIndex = 0; alphaIndex < alphaRows.length; ++alphaIndex) {
			let rowTotal = 0;
			for (let colorIndex = 0; colorIndex < colors.length; ++colorIndex) {
				for (let channel = 0; channel < 3; ++channel) {
					const data = ChannelData(backgroundIndex, alphaIndex, colorIndex, channel);
					const delta = Math.abs(model.predict(data) - data.nativeByte);
					rowTotal += delta;
					total += delta;
					++count;
				}
			}
			byBackdrop[name].push(+(rowTotal / (colors.length * 3)).toFixed(4));
		}
	}
	for (let row = 0; row < alphaRows.length; ++row) {
		let value = 0;
		for (const backdrop of backgrounds)
			value += byBackdrop[backdrop.name][row];
		rowErrors.push(+(value / backgrounds.length).toFixed(4));
	}
	return {
		model: model.name,
		meanAbsoluteByteError: +(total / count).toFixed(4),
		perAlpha: rowErrors,
		perBackdrop: byBackdrop,
		channelCount: count
	};
}
function OpaqueTransferEvaluation() {
	const original = authoredColors.flatMap(rgb => rgb);
	const workbench = evidence.pixels.workbench.Dark[0].flatMap(rgb => rgb);
	const models = [
		["unquantized-power22", value => Math.round(255 * Gamma22Encode(value))],
		["unquantized-srgb", value => Math.round(255 * SrgbEncode(value))],
		["quantized-srgb", value => Math.round(255 * SrgbEncode(Quantize(value)))]
	];
	return models.map(([name, encode]) => {
		let matches = 0;
		let difference = 0;
		for (let i = 0; i < original.length; ++i) {
			const predicted = encode(original[i]);
			const measured = workbench[i];
			if (predicted === measured)
				++matches;
			difference += Math.abs(predicted - measured);
		}
		return { model: name, exactChannels: matches, totalChannels: original.length,
			meanAbsoluteByteError: +(difference / original.length).toFixed(4) };
	});
}
function FitTwoWeights(row, excludedColor) {
	// Diagnostic descriptive affine coefficients in linearized color.
	// No fitted value is used to render or predict a new alpha value.
	let sumSourceSquared = 0;
	let sumBackgroundSquared = 0;
	let sumCross = 0;
	let sumSourceTarget = 0;
	let sumBackgroundTarget = 0;
	for (let backgroundIndex = 0; backgroundIndex < 2; ++backgroundIndex) {
		for (let color = 0; color < colors.length; ++color) {
			if (color === excludedColor)
				continue;
			for (let channel = 0; channel < 3; ++channel) {
				const data = ChannelData(backgroundIndex, row, color, channel);
				const source = Quantize(data.source);
				const backdrop = Quantize(data.background);
				const target = SrgbDecode(data.nativeByte / 255);
				sumSourceSquared += source * source;
				sumBackgroundSquared += backdrop * backdrop;
				sumCross += source * backdrop;
				sumSourceTarget += source * target;
				sumBackgroundTarget += backdrop * target;
			}
		}
	}
	const determinant = sumSourceSquared * sumBackgroundSquared - sumCross * sumCross;
	if (Math.abs(determinant) < 1e-12)
		throw new Error("Underdetermined color-composite diagnostic");
	return {
		source: (sumSourceTarget * sumBackgroundSquared - sumBackgroundTarget * sumCross) / determinant,
		background: (sumBackgroundTarget * sumSourceSquared - sumSourceTarget * sumCross) / determinant
	};
}
function LeaveOneColorOutDiagnostic() {
	const perAlpha = [];
	let sum = 0;
	let count = 0;
	for (let row = 0; row < alphaRows.length; ++row) {
		let rowError = 0;
		const weights = [];
		for (let excluded = 0; excluded < colors.length; ++excluded) {
			const w = FitTwoWeights(row, excluded);
			weights.push(w);
			for (let backgroundIndex = 0; backgroundIndex < 2; ++backgroundIndex) {
				for (let channel = 0; channel < 3; ++channel) {
					const data = ChannelData(backgroundIndex, row, excluded, channel);
					const output = w.source * Quantize(data.source) + w.background * Quantize(data.background);
					const predicted = 255 * SrgbEncode(Math.max(0, output));
					const delta = Math.abs(predicted - data.nativeByte);
					rowError += delta;
					sum += delta;
					++count;
				}
			}
		}
		perAlpha.push({
			authoredAlpha: alphaRows[row],
			heldOutColorMeanAbsoluteError: +(rowError / (colors.length * backgrounds.length * 3)).toFixed(4),
			meanSourceWeight: +(weights.reduce((acc, item) => acc + item.source, 0) / weights.length).toFixed(4),
			meanBackdropWeight: +(weights.reduce((acc, item) => acc + item.background, 0) / weights.length).toFixed(4)
		});
	}
	return {
		diagnosticOnly: true,
		fitDescription: "2 coefficients per alpha, fit on four colors over both measured backdrops; predict held-out fifth color",
		cannotInferShaderOrUnseenAlpha: true,
		totalChannelCount: count,
		meanAbsoluteByteError: +(sum / count).toFixed(4),
		perAlpha
	};
}
function NonConvexCounterexample() {
	const opaqueOrange = evidence.pixels.workbench.Light[0][1][0];
	const halfOrange = evidence.pixels.workbench.Light[3][1][0];
	const backdrop = backgrounds[1].workbench[0];
	return {
		description: "50%-alpha orange red channel on the light backdrop",
		opaqueOrange, backdrop, nativeHalfAlpha: halfOrange,
		ordinarySourceOverImpossible: halfOrange < Math.min(opaqueOrange, backdrop)
			|| halfOrange > Math.max(opaqueOrange, backdrop)
	};
}
if (authoredColors.length !== 5 || backgrounds.length !== 2 || alphaRows.length !== 5)
	throw new Error("Changed color calibration dimensions; reexamine source data");

const result = {
	study: "Phase 2U native compositor model comparison",
	source: "Existing Phase 2Q authored colors and Phase 2R native screenshot swatches",
	premises: ["DayZ GetColor() packs authored RGBA to 8-bit integers", "WhitePixel atlas texel is opaque white"],
	opaqueTransfer: OpaqueTransferEvaluation(),
	compositingCandidates: Models().map(EvaluateModel),
	nonConvexCounterexample: NonConvexCounterexample(),
	heldOutColorLinearWeightDiagnostic: LeaveOneColorOutDiagnostic(),
	scope: "150 native RGB measurements (2 backdrops x 5 alpha levels x 5 colors x 3 channels)",
	warning: "The coefficient fit is a descriptive upper-bound, not a native shader/compositing law; cannot be promoted or assumed to generalize to unseen alpha, backgrounds, textures or widgets."
};
console.log(JSON.stringify(result, null, 2));
