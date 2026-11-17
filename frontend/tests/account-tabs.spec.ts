import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string | undefined) {
  if (!password) throw new Error("Set demo passwords");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(email.startsWith("staff") ? /\/staff$/ : /\/student$/);
}
for (const broadcast of [true, false]) test(`switching accounts invalidates the old tab, broadcast=${broadcast}`, async ({ context }, testInfo) => {
  if (!broadcast) await context.addInitScript(() => { Object.defineProperty(window, "BroadcastChannel", { value: undefined }); });
  const first = await context.newPage(), second = await context.newPage();
  await first.goto("/login");
  await login(first, broadcast ? "student1@demo.invalid" : "staff@demo.invalid", broadcast ? process.env.DEMO_PASSWORD1 : process.env.DEMO_STAFF_PASSWORD);
  const previous = await (await context.request.get("/api/identity/session")).json();
  if (!broadcast) {
    await first.goto("/staff/schedule/edit");
    await first.getByRole("button", { name: "Изменить занятие", exact: true }).first().click();
    await first.getByLabel("Аудитория", { exact: true }).fill("999");
  }
  if (broadcast) {
    await second.goto("/student");
    await second.getByRole("button", { name: "Меню профиля" }).click();
    await expect(second.getByRole("link", { name: "Сменить учётную запись", exact: true })).toHaveCount(0);
    await second.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(second.getByRole("heading", { name: "Вход в кабинет", exact: true })).toBeVisible();
    await login(second, "student2@demo.invalid", process.env.DEMO_PASSWORD2);
  } else {
    // A replacement cookie from an external login must also invalidate a stale
    // editor, even without a channel message or an account-switching UI.
    const csrf = await (await context.request.get("/api/identity/csrf")).json();
    expect((await context.request.post("/api/identity/login", { headers: { "X-CSRF-TOKEN": csrf.token }, data: {
      email: "student2@demo.invalid", password: process.env.DEMO_PASSWORD2,
    } })).status()).toBe(204);
    await second.goto("/student");
    await expect(second.getByRole("heading", { name: "Здравствуйте, Мария Образцова", exact: true })).toBeVisible();
  }
  const current = await (await context.request.get("/api/identity/session")).json();
  expect(current.userId).not.toBe(previous.userId);
  // Even if a background tab misses the channel event, its bound requests cannot
  // read the new account or terminate its session.
  const stale = { "X-Dean-Account": previous.userId };
  const denied = await context.request.get("/api/identity/session", { headers: stale });
  expect(denied.status()).toBe(401); expect(await denied.json()).toMatchObject({ code: "account_changed" });
  const csrf = await (await context.request.get("/api/identity/csrf")).json();
  expect((await context.request.post("/api/identity/logout", { headers: { ...stale, "X-CSRF-TOKEN": csrf.token } })).status()).toBe(401);
  if (!broadcast) await first.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(first).toHaveURL(/\/login$/);
  await expect(first.getByRole("status")).toContainText("Учётная запись в другой вкладке изменена");
  await expect(first.getByRole("form", { name: "Изменение занятия" })).toHaveCount(0);
  await first.reload();
  await expect(first.getByRole("heading", { name: "Вход в кабинет", exact: true })).toBeVisible();
  await first.goto("/student/profile");
  await expect(first).toHaveURL(/\/login$/);
  await first.screenshot({ path: testInfo.outputPath("old-tab-login.png"), fullPage: true });
  await second.reload();
  await expect(second.getByRole("heading", { name: "Здравствуйте, Мария Образцова", exact: true })).toBeVisible();
  expect((await (await context.request.get("/api/identity/session")).json()).userId).toBe(current.userId);
  // Explicit reauthentication, not navigation/reload, unlocks the old tab.
  await login(first, "student1@demo.invalid", process.env.DEMO_PASSWORD1);
  if (!broadcast) await second.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(second).toHaveURL(/\/login$/);
  await expect(first.getByRole("heading", { name: "Здравствуйте, Алексей Примеров", exact: true })).toBeVisible();
});

test("same-account tabs remain valid; logout clears the other tab", async ({ context }) => {
  const first = await context.newPage(), second = await context.newPage();
  await first.goto("/login"); await login(first, "student1@demo.invalid", process.env.DEMO_PASSWORD1);
  await second.goto("/student");
  await second.getByRole("button", { name: "Меню профиля" }).click();
  await expect(second.getByRole("link", { name: "Сменить учётную запись", exact: true })).toHaveCount(0);
  await second.getByRole("button", { name: "Меню профиля" }).click();
  await first.reload();
  await expect(first.getByRole("heading", { name: "Здравствуйте, Алексей Примеров", exact: true })).toBeVisible();
  await second.getByRole("button", { name: "Меню профиля" }).click();
  await second.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(first).toHaveURL(/\/login$/);
  expect((await context.request.get("/api/identity/session")).status()).toBe(401);
});
