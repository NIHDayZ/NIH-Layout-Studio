import { ResolveChildClip, TranslateRect, type ArrangedWidget, type GeometryRect, type LayoutConstraints, type MeasuredWidget } from "./GeometryCore.js";
import { ResolveAuthoredRect, ResolveAuthoredRectWithSize, type GeometryWidget } from "./WidgetGeometry.js";
import { ChildConstraints, MeasureLayoutTree, type MeasuredLayoutNode, type MeasuredLayoutTree } from "./LayoutMeasurement.js";
import { PlanManagedChildren, ProbeWrapContentHeight, ProbeScrollViewport, ProbeUnscaledScrollViewport, type ArrangementOptions, type AppliedLayoutStrategy } from "./LayoutArrangers.js";
import type { UnscaledScrollViewportCandidate } from "./ScrollSettings.js";
import { EstimateNativeScrollExtent, type AuthoredScrollViewport, type NativeScrollExtentCandidate } from "./ScrollViewport.js";
import type { IntrinsicEvidence, IntrinsicFamily } from "./IntrinsicMeasurements.js";
import type { ConstrainedTextResult } from "./ConstrainedText.js";
import { ResolveBoundedParentHeight, type ParentContentAttempt } from "./ParentContent.js";
export type { ArrangementOptions, AppliedLayoutStrategy } from "./LayoutArrangers.js";

export type GeometryIssueCode = "unresolved-layout-strategy" | "unresolved-size-to-content" | "unresolved-parent-content-dependency" | "duplicate-widget-id";

export interface GeometryIssue {
	code: GeometryIssueCode;
	id: string;
	type: string;
	detail: string;
}

export interface AppliedIntrinsicContent {
	id: string;
	family: IntrinsicFamily;
	evidence: IntrinsicEvidence;
	axes: readonly ("horizontal" | "vertical")[];
}

export interface AppliedConstrainedText {
	id: string;
	evidence: "sdf-preview-flow";
	widthUsed: number;
	lineCount: number;
	axis: "vertical";
}

export interface AppliedParentContent {
	id: string;
	evidence: "bounded-child-extent-prototype";
	axis: "vertical";
	contributingChildren: number;
}

export interface AppliedWrapContent {
	id: string;
	evidence: "native-derived-wrap-lines";
	axis: "vertical";
	lineCount: number;
	requiredHeight: number;
}

export interface AuthoredGeometrySnapshot {
	/**
	 * Pre-order geometry in document order. These are authored-coordinate
	 * rectangles, NOT the final Grid/Wrap/Scroll layout arrangement.
	 */
	entries: readonly ArrangedWidget[];
	byId: ReadonlyMap<string, ArrangedWidget>;
	/** Conservative authored-size hints; native content extents are unresolved. */
	measuredById: ReadonlyMap<string, MeasuredWidget>;
	issues: readonly GeometryIssue[];
	/** Only actually applied native-derived strategy prototypes, not unimplemented types. */
	appliedStrategies: readonly AppliedLayoutStrategy[];
	appliedIntrinsics: readonly AppliedIntrinsicContent[];
	appliedConstrainedText: readonly AppliedConstrainedText[];
	appliedParentContent: readonly AppliedParentContent[];
	appliedWrapContent: readonly AppliedWrapContent[];
	/** Authored-only Scroll viewport hints, never native offsets or scrollbars. */
	scrollViewports: ReadonlyMap<string, AuthoredScrollViewport>;
	/** Native-derived max extents ONLY; no scroll offset or scrollbar geometry. */
	scrollExtentCandidates: ReadonlyMap<string, NativeScrollExtentCandidate>;
	/** Unscaled native scrollbar reservation candidates. Does not modify real clipping or scroll offsets. */
	scrollAdjustedViewports: ReadonlyMap<string, UnscaledScrollViewportCandidate>;
	rootRect: GeometryRect;
}

/**
 * Phase 2: top-down arrangement of authored coordinates from prepared
 * measurements. Native container layout is deliberately NOT applied.
 *
 * The measurement tree already contains decoded geometry properties; no
 * per-widget property rescans or new intrinsic measurements occur here.
 */
