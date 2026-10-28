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
