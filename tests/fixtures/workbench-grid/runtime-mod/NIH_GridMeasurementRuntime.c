/**
 * Disposable native Grid sizing evidence capture. Never load in production.
 * Sequential native roots, each captured before/after Update and after root resize.
 */
class NIHGridMeasurementProbe {
	protected Widget m_Root;
	protected Widget m_VariationRoot;
	protected Widget m_RelativeRoot;
	protected Widget m_ComplexRoot;
	protected Widget m_ColorRoot;
	protected Widget m_PanelStyleRoot;
	protected Widget m_NestedDependencyRoot;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Grid_Measurement_Matrix.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][GridProbe] ERROR layout resource unavailable");
			return;
		}

		Capture("after-create");
		m_Root.Update();
		Capture("post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ResizeAndCapture, 900, false);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartVariations, 1800, false);
		// Phase 3L: schedule independently of earlier experimental fixtures.
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartNestedDependencies, 9500, false);
	}

	protected void ResizeAndCapture() {
		if (!m_Root)
			return;

		m_Root.SetScreenPos(0, 0);
		m_Root.SetScreenSize(1120, 720);
		m_Root.Update();
		Capture("after-resize-1120x720");
	}

	protected void StartVariations() {
		m_VariationRoot = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Grid_Variation_Matrix.layout");
		if (!m_VariationRoot) {
			Print("[NIH_LayoutStudio][GridProbe] ERROR variation layout unavailable");
			return;
		}
		CaptureVariation("variation-after-create");
		m_VariationRoot.Update();
		CaptureVariation("variation-post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ResizeVariations, 900, false);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartRelativeMatrix, 1800, false);
	}

	protected void ResizeVariations() {
		if (!m_VariationRoot)
			return;
		m_VariationRoot.SetScreenPos(0, 0);
		m_VariationRoot.SetScreenSize(1120, 720);
		m_VariationRoot.Update();
		CaptureVariation("variation-after-resize-1120x720");
	}

	protected void StartRelativeMatrix() {
		m_RelativeRoot = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Grid_Relative_Matrix.layout");
		if (!m_RelativeRoot) {
			Print("[NIH_LayoutStudio][GridProbe] ERROR relative layout unavailable");
			return;
		}
		CaptureRelative("relative-after-create");
		m_RelativeRoot.Update();
		CaptureRelative("relative-post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ResizeRelativeMatrix, 900, false);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartComplexMatrix, 1800, false);
	}

	protected void ResizeRelativeMatrix() {
		if (!m_RelativeRoot)
			return;
		m_RelativeRoot.SetScreenPos(0, 0);
		m_RelativeRoot.SetScreenSize(1120, 720);
		m_RelativeRoot.Update();
		CaptureRelative("relative-after-resize-1120x720");
	}

	protected void StartComplexMatrix() {
		m_ComplexRoot = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Grid_Complex_Matrix.layout");
		if (!m_ComplexRoot) {
			Print("[NIH_LayoutStudio][GridProbe] ERROR complex layout unavailable");
			return;
		}

		CaptureComplex("complex-after-create");
		m_ComplexRoot.Update();
		CaptureComplex("complex-post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ResizeComplexMatrix, 900, false);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartColorFlagProbe, 1800, false);
	}

	protected void ResizeComplexMatrix() {
		if (!m_ComplexRoot)
			return;

		m_ComplexRoot.SetScreenPos(0, 0);
		m_ComplexRoot.SetScreenSize(1120, 720);
		m_ComplexRoot.Update();
		CaptureComplex("complex-after-resize-1120x720");
	}

	/**
	 * Phase 2S: read-only native widget rendering state.
	 * Uses the existing disposable client probe only after grid captures finish.
	 * Widget IDs are intentionally not used, including for pre-update checks.
	 */
	protected void StartColorFlagProbe() {
		m_ColorRoot = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Panel_Background_Calibration.layout");
		if (!m_ColorRoot) {
			Print("[NIH_LayoutStudio][ColorFlagProbe] ERROR color calibration layout unavailable");
			return;
		}

		CaptureColorFlags("after-create");
		m_ColorRoot.Update();
		CaptureColorFlags("post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(StartPanelStyleProbe, 900, false);
	}

	protected void CaptureColorFlags(string phase) {
		if (!m_ColorRoot)
			return;

		Print("[NIH_LayoutStudio][ColorFlagProbe] BEGIN " + phase);
		// Log the *actual* script enum values, not assumptions about bit indices.
		// All four checks were false for native flags=536870975 (0x2000003F).
		int sourceAlphaMask = WidgetFlags.SOURCEALPHA;
		int blendMask = WidgetFlags.BLEND;
		int additiveMask = WidgetFlags.ADDITIVE;
		int noFilterMask = WidgetFlags.NOFILTER;
		string masks = "[NIH_LayoutStudio][ColorFlagProbe] MASKS";
		masks += " sourceAlpha=" + sourceAlphaMask.ToString();
		masks += " blend=" + blendMask.ToString();
		masks += " additive=" + additiveMask.ToString();
		masks += " noFilter=" + noFilterMask.ToString();
		Print(masks);
		CaptureColorWidget(m_ColorRoot, "QBackdropDark", phase);
		CaptureColorWidget(m_ColorRoot, "QDarkBlueAlpha100", phase);
		CaptureColorWidget(m_ColorRoot, "QDarkOrangeAlpha050", phase);
		CaptureColorWidget(m_ColorRoot, "QDarkGreenAlpha025", phase);
		CaptureColorWidget(m_ColorRoot, "QDarkPinkAlpha000", phase);
		CaptureColorWidget(m_ColorRoot, "QBackdropLight", phase);
		CaptureColorWidget(m_ColorRoot, "QLightBlueAlpha100", phase);
		CaptureColorWidget(m_ColorRoot, "QLightOrangeAlpha050", phase);
		CaptureColorWidget(m_ColorRoot, "QLightGreenAlpha025", phase);
		CaptureColorWidget(m_ColorRoot, "QLightPinkAlpha000", phase);
		Print("[NIH_LayoutStudio][ColorFlagProbe] END " + phase);
	}

	protected void CaptureColorWidget(Widget root, string widgetName, string phase) {
		Widget widget = root.FindAnyWidget(widgetName);
		if (!widget) {
			Print("[NIH_LayoutStudio][ColorFlagProbe] ERROR missing widget " + widgetName);
			return;
		}

		int flags = widget.GetFlags();
		bool hasSourceAlpha = (flags & WidgetFlags.SOURCEALPHA) != 0;
		bool hasBlend = (flags & WidgetFlags.BLEND) != 0;
		bool hasAdditive = (flags & WidgetFlags.ADDITIVE) != 0;
		bool hasNoFilter = (flags & WidgetFlags.NOFILTER) != 0;
		string entry = string.Format("[NIH_LayoutStudio][ColorFlagProbe] phase=%1 name=%2 type=%3", phase, widget.GetName(), widget.GetTypeName());
		entry += " style=" + widget.GetStyleName();
		entry += " colorARGB=" + widget.GetColor().ToString();
		entry += " alpha=" + widget.GetAlpha().ToString();
		entry += " flags=" + flags.ToString();
		entry += " sourceAlpha=" + hasSourceAlpha.ToString();
		entry += " blend=" + hasBlend.ToString();
		entry += " additive=" + hasAdditive.ToString();
		entry += " noFilter=" + hasNoFilter.ToString();
		entry += " visible=" + widget.IsVisible().ToString();
		Print(entry);
	}

	/**
	 * Phase 2T: compare identical PanelWidgets with no authored style against
	 * rover_sim_colorable. A no-style panel might not paint at all: keep the
	 * actual GetStyleName(), widget color, alpha and flags as native evidence.
	 * This is client-only, read-only and independent of prior geometry roots.
	 */
	protected void StartPanelStyleProbe() {
		m_PanelStyleRoot = g_Game.GetWorkspace().CreateWidgets("NIH_GridMeasurementProbe/gui/layouts/NIH_Panel_Style_Comparison.layout");
		if (!m_PanelStyleRoot) {
			Print("[NIH_LayoutStudio][PanelStyleProbe] ERROR comparison layout unavailable");
			return;
		}

		CapturePanelStyles("after-create");
		m_PanelStyleRoot.Update();
		CapturePanelStyles("post-update");
	}

	protected void CapturePanelStyles(string phase) {
		if (!m_PanelStyleRoot)
			return;

		Print("[NIH_LayoutStudio][PanelStyleProbe] BEGIN " + phase);
		CapturePanelStyleWidget("QTBackdropDark", phase);
		CapturePanelStyleWidget("QTBackdropLight", phase);
		CapturePanelStyleWidget("QTDarkPlainBlueAlpha100", phase);
		CapturePanelStyleWidget("QTDarkStyledBlueAlpha100", phase);
		CapturePanelStyleWidget("QTDarkPlainOrangeAlpha050", phase);
		CapturePanelStyleWidget("QTDarkStyledOrangeAlpha050", phase);
		CapturePanelStyleWidget("QTDarkPlainGreenAlpha025", phase);
		CapturePanelStyleWidget("QTDarkStyledGreenAlpha025", phase);
		CapturePanelStyleWidget("QTDarkPlainPinkAlpha000", phase);
		CapturePanelStyleWidget("QTDarkStyledPinkAlpha000", phase);
		CapturePanelStyleWidget("QTLightPlainBlueAlpha100", phase);
		CapturePanelStyleWidget("QTLightStyledBlueAlpha100", phase);
		CapturePanelStyleWidget("QTLightPlainOrangeAlpha050", phase);
		CapturePanelStyleWidget("QTLightStyledOrangeAlpha050", phase);
		CapturePanelStyleWidget("QTLightPlainGreenAlpha025", phase);
		CapturePanelStyleWidget("QTLightStyledGreenAlpha025", phase);
		CapturePanelStyleWidget("QTLightPlainPinkAlpha000", phase);
		CapturePanelStyleWidget("QTLightStyledPinkAlpha000", phase);
		Print("[NIH_LayoutStudio][PanelStyleProbe] END " + phase);
	}

	protected void CapturePanelStyleWidget(string widgetName, string phase) {
		Widget widget = m_PanelStyleRoot.FindAnyWidget(widgetName);
		if (!widget) {
			Print("[NIH_LayoutStudio][PanelStyleProbe] ERROR missing widget " + widgetName);
			return;
		}

		string entry = "[NIH_LayoutStudio][PanelStyleProbe] phase=" + phase;
		entry += " name=" + widget.GetName();
		entry += " type=" + widget.GetTypeName();
		entry += " style=" + widget.GetStyleName();
		entry += " colorARGB=" + widget.GetColor().ToString();
		entry += " alpha=" + widget.GetAlpha().ToString();
		entry += " flags=" + widget.GetFlags().ToString();
		entry += " visible=" + widget.IsVisible().ToString();
		Print(entry);
	}

	protected void CaptureComplex(string phase) {
		Print("[NIH_LayoutStudio][GridProbe] BEGIN " + phase);
		CaptureTree(m_ComplexRoot, phase);
		Print("[NIH_LayoutStudio][GridProbe] END " + phase);
	}

	/**
	 * Phase 3L native nested manager allocation evidence. This disposable,
	 * client-only probe logs actual widget bounds instead of guessing
	 * GridSpacer parent extents from visible color swatches in Workbench.
	 * Widget identity uses names; generated IDs are not assumed present.
	 */
	protected void StartNestedDependencies() {
		if (g_Game.IsDedicatedServer())
			return;

		m_NestedDependencyRoot = g_Game.GetWorkspace().CreateWidgets(
			"NIH_GridMeasurementProbe/gui/layouts/NIH_Grid_Nested_Dependency_Matrix.layout");
		if (!m_NestedDependencyRoot) {
			Print("[NIH_LayoutStudio][NestedGridProbe] ERROR nested layout resource unavailable");
			return;
		}

		CaptureNestedDependencies("after-create");
		m_NestedDependencyRoot.Update();
		CaptureNestedDependencies("post-update");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureSettledNestedDependencies, 900, false);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ResizeNestedDependencies, 1800, false);
	}

	protected void CaptureNestedDependencies(string phase) {
		if (!m_NestedDependencyRoot)
			return;

		Print("[NIH_LayoutStudio][NestedGridProbe] BEGIN " + phase);
		CaptureTree(m_NestedDependencyRoot, phase);
		Print("[NIH_LayoutStudio][NestedGridProbe] END " + phase);
	}

	protected void CaptureSettledNestedDependencies() {
		if (!m_NestedDependencyRoot)
			return;

		m_NestedDependencyRoot.Update();
		CaptureNestedDependencies("post-settle");
	}

	protected void ResizeNestedDependencies() {
		if (!m_NestedDependencyRoot)
			return;

		m_NestedDependencyRoot.SetScreenPos(0, 0);
		m_NestedDependencyRoot.SetScreenSize(1120, 720);
		m_NestedDependencyRoot.Update();
		CaptureNestedDependencies("after-resize-1120x720");
	}

	protected void CaptureRelative(string phase) {
		Print("[NIH_LayoutStudio][GridProbe] BEGIN " + phase);
		CaptureTree(m_RelativeRoot, phase);
		Print("[NIH_LayoutStudio][GridProbe] END " + phase);
	}

	protected void CaptureVariation(string phase) {
		Print("[NIH_LayoutStudio][GridProbe] BEGIN " + phase);
		CaptureTree(m_VariationRoot, phase);
		Print("[NIH_LayoutStudio][GridProbe] END " + phase);
	}

	protected void Capture(string phase) {
		if (!m_Root)
			return;

		Print("[NIH_LayoutStudio][GridProbe] BEGIN " + phase);
		CaptureTree(m_Root, phase);
		Print("[NIH_LayoutStudio][GridProbe] END " + phase);
	}

	protected void CaptureTree(Widget widget, string phase) {
		if (!widget)
			return;

		float localX;
		float localY;
		float localWidth;
		float localHeight;
		float screenX;
		float screenY;
		float screenWidth;
		float screenHeight;
		widget.GetPos(localX, localY);
		widget.GetSize(localWidth, localHeight);
		widget.GetScreenPos(screenX, screenY);
		widget.GetScreenSize(screenWidth, screenHeight);

		int childCount = 0;
		Widget countChild = widget.GetChildren();
		while (countChild) {
			++childCount;
			countChild = countChild.GetSibling();
		}

		string localRect = string.Format("%1,%2,%3,%4", localX, localY, localWidth, localHeight);
		string screenRect = string.Format("%1,%2,%3,%4", screenX, screenY, screenWidth, screenHeight);
		string identity = string.Format("[NIH_LayoutStudio][GridProbe] phase=%1 name=%2 type=%3",
			phase, widget.GetName(), widget.GetTypeName());
		string logLine = identity;
		logLine += " localRect=";
		logLine += localRect;
		logLine += " screenRect=";
		logLine += screenRect;
		logLine += " childCount=";
		logLine += childCount.ToString();
		logLine += " visible=";
		logLine += widget.IsVisible().ToString();
		Print(logLine);

		Widget child = widget.GetChildren();
		while (child) {
			CaptureTree(child, phase);
			child = child.GetSibling();
		}
	}
}

modded class MissionGameplay {
	protected ref NIHGridMeasurementProbe m_NIH_GridMeasurementProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_GridMeasurementProbe = new NIHGridMeasurementProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHStartGridMeasurementProbe, 350, false);
	}

	protected void NIHStartGridMeasurementProbe() {
		if (m_NIH_GridMeasurementProbe)
			m_NIH_GridMeasurementProbe.Start();
	}
}
