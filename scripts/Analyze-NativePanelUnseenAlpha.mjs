/**
 * Phase 2W preregistered alpha interpolation analysis.
 * Uses only previously frozen 2V weights (trained on 2R Dark/Light).
 * No native 2W capture or revised coefficients enter interpolation.
 *
 * node scripts/Analyze-NativePanelUnseenAlpha.mjs
 * node scripts/Analyze-NativePanelUnseenAlpha.mjs path/to/native-2w-observations.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const base = new URL("../tests/fixtures/workbench-grid/", import.meta.url);
const preregistered = JSON.parse(readFileSync(
	new URL("panel-color-phase2w-frozen-predictions.json", base), "utf8"));
const previous = JSON.parse(readFileSync(
	new URL("panel-color-phase2v-frozen-predictions.json", base), "utf8"));
const colorEvidence = JSON.parse(readFileSync(
	new URL("panel-color-phase2q-screenshot-evidence.json", base), "utf8"));

const colors = colorEvidence.samples.map(item => item.authored.slice(0, 3));
const alphaOrder = preregistered.alphas;
const backgrounds = preregistered.backgrounds;

function Quantize(value) {
	return Math.round(value * 255) / 255;
}

function EncodeSrgb(linear) {
	if (linear <= 0.0031308)
		return linear * 12.92;
	return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function ToByte(linear) {
	return Math.round(255 * EncodeSrgb(Math.max(0, Math.min(1, linear))));
}

// Fritsch-Carlson / PCHIP: preserve monotonic slopes at all training knots.
// There are no fitted parameters other than the already frozen knot weights.
function Pchip(x, y, target) {
	const count = x.length;
	if (x.length !== y.length || count < 3)
		throw new Error("PCHIP needs >=3 paired nodes");

	const h = [];
	const differences = [];
	const slopes = [];

	for (let i = 0; i < count - 1; ++i) {
		const length = x[i + 1] - x[i];
		if (!(length > 0))
			throw new Error("PCHIP knots must increase strictly");
		h.push(length);
		differences.push((y[i + 1] - y[i]) / length);
	}
	for (let i = 0; i < count; ++i) {
		if (i === 0 || i === count - 1) {
			const interval = i === 0 ? 0 : count - 2;
			const adjacent = i === 0 ? 1 : count - 3;
			const direction = differences[interval];
			let slope = ((2 * h[interval] + h[adjacent]) * direction
				- h[interval] * differences[adjacent]) / (h[interval] + h[adjacent]);
			if (Math.sign(slope) !== Math.sign(direction))
				slope = 0;
			else if (Math.sign(direction) !== Math.sign(differences[adjacent])
				&& Math.abs(slope) > 3 * Math.abs(direction))
				slope = 3 * direction;
			slopes.push(slope);
		} else if (differences[i - 1] * differences[i] <= 0) {
			slopes.push(0);
		} else {
			const w1 = 2 * h[i] + h[i - 1];
			const w2 = h[i] + 2 * h[i - 1];
			slopes.push((w1 + w2) / (w1 / differences[i - 1] + w2 / differences[i]));
		}
	}
	if (target <= x[0])
		return y[0];
	if (target >= x[count - 1])
		return y[count - 1];

	let i = 0;
	while (i < count - 2 && target > x[i + 1])
		++i;
	const t = (target - x[i]) / h[i];
	const t2 = t * t;
	const t3 = t2 * t;
	return (2 * t3 - 3 * t2 + 1) * y[i]
		+ (t3 - 2 * t2 + t) * h[i] * slopes[i]
		+ (-2 * t3 + 3 * t2) * y[i + 1]
		+ (t3 - t2) * h[i] * slopes[i + 1];
}

function Linear(x, y, target) {
	if (target <= x[0])
		return y[0];
	if (target >= x[x.length - 1])
		return y[y.length - 1];
	let i = 0;
	while (i < x.length - 2 && target > x[i + 1])
		++i;
	const ratio = (target - x[i]) / (x[i + 1] - x[i]);
	return y[i] * (1 - ratio) + y[i + 1] * ratio;
}

function CalculateFrozenModels() {
	const knots = previous.coefficients.map(item => ({
		alpha: Quantize(item.authoredAlpha),
		source: item.sourceWeight,
		background: item.backdropWeight
	})).sort((left, right) => left.alpha - right.alpha);

	if (preregistered.measurementStatus !== "PREDICTIONS_FROZEN_BEFORE_NEW_ALPHA_NATIVE_CAPTURE"
		|| preregistered.allowReFittingAfterCapture !== false)
		throw new Error("Phase 2W preregistration must remain frozen");
	if (JSON.stringify(knots) !== JSON.stringify(preregistered.knownKnots))
		throw new Error("Earlier coefficients changed relative to frozen Phase 2W training knots");

	const x = knots.map(item => item.alpha);
	const source = knots.map(item => item.source);
	const background = knots.map(item => item.background);

	const weights = alphaOrder.map(alpha => {
		const target = Quantize(alpha);
		return {
			authoredAlpha: alpha,
			quantizedAlpha: target,
			pchip: { source: Pchip(x, source, target), background: Pchip(x, background, target) },
			linear: { source: Linear(x, source, target), background: Linear(x, background, target) }
		};
	});

	const predictions = {};
	for (const backdrop of backgrounds) {
		predictions[backdrop.name] = {};
		for (const model of ["pchip", "linear"]) {
			predictions[backdrop.name][model] = alphaOrder.map((alpha, row) =>
				colors.map(color => color.map((value, channel) => {
					const weight = weights[row][model];
					let linear = weight.source * Quantize(value)
						+ weight.background * Quantize(backdrop.authored[channel]);
					if (alpha === 1)
						linear = Quantize(value);
					if (alpha === 0)
						linear = Quantize(backdrop.authored[channel]);
					return ToByte(linear);
				})));
		}
	}

	for (let row = 0; row < weights.length; ++row) {
		const expected = preregistered.interpolatedWeights[row];
		const actual = weights[row];
		for (const model of ["pchip", "linear"]) {
			if (Math.abs(actual[model].source - expected[model].source) > 1e-10
				|| Math.abs(actual[model].background - expected[model].background) > 1e-10)
				throw new Error("Alpha weight changed after preregistration: " + alphaOrder[row]);
		}
	}
	if (JSON.stringify(predictions) !== JSON.stringify(preregistered.predictedNativeRgb))
		throw new Error("Phase 2W native RGB predictions no longer match pre-capture snapshot");
	return { knots, weights, predictions };
}

function CssBaseline(bg, alpha, color) {
	const quantized = Quantize(alpha);
	return color.map((value, channel) => {
		const src = ToByte(Quantize(value));
		const background = ToByte(Quantize(bg.authored[channel]));
		return Math.round(quantized * src + (1 - quantized) * background);
	});
}

function CompareNative(observation, predictions) {
	const seen = new Set();
	const names = backgrounds.map(item => item.name);
	if (!Array.isArray(observation.backgrounds) || observation.backgrounds.length !== names.length)
		throw new Error("Native observations must contain all three backgrounds");
	const report = { perBackground: {}, overall: {}, intermediateOnly: {} };
	const sums = { pchip: 0, linear: 0, css: 0 };
	const intermediateSums = { pchip: 0, linear: 0, css: 0 };
	let totalChannels = 0;
	let intermediateChannels = 0;

	for (const observed of observation.backgrounds) {
		const bg = backgrounds.find(item => item.name === observed.name);
		if (!bg || seen.has(observed.name))
			throw new Error("Duplicate or unexpected background: " + observed.name);
		seen.add(observed.name);
		if (!Array.isArray(observed.backdropRGB) || observed.backdropRGB.length !== 3
			|| observed.backdropRGB.some(value => !Number.isInteger(value) || value < 0 || value > 255))
			throw new Error("Invalid measured backdrop RGB: " + observed.name);
		if (!Array.isArray(observed.swatchesRGB) || observed.swatchesRGB.length !== 6)
			throw new Error("Expected six alpha rows: " + observed.name);

		const backdropDifference = observed.backdropRGB.map((byte, i) =>
			Math.abs(byte - bg.opaqueSrgbPrediction[i]));
		const perAlpha = [];
		const localSums = { pchip: 0, linear: 0, css: 0 };
		for (let row = 0; row < 6; ++row) {
			if (!Array.isArray(observed.swatchesRGB[row]) || observed.swatchesRGB[row].length !== 5)
				throw new Error("Expected five colors for row " + row + " in " + observed.name);
			const rowTotals = { pchip: 0, linear: 0, css: 0 };
			for (let color = 0; color < 5; ++color) {
				const pixel = observed.swatchesRGB[row][color];
				if (!Array.isArray(pixel) || pixel.length !== 3
					|| pixel.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255))
					throw new Error("Invalid native RGB triplet at " + observed.name + "/" + row + "/" + color);
				const baseline = CssBaseline(bg, alphaOrder[row], colors[color]);
				for (let channel = 0; channel < 3; ++channel) {
					for (const model of ["pchip", "linear", "css"]) {
						let predicted = baseline[channel];
						if (model !== "css")
							predicted = predictions[bg.name][model][row][color][channel];
						const delta = Math.abs(pixel[channel] - predicted);
						rowTotals[model] += delta;
						localSums[model] += delta;
						sums[model] += delta;
						if (row > 0 && row < 5)
							intermediateSums[model] += delta;
					}
					++totalChannels;
					if (row > 0 && row < 5)
						++intermediateChannels;
				}
			}
			const result = { authoredAlpha: alphaOrder[row] };
			for (const name of ["pchip", "linear", "css"])
				result[name] = +(rowTotals[name] / 15).toFixed(4);
			perAlpha.push(result);
		}
		const average = {};
		for (const name of ["pchip", "linear", "css"])
			average[name] = +(localSums[name] / 90).toFixed(4);
		report.perBackground[bg.name] = {
			backdropExpectedRgb: bg.opaqueSrgbPrediction,
			backdropMeasuredRgb: observed.backdropRGB,
			backdropAbsoluteErrors: backdropDifference,
			perAlpha,
			overallMAE: average
		};
	}
	if (seen.size !== 3)
		throw new Error("Native observation set missing a background");
	report.channelCount = totalChannels;
	report.intermediateChannelCount = intermediateChannels;
	for (const name of ["pchip", "linear", "css"]) {
		report.overall[name] = +(sums[name] / totalChannels).toFixed(4);
		report.intermediateOnly[name] = +(intermediateSums[name] / intermediateChannels).toFixed(4);
	}
	report.warning = "Held-out alpha observations were NOT used to refit curves. A fitted curve is not proof of the native GPU shader.";
	return report;
}

const { weights, predictions } = CalculateFrozenModels();
const nativePath = process.argv[2];
const report = {
	phase: "2W",
	status: nativePath ? "HELD_OUT_ALPHA_COMPARISON" : "PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE",
	training: "Frozen Phase 2V coefficients from Phase 2R Dark and Light only",
	backgroundOrder: backgrounds.map(item => item.name),
	alphaOrder,
	unseenAlphas: preregistered.unseenAlphas,
	preregisteredModels: ["pchip", "linear", "ordinary-srgb-css"],
	interpolatedWeights: weights,
	predictedNativeRgb: predictions,
	nativeMeasurementsAvailable: !!nativePath,
	validatedHeldOutAlphas: false
};
if (nativePath) {
	const observed = JSON.parse(readFileSync(resolve(nativePath), "utf8"));
	report.heldOut = CompareNative(observed, predictions);
	report.validatedHeldOutAlphas = true;
}
console.log(JSON.stringify(report, null, 2));
