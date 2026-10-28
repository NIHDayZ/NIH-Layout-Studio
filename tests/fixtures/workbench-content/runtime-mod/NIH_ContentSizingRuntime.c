/**
 * Disposable client-only native size-to-text / size-to-content capture.
 * Independently log native widget rectangles and text pixel metrics.
 * Do not deploy with other NIH test probes or any production mod.
 */
class NIHContentSizingRuntimeProbe {
	protected Widget m_Root;

	void Start() {
		if (g_Game.IsDedicatedServer())
			return;

		m_Root = g_Game.GetWorkspace().CreateWidgets("NIH_ContentSizingProbe/gui/layouts/NIH_ContentSizing_Parity.layout");
		if (!m_Root) {
			Print("[NIH_LayoutStudio][ContentProbe] ERROR: layout resource unavailable");
			return;
		}

		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 700, false, 1120.0, 460.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 1200, false, "baseline-1120x460");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(SetSampleText, 2300, false, "X");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 2800, false, "short-text-1120x460");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(SetSampleText, 3800, false, "TEST 0123456789");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 4300, false, "restored-1120x460");
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(ApplyViewport, 5300, false, 720.0, 460.0);
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(CaptureAll, 5800, false, "baseline-720x460");
	}

	void ApplyViewport(float width, float height) {
		if (!m_Root)
			return;

		m_Root.SetScreenPos(0, 0);
		m_Root.SetScreenSize(width, height);
		m_Root.Update();
		Print(string.Format("[NIH_LayoutStudio][ContentProbe] REQUEST viewport=%1,%2", width, height));
	}

	void SetSampleText(string value) {
		if (!m_Root)
			return;

		// Change the same text in multiple authored modes. Keep the other
		// text and all Image/Frame/Panel cases untouched as controls.
		SetOneText("TextFixed", value);
		SetOneText("TextToTextH", value);
		SetOneText("TextToTextV", value);
		SetOneText("TextToTextBoth", value);
		SetOneText("TextToContentBoth", value);
		m_Root.Update();
		Print("[NIH_LayoutStudio][ContentProbe] REQUEST sampleText=" + value);
	}

	protected void SetOneText(string name, string value) {
		TextWidget textWidget = TextWidget.Cast(m_Root.FindAnyWidget(name));
		if (textWidget)
			textWidget.SetText(value);
		else
			Print("[NIH_LayoutStudio][ContentProbe] ERROR: missing text widget " + name);
	}

	void CaptureAll(string phase) {
		if (!m_Root)
			return;

		m_Root.Update();
		Print("[NIH_LayoutStudio][ContentProbe] BEGIN " + phase);
		CaptureNode(m_Root, phase);
		Print("[NIH_LayoutStudio][ContentProbe] END " + phase);
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

		Print(string.Format("[NIH_LayoutStudio][ContentProbe] phase=%1 name=%2 type=%3 screenRect=%4,%5,%6,%7",
			phase, widget.GetName(), widget.GetTypeName(),
			screenX, screenY, screenWidth, screenHeight));
		Print(string.Format("[NIH_LayoutStudio][ContentProbe] phase=%1 name=%2 localRect=%3,%4,%5,%6 flags=%7 selfVisible=%8",
			phase, widget.GetName(), localX, localY, localWidth, localHeight,
			widget.GetFlags(), widget.IsVisible()));

		TextWidget textWidget = TextWidget.Cast(widget);
		if (textWidget) {
			int textWidth;
			int textHeight;
			textWidget.GetTextSize(textWidth, textHeight);
			Print(string.Format("[NIH_LayoutStudio][ContentProbe] phase=%1 name=%2 textPixels=%3,%4",
				phase, widget.GetName(), textWidth, textHeight));
		}

		Widget child = widget.GetChildren();
		while (child) {
			CaptureNode(child, phase);
			child = child.GetSibling();
		}
	}
}

modded class MissionGameplay {
	protected ref NIHContentSizingRuntimeProbe m_NIH_ContentSizingProbe;

	override void OnInit() {
		super.OnInit();
		if (g_Game.IsDedicatedServer())
			return;

		m_NIH_ContentSizingProbe = new NIHContentSizingRuntimeProbe();
		g_Game.GetCallQueue(CALL_CATEGORY_GUI).CallLater(NIHStartContentSizingProbe, 250, false);
	}

	protected void NIHStartContentSizingProbe() {
		if (m_NIH_ContentSizingProbe)
			m_NIH_ContentSizingProbe.Start();
	}
}
