/**
 * Phase 2V independent chromatic backdrop prediction verification.
 *
 * Fit intermediate-alpha coefficients ONLY against the two previously seen
 * Phase 2R neutral backgrounds; predict a third backdrop without refitting.
 * Opaque/transparent controls use their exact independently validated rules.
 *
 * Usage:
 *   node scripts/Analyze-NativePanelHeldoutBackdrop.mjs
 *   node scripts/Analyze-NativePanelHeldoutBackdrop.mjs path/to/observed.json
 *
 * An optional observation file must contain backdropRGB:[r,g,b] and
 * swatchesRGB:[6 rows x 5 swatches x 3 integer channels]. It is NEVER
 * used for fitting coefficients, only for reporting out-of-sample error.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("../tests/fixtures/workbench-grid/", import.meta.url);
const training = JSON.parse(readFileSync(new URL("panel-color-phase2r-background-evidence.json", root), "utf8"));
const source = JSON.parse(readFileSync(new URL("panel-color-phase2q-screenshot-evidence.json", root), "utf8"));
const frozen = JSON.parse(readFileSync(new URL("panel-color-phase2v-frozen-predictions.json", root), "utf8"));
const authored = source.samples.map(sample => sample.authored.slice(0, 3));
const background = frozen.background.authored.slice(0, 3);
const alpha = frozen.alphaOrder;

function Quantize(value) {
	return Math.round(255 * value) / 255;
}
function Encode(value) {
	if (value <= 0.0031308)
		return 12.92 * value;
	return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}
function Decode(value) {
	if (value <= 0.04045)
		return value / 12.92;
	return Math.pow((value + 0.055) / 1.055, 2.4);
}
function ChannelByte(value) {
	return Math.round(255 * Encode(Math.max(0, Math.min(1, value))));
}
function FitWeights(row) {
	if (row === 0)
		return { authoredAlpha: 1, sourceWeight: 1, backdropWeight: 0 };
	if (row === 5)
		return { authoredAlpha: 0, sourceWeight: 0, backdropWeight: 1 };
	let sourceSquared = 0;
	let backdropSquared = 0;
	let cross = 0;
	let sourceTarget = 0;
	let backdropTarget = 0;
	// NOTE: Iterate source, then background, then channel, matching the
	// frozen pre-capture fit. No held-out screenshot is read here.
	for (let color = 0; color < 5; ++color) {
		for (let backing = 0; backing < 2; ++backing) {
			for (let channel = 0; channel < 3; ++channel) {
				const src = Quantize(authored[color][channel]);
				const bg = Quantize(training.backgrounds[backing].authored[channel]);
				const nativeByte = training.pixels.workbench[training.backgrounds[backing].name][row][color][channel];
				const target = Decode(nativeByte / 255);
				sourceSquared += src * src;
				backdropSquared += bg * bg;
				cross += src * bg;
				sourceTarget += src * target;
				backdropTarget += bg * target;
			}
		}
	}
	const determinant = sourceSquared * backdropSquared - cross * cross;
	if (Math.abs(determinant) < 1e-12)
		throw new Error("Cannot identify two coefficient candidate from training evidence");
	return {
		authoredAlpha: alpha[row],
		sourceWeight: (sourceTarget * backdropSquared - backdropTarget * cross) / determinant,
		backdropWeight: (backdropTarget * sourceSquared - sourceTarget * cross) / determinant
	};
}
function Predict(row, color, coefficients) {
	if (row === 0)
		return authored[color].map(channel => ChannelByte(Quantize(channel)));
	if (row === 5)
		return background.map(channel => ChannelByte(Quantize(channel)));
	const weights = coefficients[row];
	return authored[color].map((channel, i) =>
		ChannelByte(weights.sourceWeight * Quantize(channel) +
			weights.backdropWeight * Quantize(background[i])));
}
function BaselinePrediction(row, color) {
	const quantizedAlpha = Quantize(alpha[row]);
	return authored[color].map((channel, i) => {
		const foreground = ChannelByte(Quantize(channel));
		const backgroundByte = ChannelByte(Quantize(background[i]));
		return Math.round(quantizedAlpha * foreground + (1 - quantizedAlpha) * backgroundByte);
	});
}
function VerifyFrozenPredictions() {
	if (training.backgrounds.length !== 2 || authored.length !== 5 || alpha.length !== 6)
		throw new Error("Training dimensions have changed; pre-capture model cannot be reused");
	if (frozen.measurementStatus !== "PREDICTIONS_FROZEN_BEFORE_THIRD_NATIVE_CAPTURE")
		throw new Error("Frozen snapshot must not contain native held-out samples");
	if (JSON.stringify(frozen.background.authored) !== JSON.stringify([0.08, 0.36, 0.82, 1]))
		throw new Error("Held-out background changed: original frozen test must remain immutable");
	if (JSON.stringify(training.backgrounds.map(item => item.name)) !== JSON.stringify(["Dark", "Light"]))
		throw new Error("Expected only Phase 2R dark/light data for model fitting");
	const coefficients = alpha.map((_, i) => FitWeights(i));
	const predicted = alpha.map((_, row) => authored.map((_, color) => Predict(row, color, coefficients)));
	const epsilon = 1e-10;
	for (let row = 0; row < alpha.length; ++row) {
		const expected = frozen.coefficients[row];
		const actual = coefficients[row];
		if (expected.authoredAlpha !== actual.authoredAlpha
			|| Math.abs(expected.sourceWeight - actual.sourceWeight) > epsilon
			|| Math.abs(expected.backdropWeight - actual.backdropWeight) > epsilon)
			throw new Error("Frozen weights changed at alpha " + alpha[row]);
		if (JSON.stringify(predicted[row]) !== JSON.stringify(frozen.predictedNativeRgb[row]))
			throw new Error("Frozen RGB predictions changed at alpha " + alpha[row]);
	}
	return { coefficients, predicted };
}
function EvaluateObserved(observed, predicted) {
	if (!Array.isArray(observed.backdropRGB) || observed.backdropRGB.length !== 3
		|| observed.backdropRGB.some(value => !Number.isInteger(value) || value < 0 || value > 255))
		throw new Error("Observation backdropRGB must contain three integer RGB bytes");
	if (!Array.isArray(observed.swatchesRGB) || observed.swatchesRGB.length !== 6)
		throw new Error("Observation swatchesRGB must have six alpha rows");
	for (const row of observed.swatchesRGB) {
		if (!Array.isArray(row) || row.length !== 5)
			throw new Error("Every observation row must contain five RGB samples");
		for (const pixel of row) {
			if (!Array.isArray(pixel) || pixel.length !== 3
				|| pixel.some(value => !Number.isInteger(value) || value < 0 || value > 255))
				throw new Error("Every observation pixel must have three RGB bytes");
		}
	}
	const nativeBackground = frozen.background.opaqueSrgbPrediction;
	const errors = { fittedFromNeutral: [], ordinarySrgbCss: [] };
	let totalFitted = 0;
	let totalBaseline = 0;
	for (let row = 0; row < 6; ++row) {
		let fitted = 0;
		let baseline = 0;
		for (let color = 0; color < 5; ++color) {
			const normal = BaselinePrediction(row, color);
			for (let channel = 0; channel < 3; ++channel) {
				const measured = observed.swatchesRGB[row][color][channel];
				fitted += Math.abs(measured - predicted[row][color][channel]);
				baseline += Math.abs(measured - normal[channel]);
			}
		}
		totalFitted += fitted;
		totalBaseline += baseline;
		errors.fittedFromNeutral.push(+(fitted / 15).toFixed(4));
		errors.ordinarySrgbCss.push(+(baseline / 15).toFixed(4));
	}
	const backdropErrors = observed.backdropRGB.map((value, i) => Math.abs(value - nativeBackground[i]));
	return {
		observationIsHeldOut: true,
		backgroundControl: {
			predictedRGB: nativeBackground,
			measuredRGB: observed.backdropRGB,
			absoluteChannelErrors: backdropErrors
		},
		channelCount: 90,
		perAlphaMAE: errors,
		overallMAE: {
			fittedFromNeutral: +(totalFitted / 90).toFixed(4),
			ordinarySrgbCss: +(totalBaseline / 90).toFixed(4)
		},
		warning: "Observed chromatic backdrop has not been used to train coefficients. Do not refit during validation."
	};
}

const { coefficients, predicted } = VerifyFrozenPredictions();
const report = {
	phase: "2V",
	status: process.argv[2] ? "HELD_OUT_NATIVE_COMPARISON" : "PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE",
	backdropAuthored: frozen.background.authored,
	backdropExpectedRgb: frozen.background.opaqueSrgbPrediction,
	colorOrder: frozen.colorOrder,
	alphaOrder: alpha,
	trainingBackdrops: training.backgrounds.map(entry => entry.name),
	sourceWeights: coefficients.map(value => ({
		alpha: value.authoredAlpha,
		source: +value.sourceWeight.toFixed(5),
		background: +value.backdropWeight.toFixed(5)
	})),
	predictedNativeRgb: predicted,
	ordinarySrgbCssRgb: alpha.map((_, row) => authored.map((_, color) => BaselinePrediction(row, color))),
	nativeObservationsAvailable: !!process.argv[2],
	validatedHeldOut: false
};
if (process.argv[2]) {
	const observed = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
	report.comparison = EvaluateObserved(observed, predicted);
	report.validatedHeldOut = true;
}
console.log(JSON.stringify(report, null, 2));
