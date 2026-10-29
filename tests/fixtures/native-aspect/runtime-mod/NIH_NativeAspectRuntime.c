/**
 * Disposable DayZ client fixture for independently observing fixaspect geometry.
 * No speculative layout calculations: native getters provide all observations.
 */
class NIHNativeAspectRuntimeProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_NativeAspectProbe/gui/layouts/NIH_NativeAspect_Parity.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][AspectProbe] ERROR: layout resource unavailable");
			return;
		}

		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 700, false, 0.0, 0.0, 960.0, 500.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 1200, false, "root-960x500-origin");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 2300, false, 31.0, 19.0, 1280.0, 720.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 2800, false, "root-1280x720-offset");
	}

	void ApplyViewport(float x, float y, float width, float height) {
		if (!m_Root)
			return;

		m_Root.SetScreenPos(x, y);
		m_Root.SetScreenSize(width, height);
		m_Root.Update();
		Print(string.Format("[NIH_LayoutStudio][AspectProbe] REQUEST rect=%1,%2,%3,%4", x, y, width, height));
	}

	void CaptureAll(string phase) {
		if (!m_Root)
			return;

		Print("[NIH_LayoutStudio][AspectProbe] BEGIN " + phase);
		CaptureNode(m_Root, phase);
		Print("[NIH_LayoutStudio][AspectProbe] END " + phase);
	}

	protected void CaptureNode(Widget widget, string phase) {
		if (!widget)
			return;

		float screenX;
		float screenY;
		float screenWidth;
		float screenHeight;
		float localX;
		float localY;
		float localWidth;
		float localHeight;
		widget.GetScreenPos(screenX, screenY);
		widget.GetScreenSize(screenWidth, screenHeight);
		widget.GetPos(localX, localY);
		widget.GetSize(localWidth, localHeight);

		Print(string.Format("[NIH_LayoutStudio][AspectProbe] phase=%1 name=%2 type=%3 screenRect=%4,%5,%6,%7",
			phase, widget.GetName(), widget.GetTypeName(),
			screenX, screenY, screenWidth, screenHeight));
		Print(string.Format("[NIH_LayoutStudio][AspectProbe] phase=%1 name=%2 localRect=%3,%4,%5,%6",
			phase, widget.GetName(), localX, localY, localWidth, localHeight));

		Widget child = widget.GetChildren();
		while (child) {
			CaptureNode(child, phase);
			child = child.GetSibling();
		}
	}
}

modded class MissionGameplay {
	protected ref NIHNativeAspectRuntimeProbe m_NIH_NativeAspectProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_NativeAspectProbe = new NIHNativeAspectRuntimeProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHStartNativeAspectProbe, 250, false);
	}

	protected void NIHStartNativeAspectProbe() {
		if (m_NIH_NativeAspectProbe)
			m_NIH_NativeAspectProbe.Start();
	}
}
