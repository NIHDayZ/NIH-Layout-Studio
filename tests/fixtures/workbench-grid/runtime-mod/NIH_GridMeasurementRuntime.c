/**
 * Disposable native Grid sizing evidence capture. Never load in production.
 * One root, three phases, two explicit root viewport dimensions.
 */
class NIHGridMeasurementProbe {
	protected Widget m_Root;

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
	}

	protected void ResizeAndCapture() {
		if (!m_Root)
			return;

		m_Root.SetScreenPos(0, 0);
		m_Root.SetScreenSize(1120, 720);
		m_Root.Update();
		Capture("after-resize-1120x720");
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

		Print(string.Format("[NIH_LayoutStudio][GridProbe] phase=%1 name=%2 type=%3 localRect=%4,%5,%6,%7 screenRect=%8,%9,%10,%11 childCount=%12 visible=%13",
			phase, widget.GetName(), widget.GetTypeName(),
			localX, localY, localWidth, localHeight,
			screenX, screenY, screenWidth, screenHeight, childCount, widget.IsVisible()));

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