export function ArrangeMeasuredGeometry(
	measured: MeasuredLayoutTree,
	rootRect: GeometryRect,
	dpiScale = 1,
	options: ArrangementOptions = {}
): AuthoredGeometrySnapshot {
	const entries: ArrangedWidget[] = [];
	const byId = new Map<string, ArrangedWidget>();
	const measuredById = new Map<string, MeasuredWidget>();
	const issues: GeometryIssue[] = [];
	const appliedStrategies: AppliedLayoutStrategy[] = [];
	const appliedIntrinsics: AppliedIntrinsicContent[] = [];
	const appliedConstrainedText: AppliedConstrainedText[] = [];
	const appliedParentContent: AppliedParentContent[] = [];
	const appliedWrapContent: AppliedWrapContent[] = [];
	const scrollViewports = new Map<string, AuthoredScrollViewport>();
	const scrollExtentCandidates = new Map<string, NativeScrollExtentCandidate>();
	const scrollAdjustedViewports = new Map<string, UnscaledScrollViewportCandidate>();
	// Only the current arrangement pass owns these width-dependent metrics.
	// No cross-frame or cross-document invalidation assumptions are needed.
	const textCache = new WeakMap<MeasuredLayoutNode, Map<number, ConstrainedTextResult | null>>();
	function ProbeTextHeight(node: MeasuredLayoutNode, width: number): ConstrainedTextResult | null {
		if (!options.constrainedTextPreview || !node.textFlow || !Number.isFinite(width) || width <= 0)
			return null;
		let perWidth = textCache.get(node);
		if (!perWidth) {
			perWidth = new Map();
			textCache.set(node, perWidth);
		}
		if (perWidth.has(width))
			return perWidth.get(width) ?? null;
		const proposed = node.textFlow.measure(width);
		const valid = proposed && Number.isFinite(proposed.height) && proposed.height > 0
			&& Number.isInteger(proposed.lineCount) && proposed.lineCount > 0
			&& proposed.widthUsed === width && proposed.evidence === "sdf-preview-flow"
			? proposed : null;
		perWidth.set(width, valid);
		return valid;
	}


	function Visit(
		nodes: readonly MeasuredLayoutNode[],
		parentRect: GeometryRect,
		constraints: LayoutConstraints,
		parentId: string | null,
		inheritedClip: GeometryRect | null,
		parentVisible: boolean,
		allocatedRects: readonly GeometryRect[] | null
	): void {
		for (let index = 0; index < nodes.length; ++index) {
			const prepared = nodes[index];
			const { node, authored, strategy } = prepared;
			const parentSize = {
				width: constraints.availableWidth,
				height: constraints.availableHeight
			};
			// A layout strategy has already assigned this cell; avoid resolving
			// unused authored coordinates for managed children.
			const strategyRect = allocatedRects?.[index];
			const authoredRect = strategyRect ?? ResolveAuthoredRect(authored, parentSize);
			const measuredWrapContent = !strategyRect
				? ProbeWrapContentHeight(prepared, authoredRect.width, options) : null;
			const useWrapHeight = measuredWrapContent !== null;
			// Width-constrained text and child-extent measurement share the
			// same pass-local validated cache. No cross-document stale results.
			const constrainedText = !allocatedRects ? ProbeTextHeight(prepared, authoredRect.width) : null;
			const useConstrainedHeight = constrainedText !== null;
			const intrinsic = prepared.intrinsic?.measurement;
			const applyContent = options.providedIntrinsicContent === true && intrinsic !== undefined
				&& prepared.children.length === 0 && !allocatedRects;
			const useWidth = applyContent && authored.sizeToContentWidth && intrinsic?.width !== undefined;
			const useIntrinsicHeight = !useConstrainedHeight && applyContent
				&& authored.sizeToContentHeight && intrinsic?.height !== undefined;
			const parentAttempt: ParentContentAttempt | null =
				options.boundedParentContent && !allocatedRects && !useWrapHeight && prepared.children.length > 0
					&& authored.sizeToContentHeight
					? ResolveBoundedParentHeight(prepared, authoredRect.width, {
						textHeight: (child, width) => ProbeTextHeight(child, width)?.height ?? null,
						intrinsicHeight: (child) => options.providedIntrinsicContent
							? child.intrinsic?.measurement.height ?? null : null
					}) : null;
			const parentHeight = parentAttempt?.result?.height;
			const useParentHeight = parentHeight !== undefined;
			const useHeight = useWrapHeight || useParentHeight || useConstrainedHeight || useIntrinsicHeight;
			const resolvedSize = {
				width: useWidth ? intrinsic!.width! : authoredRect.width,
				height: useWrapHeight ? measuredWrapContent!.requiredHeight
					: useParentHeight ? parentHeight : useConstrainedHeight ? constrainedText!.height
					: useIntrinsicHeight ? intrinsic!.height! : authoredRect.height
			};
			const localRect = strategyRect ?? (
				useWidth || useHeight
					? ResolveAuthoredRectWithSize(authored, parentSize, resolvedSize)
					: authoredRect
			);
			if (useWrapHeight) {
				appliedWrapContent.push({
					id: node.id,
					evidence: "native-derived-wrap-lines",
					axis: "vertical",
					lineCount: measuredWrapContent!.lineCount,
					requiredHeight: measuredWrapContent!.requiredHeight
				});
			}
			if (useParentHeight) {
				appliedParentContent.push({
					id: node.id,
					evidence: "bounded-child-extent-prototype",
					axis: "vertical",
					contributingChildren: parentAttempt!.result!.contributingChildren
				});
			}
			if (parentAttempt?.failure) {
				issues.push({
					code: "unresolved-parent-content-dependency",
					id: node.id,
					type: node.type,
					detail: `Cannot estimate parent content height: ${parentAttempt.failure} at ${parentAttempt.causeId ?? node.id}.`
				});
			}
			if (useConstrainedHeight) {
				appliedConstrainedText.push({
					id: node.id,
					evidence: constrainedText!.evidence,
					widthUsed: constrainedText!.widthUsed,
					lineCount: constrainedText!.lineCount,
					axis: "vertical"
				});
			}
			if (useWidth || useIntrinsicHeight) {
				const axes: ("horizontal" | "vertical")[] = [];
				if (useWidth)
					axes.push("horizontal");
				if (useIntrinsicHeight)
					axes.push("vertical");
				appliedIntrinsics.push({
					id: node.id,
					family: prepared.intrinsic!.family,
					evidence: intrinsic!.evidence,
					axes
				});
			}
			const absoluteRect = TranslateRect(localRect, parentRect);
			const arranged: ArrangedWidget = {
				id: node.id,
				parentId,
				localRect,
				absoluteRect,
				clipRect: inheritedClip ? { ...inheritedClip } : null,
				visible: parentVisible && authored.visible,
				sortOrder: authored.sortOrder
			};

			entries.push(arranged);
			if (byId.has(node.id)) {
				issues.push({
					code: "duplicate-widget-id",
					id: node.id,
					type: node.type,
					detail: "Duplicate ID: byId retains the first widget; inspect entries to find each occurrence."
				});
			} else {
				byId.set(node.id, arranged);
				measuredById.set(node.id, prepared.measurement);
			}

			if ((prepared.unresolvedContentWidth && !useWidth) || (prepared.unresolvedContentHeight && !useHeight)) {
				const axes = [
					prepared.unresolvedContentWidth && !useWidth ? "horizontal" : "",
					prepared.unresolvedContentHeight && !useHeight ? "vertical" : ""
				].filter(Boolean).join(" and ");
				issues.push({
					code: "unresolved-size-to-content",
					id: node.id,
					type: node.type,
					detail: `Native ${axes} size-to-content has not been measured; unresolved axes use authored size.`
				});
			}
			const wantsScrollInspection = (options.scrollViewportDiagnostics || options.scrollNativeExtentDiagnostics)
				&& strategy.kind === "scroll";
			if (strategy.kind === "scroll" && options.scrollScrollbarViewportDiagnostics
				&& !scrollAdjustedViewports.has(node.id)) {
				const adjusted = ProbeUnscaledScrollViewport(prepared, absoluteRect, constraints.dpiScale, options);
				if (adjusted)
					scrollAdjustedViewports.set(node.id, adjusted);
			}
			const viewportDiagnostic = wantsScrollInspection
				? ProbeScrollViewport(prepared, absoluteRect, {
					...options, scrollViewportDiagnostics: true
				}) : null;
			if (viewportDiagnostic) {
				if (options.scrollViewportDiagnostics && !scrollViewports.has(node.id))
					scrollViewports.set(node.id, viewportDiagnostic);
				if (options.scrollNativeExtentDiagnostics && !scrollExtentCandidates.has(node.id)
					// The max-extent candidate assumes no scrollbar reservations.
					&& prepared.nativeScroll && !prepared.nativeScroll.horizontal
					&& !prepared.nativeScroll.vertical && !prepared.nativeScroll.verticalLeft) {
					const candidate = EstimateNativeScrollExtent(viewportDiagnostic);
					if (candidate)
						scrollExtentCandidates.set(node.id, candidate);
				}
			}
			const layoutPlan = PlanManagedChildren(prepared, absoluteRect, options, measuredWrapContent);
			const childSlots = layoutPlan?.rects ?? null;
			if (layoutPlan)
				appliedStrategies.push(layoutPlan.applied);
			if (prepared.children.length > 0 && strategy.requiresArrangement && !childSlots) {
				issues.push({
					code: "unresolved-layout-strategy",
					id: node.id,
					type: node.type,
					detail: `Unresolved ${strategy.kind} arrangement (${strategy.evidence} evidence); children use authored positions only.`
				});
			}

			const clip = ResolveChildClip(inheritedClip, absoluteRect, authored.clipChildren);
			const childConstraints = ChildConstraints({
				availableWidth: absoluteRect.width,
				availableHeight: absoluteRect.height
			}, constraints.dpiScale);
			Visit(prepared.children, absoluteRect, childConstraints, node.id, clip, arranged.visible, childSlots);
		}
	}

	const rootConstraints: LayoutConstraints = {
		availableWidth: rootRect.width,
		availableHeight: rootRect.height,
		dpiScale
	};
	Visit(measured.roots, rootRect, rootConstraints, null, { ...rootRect }, true, null);
	return { entries, byId, measuredById, issues, appliedStrategies, appliedIntrinsics, appliedConstrainedText, appliedParentContent, appliedWrapContent, scrollViewports, scrollExtentCandidates, scrollAdjustedViewports, rootRect: { ...rootRect } };
}

/**
 * Diagnostic convenience entry point. Builds one bottom-up measurement tree,
 * then arranges the authored geometry top-down. For a future renderer,
 * reuse a prepared measurement tree instead of reparsing it for every view.
 */
export function BuildAuthoredGeometrySnapshot(
	roots: readonly GeometryWidget[],
	rootRect: GeometryRect
): AuthoredGeometrySnapshot {
	return ArrangeMeasuredGeometry(MeasureLayoutTree(roots), rootRect);
}
