import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  // Live scenarios open several contexts; keep the Docker check within its CPU budget.
  workers: 2,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 360, height: 800 },
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
