import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const Fixture = (name) => fileURLToPath(new URL(
	`../fixtures/workbench-content/syntax-matrix/${name}.layout`, import.meta.url
));

async function OpenFixture(page, name) {
	const path=Fixture(name);
	const source=await readFile(path,"utf8");
	await page.goto("/");
	await page.locator('input[accept=".layout,text/plain"]').setInputFiles(path);
	await expect(page.locator(".source-pane textarea")).toHaveValue(source);
	return source;
}

async function OpenExportAs(page) {
	await page.locator("details.toolbar-menu").first().locator("summary").click();
	await page.getByRole("button",{name:"Export As…"}).click();
}

async function ConfirmDownload(page, buttonName) {
	const downloadPromise=page.waitForEvent("download");
	await page.getByRole("button",{name:buttonName}).click();
	const download=await downloadPromise;
	const bytes=await readFile(await download.path());
	return {download,bytes};
}

test("safe Frame control exports byte-identical source without review",async ({page})=>{
	const source=await OpenFixture(page,"FrameBase");
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".native-compatibility-entry")).toHaveCount(0);
	const downloadPromise=page.waitForEvent("download");
	await OpenExportAs(page);
	const download=await downloadPromise;
	await expect(page.getByRole("dialog",{name:"Native compatibility review"})).toHaveCount(0);
	expect((await readFile(await download.path())).toString("utf8")).toBe(source);
});

test("native child-loss warning is visible and Cancel prevents export, Continue preserves original bytes",async ({page})=>{
	const source=await OpenFixture(page,"FrameContentBefore0");
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".native-compatibility-entry")).toHaveCount(1);
	await expect(page.locator(".native-compatibility-entry")).toContainText("FrameContentBefore0");
	await expect(page.locator(".native-compatibility-entry")).toContainText("Size To Content V");
	await OpenExportAs(page);
	const review=page.getByRole("dialog",{name:"Native compatibility review"});
	await expect(review).toBeVisible();
	await review.getByRole("button",{name:"Cancel"}).click();
	await expect(review).toHaveCount(0);
	// The PROBLEMS tab is still selected. Return to SOURCE before inspecting
	// its textarea; this does not edit or refresh the underlying layout.
	await page.getByRole("button",{name:"SOURCE",exact:true}).click();
	await expect(page.locator(".source-pane textarea")).toHaveValue(source);
	await OpenExportAs(page);
	const saved=await ConfirmDownload(page,"Continue Export");
	expect(saved.bytes.toString("utf8")).toBe(source);
	expect(saved.download.suggestedFilename()).toBe("FrameContentBefore0.layout");
});

test("native-safe after-child property exports without a warning or reordering",async ({page})=>{
	const source=await OpenFixture(page,"FrameContentAfter0");
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".native-compatibility-entry")).toHaveCount(0);
	const downloadPromise=page.waitForEvent("download");
	await OpenExportAs(page);
	const download=await downloadPromise;
	await expect(page.getByRole("dialog",{name:"Native compatibility review"})).toHaveCount(0);
	const exported=(await readFile(await download.path())).toString("utf8");
	expect(exported).toBe(source);
	expect(exported.indexOf("FrameContentAfter0_Bottom")).toBeLessThan(exported.indexOf('"Size To Content V" 0'));
});

test("live source edits clear obsolete warnings without refreshing Canvas, and clean export remains byte-identical",async ({page})=>{
	const original=await OpenFixture(page,"FrameContentBefore0");
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".native-compatibility-entry")).toHaveCount(1);
	await page.getByRole("button",{name:"SOURCE",exact:true}).click();
	const revised=original.replace('"Size To Content V" 0',"clipchildren 1");
	expect(revised).not.toBe(original);
	await page.locator(".source-pane textarea").fill(revised);
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".native-compatibility-entry")).toHaveCount(0);
	const downloadPromise=page.waitForEvent("download");
	await OpenExportAs(page);
	const download=await downloadPromise;
	expect((await readFile(await download.path())).toString("utf8")).toBe(revised);
});

test("Ctrl+S works with SOURCE textarea focused and goes through the warning review",async ({page})=>{
	const source=await OpenFixture(page,"PanelContentBefore0");
	await page.locator(".source-pane textarea").focus();
	await page.keyboard.press("Control+s");
	const review=page.getByRole("dialog",{name:"Native compatibility review"});
	await expect(review).toBeVisible();
	const saved=await ConfirmDownload(page,"Continue Export");
	expect(saved.bytes.toString("utf8")).toBe(source);
});


test("format normalization and native compatibility warnings remain independent in the PROBLEMS tab",async ({page})=>{
	const original=await OpenFixture(page,"FrameContentBefore0");
	await page.locator(".source-pane textarea").fill(original.replace("size 190 20","size 190 20 visible 1"));
	await page.getByRole("button",{name:/^PROBLEMS/}).click();
	await expect(page.locator(".problem-row").filter({hasText:"Multiple properties on one line"})).toHaveCount(1);
	await expect(page.locator(".native-compatibility-entry.warning")).toHaveCount(1);
	await page.getByRole("button",{name:"Normalize All"}).click();
	await expect(page.locator(".problem-row.format")).toHaveCount(0);
	await expect(page.locator(".native-compatibility-entry.warning")).toHaveCount(1);
	await page.getByRole("button",{name:"SOURCE",exact:true}).click();
	const normalized=await page.locator(".source-pane textarea").inputValue();
	expect(normalized).toContain('"Size To Content V" 0');
	expect(normalized).toContain("size 190 20");
	expect(normalized).toContain("visible 1");
});


test("unresolved large-nominal fonts render legible sized CSS in a short widget without modifying authored source",async ({page})=>{
	const layout=[
		"FrameWidgetClass Root {",
		" position 0 0",
		" size 1 1",
		" hexactpos 1",
		" vexactpos 1",
		" {",
		"  TextWidgetClass SmallMissingFont {",
		"   position 30 30",
		"   size 300 12",
		"   hexactpos 1",
		"   vexactpos 1",
		"   hexactsize 1",
		"   vexactsize 1",
		'   font "gui/fonts/sdf_MetronBook72"',
		'   text "FONTTEST"',
		"  }",
		" }",
		"}"
	].join("\n");
	await page.goto("/");
	await page.locator('input[accept=".layout,text/plain"]').setInputFiles({
		name:"unresolved-font-control.layout",
		mimeType:"text/plain",
		buffer:Buffer.from(layout,"utf8")
	});
	await expect(page.locator(".source-pane textarea")).toHaveValue(layout);
	const text=page.locator(".canvas .widget-text").filter({hasText:"FONTTEST"}).first();
	await expect(text).toBeVisible();
	const computedSize=await text.evaluate((element)=>parseFloat(getComputedStyle(element).fontSize));
	expect(computedSize).toBeGreaterThanOrEqual(9);
	expect(computedSize).toBeLessThanOrEqual(12);
	await expect(page.locator(".source-pane textarea")).toHaveValue(layout);
});
