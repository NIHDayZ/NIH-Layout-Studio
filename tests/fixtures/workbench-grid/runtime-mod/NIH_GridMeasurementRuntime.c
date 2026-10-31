/**
 * Disposable native Grid sizing evidence capture. Never load in production.
 * One root, three phases, two explicit root viewport dimensions.
 */
class NIHGridMeasurementProbe {
	protected Widget m_Root;
	protected Widget m_VariationRoot;

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
	}

	protected void ResizeVariations() {
		if (!m_VariationRoot)
			return;
		m_VariationRoot.SetScreenPos(0, 0);
		m_VariationRoot.SetScreenSize(1120, 720);
		m_VariationRoot.Update();
		CaptureVariation("variation-after-resize-1120x720");
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
