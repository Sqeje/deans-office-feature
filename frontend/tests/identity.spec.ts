import { test, expect } from "@playwright/test";

test("stale anonymous refresh cannot overwrite a completed login", async ({
  page,
}) => {
  const password = process.env.DEMO_PASSWORD1;
  if (!password) throw new Error("Set DEMO_PASSWORD1");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/identity/session", async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    await gate;
    await route.fulfill({
      status: 401,
      contentType: "application/problem+json",
      body: '{"status":401,"code":"authentication_required"}',
    });
  });
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("student1@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Здравствуйте, Алексей Примеров" }),
  ).toBeVisible();
  const staleResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/identity/session") && r.status() === 401,
  );
  release();
  await staleResponse;
  await expect(
    page.getByRole("heading", { name: "Здравствуйте, Алексей Примеров" }),
  ).toBeVisible();
  await page.route("**/api/identity/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/problem+json",
      body: '{"status":401}',
    }),
  );
  await page.goto("/student/profile");
  await expect(page).toHaveURL(/login/);
});

test("two student profiles, mobile navigation and logout", async ({
  browser,
}) => {
  for (const [number, name] of [
    [1, "Алексей Примеров"],
    [2, "Мария Образцова"],
  ] as const) {
    const password = process.env[`DEMO_PASSWORD${number}`];
    if (!password)
      throw new Error(`Set DEMO_PASSWORD${number} to the seeded password`);
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("http://localhost:5173/app/profile");
    await expect(page).toHaveURL(/login/);
    await page
      .getByLabel("Электронная почта")
      .fill(`student${number}@demo.invalid`);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `Здравствуйте, ${name}` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await page.getByRole("link", { name: "Профиль", exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.goto("http://localhost:5173/app/profile");
    await expect(page).toHaveURL(/student\/profile/);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.goto("http://localhost:5173/staff");
    await expect(
      page.getByRole("heading", { name: "Нет доступа" }),
    ).toBeVisible();
    await page.goto("http://localhost:5173/student/profile");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/profile-${number}-360.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Расписание", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Расписание", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await page
      .getByRole("button", { name: "Выйти", exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/login/);
    await context.close();
  }
});

test("staff has a separate mobile workspace and applicants stay public", async ({
  page,
}) => {
  const password = process.env.DEMO_STAFF_PASSWORD;
  if (!password) throw new Error("Set DEMO_STAFF_PASSWORD");
  await page.goto("/applicants");
  await expect(
    page.getByRole("heading", { name: "Будущим студентам" }),
  ).toBeVisible();
  await page.goto("/staff");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Электронная почта").fill("staff@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/staff/);
  await expect(page.getByText("РАБОЧЕЕ МЕСТО СОТРУДНИКА")).toBeVisible();
  await expect(
    page.getByText("Изменение расписания — Назначенная группа"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Расписание", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/staff-360.png", fullPage: true });
  await page.goto("/student/profile");
  await expect(
    page.getByRole("heading", { name: "Нет доступа" }),
  ).toBeVisible();
  await page.goto("/staff");
  await page.getByRole("button", { name: "Меню профиля" }).click();
  await page
    .getByRole("button", { name: "Выйти", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/login/);
});

test("real accounts can switch in one browser and logout closes API and cabinet", async ({ page }) => {
  for (const [number, name] of [[1, "Алексей Примеров"], [2, "Мария Образцова"]] as const) {
    const password = process.env[`DEMO_PASSWORD${number}`];
    if (!password) throw new Error(`Set DEMO_PASSWORD${number}`);
    await page.goto("/student/profile");
    await expect(page).toHaveURL(/login/);
    await page.getByLabel("Электронная почта").fill(`student${number}@demo.invalid`);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByLabel("Пароль", { exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: `Здравствуйте, ${name}` })).toBeVisible();
    await page.goto("/student/profile");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText(`student${number}@demo.invalid`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    if (number === 2) await expect(page.getByText("Алексей Примеров", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `test-results/identity-real-profile-${number}-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByLabel("Меню профиля").click();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL(/login/);
    expect((await page.request.get("/api/identity/session")).status()).toBe(401);
    expect((await page.request.get("/api/identity/me")).status()).toBe(401);
    await page.goto("/student/profile");
    await expect(page).toHaveURL(/login/);
  }
});
