import { test, expect } from "./test";
import { mockPerformance } from "./performance-http";

// Explicit HTTP fixtures exercise failure states only; real authentication is in identity.spec.ts.
for (const path of ["/student/profile", "/student/academic-performance"]) {
  test(`logout failure preserves cabinet and allows one pending retry: ${path}`, async ({ page }) => {
    await mockPerformance(page);
    let authenticated = true;
    await page.route("**/api/identity/session", r => r.fulfill(authenticated ? { json: {
      userId: "test", studentId: "test", universityId: "10000000-0000-0000-0000-000000000001",
      displayName: "Тестовый Студент", roles: ["Student"], areas: ["student"], permissions: [],
    }} : { status: 401 }));
    await page.route("**/api/identity/me", r => r.fulfill({ json: {
      id: "test", fullName: "Тестовый Студент", email: "test@demo.invalid",
      universityId: "10000000-0000-0000-0000-000000000001", university: "Тестовый университет", group: "Тест-01",
    }}));
    await page.route("**/api/identity/csrf", r => r.fulfill({ json: { token: "test-only" }}));
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/identity/logout", async r => {
      calls++;
      if (calls === 1) { await r.abort(); return; }
      await gate;
      authenticated = false;
      await r.fulfill({ status: 204 });
    });
    await page.goto(path);
    await page.getByLabel("Меню профиля").click();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Не удалось выйти");
    await expect(page.getByRole("navigation", { name: "Разделы" })).toBeVisible();
    await page.screenshot({ path: `test-results/identity-logout-error-${path.endsWith("profile") ? "profile" : "performance"}.png`, fullPage: true });
    await expect(page).toHaveURL(new RegExp(path + "$"));
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page.getByRole("button", { name: "Выходим…" })).toBeDisabled();
    await expect.poll(() => calls).toBe(2);
    release();
    await expect(page).toHaveURL(/login/);
    await page.goto(path);
    await expect(page).toHaveURL(/login/);
  });
}

for (const width of [360, 390, 768, 1024, 1280, 1440]) {
  test(`profile long text and keyboard layout ${width}`, async ({ page }) => {
    const name = "Александр Константинович Демонстрационный-Примеров";
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/identity/session", r => r.fulfill({ json: {
      userId: "test", studentId: "test", universityId: "10000000-0000-0000-0000-000000000001",
      displayName: name, roles: ["Student"], areas: ["student"], permissions: [],
    }}));
    await page.route("**/api/identity/me", r => r.fulfill({ json: {
      id: "test", fullName: name, email: "long-student-name@demo.invalid",
      universityId: "10000000-0000-0000-0000-000000000001", university: "Демонстрационный университет международного сотрудничества", group: "Демонстрационная-группа-2026",
    }}));
    await page.goto("/student/profile");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByLabel("Меню профиля").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Выйти", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Меню профиля")).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({ path: `test-results/identity-profile-long-${width}.png`, fullPage: true });
    if (width === 1280) {
      // 200% text enlargement, in addition to the narrow viewport checks.
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: "test-results/identity-profile-large-text.png", fullPage: true });
    }
  });
}
