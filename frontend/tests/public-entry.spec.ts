import { test, expect } from "@playwright/test";

const prototypeNotice = "Конкурсный концепт, не официальный сайт";

for (const account of [
  { login: "student1@demo.invalid", password: "DEMO_PASSWORD1", name: "Алексей Примеров", area: "student", card: "сотрудник" },
  { login: "student2@demo.invalid", password: "DEMO_PASSWORD2", name: "Мария Образцова", area: "student", card: "студент" },
  { login: "staff@demo.invalid", password: "DEMO_STAFF_PASSWORD", name: "", area: "staff", card: "студент" },
] as const) {
  test(`welcome to real personal home: ${account.login}`, async ({ page }) => {
    const password = process.env[account.password];
    if (!password) throw new Error(`Set ${account.password}`);
    await page.goto("/");
    await expect(page.getByText(prototypeNotice, { exact: true })).toBeVisible();
    await expect(page.getByText("Расписание, оценки и обращения в деканат", { exact: true })).toBeVisible();
    // Deliberately use another audience card: only the server session grants access.
    await page.getByRole("link", { name: `Продолжить как ${account.card}` }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(prototypeNotice, { exact: true })).toBeVisible();
    await page.getByLabel("Электронная почта").fill(account.login);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${account.area}$`));
    if (account.name) {
      await expect(page.getByRole("heading", { name: `Здравствуйте, ${account.name}` })).toBeVisible();
      await expect(page.getByText("Демонстрационные данные — не связаны", { exact: false })).toBeVisible();
    } else {
      await expect(page.getByText("РАБОЧЕЕ МЕСТО СОТРУДНИКА")).toBeVisible();
    }
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/${account.area}$`));
    await expect(page.getByRole("button", { name: "Меню профиля" })).toBeVisible();
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await page.getByRole("button", { name: "Выйти", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/identity/session")).status()).toBe(401);
    await page.goto(`/${account.area}`);
    await expect(page).toHaveURL(/\/login/);
  });
}

for (const width of [360, 1280]) {
  test(`applicants stay public without API at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/**", route => route.abort());
    await page.goto("/applicants");
    await expect(page.getByRole("heading", { name: "Будущим студентам" })).toBeVisible();
    await expect(page.getByText("Подача заявлений", { exact: false })).toBeVisible();
    await expect(page.getByText(prototypeNotice, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Будущим студентам" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/applicants-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "На главную", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Вся университетская жизнь в одном месте" })).toBeVisible();
  });
}
