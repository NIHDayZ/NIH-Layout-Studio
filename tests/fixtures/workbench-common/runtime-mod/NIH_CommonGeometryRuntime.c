/**
 * TEST-ONLY native geometry capture for the shared NIH Layout Studio engine.
 *
 * This probe walks the actual widget hierarchy rather than maintaining a
 * per-class or per-widget-name list. Logs native screen-space rectangles,
 * local getter geometry, type and visibility at two controlled root sizes.
 * It does not measure the native clip/scissor or DPI context.
 */
class NIHCommonGeometryRuntimeProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_CommonGeometryProbe/gui/layouts/NIH_Common_Geometry_Parity.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][CommonProbe] ERROR: layout resource unavailable");
			return;
		}

		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 700, false, 1120.0, 460.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 1200, false, "viewport-1120x460");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 2300, false, 1440.0, 900.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 2800, false, "viewport-1440x900");
	}

	void ApplyViewport(float width, float height) {
		if (!m_Root)
			return;

		// Explicit physical dimensions bypass assumptions about GetSize's
		// exact/relative flag interpretation, but are runtime-only edits.
		m_Root.SetScreenPos(0, 0);
		m_Root.SetScreenSize(width, height);
		m_Root.Update();
		Print(string.Format("[NIH_LayoutStudio][CommonProbe] REQUEST viewport=%1,%2", width, height));
	}

	void CaptureAll(string phase) {
		if (!m_Root)
			return;

		Print("[NIH_LayoutStudio][CommonProbe] BEGIN " + phase);
		CaptureNode(m_Root, phase);
		Print("[NIH_LayoutStudio][CommonProbe] END " + phase);
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

		Print(string.Format("[NIH_LayoutStudio][CommonProbe] phase=%1 name=%2 type=%3 screenRect=%4,%5,%6,%7",
			phase, widget.GetName(), widget.GetTypeName(),
			screenX, screenY, screenWidth, screenHeight));
		Print(string.Format("[NIH_LayoutStudio][CommonProbe] phase=%1 name=%2 localRect=%3,%4,%5,%6 visibleSelf=%7 visibleHierarchy=%8",
			phase, widget.GetName(), localX, localY, localWidth, localHeight,
			widget.IsVisible(), widget.IsVisibleHierarchy()));

		Widget child = widget.GetChildren();
		while (child) {
			CaptureNode(child, phase);
			child = child.GetSibling();
		}
	}
}

modded class MissionGameplay {
	protected ref NIHCommonGeometryRuntimeProbe m_NIH_CommonGeometryProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_CommonGeometryProbe = new NIHCommonGeometryRuntimeProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHStartCommonGeometryProbe, 250, false);
	}

	protected void NIHStartCommonGeometryProbe() {
		if (m_NIH_CommonGeometryProbe)
			m_NIH_CommonGeometryProbe.Start();
	}
}
