import { test, expect } from "./test";

import { mockScheduleCatalog } from "./schedule-catalog-http";

test("public home works without API and offers honest public paths", async ({
  page,
}) => {
  await page.route("**/api/**", (r) => r.abort());
  await mockScheduleCatalog(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Вся университетская жизнь в одном месте",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Я / })).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Продолжить как студент" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("link", { name: "Продолжить как сотрудник" }),
  ).toHaveAttribute("href", "/login");
  await page
    .getByRole("link", { name: "Расписание без входа", exact: true })
    .click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "Все расписания" })).toBeVisible();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await page.getByRole("link", { name: "Связаться с нами", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Контакты и помощь" })).toBeVisible();
  await expect(page.getByText("Демонстрационные контакты прототипа", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await page.getByRole("link", { name: "О разделе поступления" }).click();
  await expect(page).toHaveURL(/applicants/);
  await expect(
    page.getByRole("heading", { name: "Будущим студентам" }),
  ).toBeVisible();
  await expect(
    page.getByText("Подача заявлений здесь не выполняется", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
for (const width of [360, 390, 768, 1024, 1280, 1440])
  test(`public home layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/**", (r) => r.abort());
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const cards = page.locator(".role-card");
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll((items) =>
      items.map((item) => {
        const r = item.getBoundingClientRect();
        return { x: r.x, y: r.y, height: r.height };
      }),
    );
    if (width >= 768) {
      expect(boxes[0].y).toBe(boxes[1].y);
      expect(Math.abs(boxes[0].height - boxes[2].height)).toBeLessThan(1);
    } else {
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/public-home-${width}.png`,
      fullPage: true,
    });
  });

test("public information supports keyboard and both entry cards reach login", async ({
  page,
}) => {
  await page.route("**/api/**", (r) => r.abort());
  await mockScheduleCatalog(page);
  await page.goto("/");
  const schedule = page.getByRole("link", {
    name: "Расписание",
    exact: true,
  });
  await schedule.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "Все расписания" })).toBeFocused();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await page.getByRole("link", { name: "Продолжить как студент" }).click();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Вход для студента" }),
  ).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Продолжить как сотрудник" }).click();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole("heading", { name: "Вход для сотрудника" })).toBeVisible();
});
