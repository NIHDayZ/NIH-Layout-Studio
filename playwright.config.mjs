import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/browser",
	testMatch: "**/*.spec.mjs",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["list"],["html",{open:"never",outputFolder:"playwright-report"}]] : "list",
	timeout: 30000,
	use: {
		...devices["Desktop Chrome"],
		baseURL: "http://127.0.0.1:5173",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		acceptDownloads: true
	},
	webServer: {
		command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
		url: "http://127.0.0.1:5173",
		reuseExistingServer: !process.env.CI,
		timeout: 60000
	}
});
