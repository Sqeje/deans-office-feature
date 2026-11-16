import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 360, height: 800 },
    launchOptions: {
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
      // Minimal Linux images default to an ASCII locale; Chromium then replaces
      // Cyrillic download names with "download", even with a valid download attribute.
      ...(process.platform === "linux" ? { env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } } : {}),
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
