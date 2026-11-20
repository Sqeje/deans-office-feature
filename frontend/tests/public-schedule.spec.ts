import { test, expect } from "./test";
import { mockScheduleCatalog } from "./schedule-catalog-http";

for (const width of [360, 390, 768, 1024, 1280, 1440]) {
  test(`public schedule navigation and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/**", route => route.abort());
    await mockScheduleCatalog(page);
    await page.clock.install({ time: new Date("2026-11-11T09:30:00Z") });
    const protectedRequests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/schedule/") && !request.url().includes("/api/schedule/catalog")) protectedRequests.push(request.url());
    });
    await page.goto("/schedule");
    await expect(page.getByRole("heading", { name: "Все расписания" })).toBeVisible();
    await expect(page.getByText("Общий каталог расписаний университета", { exact: false })).toBeVisible();
    await page.screenshot({ path: `test-results/public-schedule-catalog-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "ПИ-21", exact: true }).click();
    await expect(page).toHaveURL(/\/schedule\/groups\/pi-21$/);
    await expect(page.getByRole("heading", { name: "Расписание группы ПИ-21" })).toBeVisible();
    await page.getByRole("button", { name: "Неделя", exact: true }).click();
    await expect(page.locator(".schedule-day-table")).toHaveCount(7);
    await expect(page.locator(".schedule-row").first()).toBeVisible();
    await page.screenshot({ path: `test-results/public-schedule-week-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("button", { name: "Неделя", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.locator(".schedule-teacher-link").first().click();
    await page.getByRole("link", { name: "Посмотреть расписание →" }).click();
    await expect(page).toHaveURL(/\/schedule\/teachers\//);
    await expect(page.locator(".schedule-day-table")).toHaveCount(7);
    await page.getByRole("link", { name: /^Группа / }).first().click();
    await expect(page).toHaveURL(/\/schedule\/groups\//);
    await page.getByRole("button", { name: "Контрольные и экзамены", exact: true }).click();
    await expect(page.locator(".schedule-assessment-kind").first()).toBeVisible();
    await page.getByRole("link", { name: "Все расписания", exact: true }).click();
    await page.getByLabel("Поиск преподавателя").fill("Орлова");
    await expect(page.locator(".schedule-search li")).toHaveCount(1);
    await page.getByRole("link", { name: "Мария Павловна Орлова", exact: true }).click();
    await page.getByRole("link", { name: "← К поиску преподавателя" }).click();
    await expect(page.getByLabel("Поиск преподавателя")).toHaveValue("Орлова");
    await page.reload();
    await expect(page.getByLabel("Поиск преподавателя")).toHaveValue("Орлова");
    await page.getByLabel("Поиск преподавателя").fill("НетТакогоПреподавателя");
    await expect(page.getByText("Преподаватели не найдены.")).toBeVisible();
    await page.getByRole("link", { name: "На главную", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Расписание", exact: true }).click();
    await page.getByRole("link", { name: "Деканат", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(protectedRequests).toEqual([]);
  });
}

test("invalid public schedule keeps catalog and home navigation", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await mockScheduleCatalog(page);
  for (const path of ["/schedule/groups/missing", "/schedule/teachers/missing", "/schedule/missing"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Расписание не найдено" })).toBeVisible();
    await page.getByRole("link", { name: "Открыть каталог", exact: true }).click();
    await expect(page).toHaveURL(/\/schedule$/);
  }
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("teacher can open all schedules without a grades permission", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await page.route("**/api/identity/session", route => route.fulfill({ json: {
    userId: "schedule-only-teacher", universityId: "demo", displayName: "Преподаватель",
    roles: ["Staff", "Teacher"], permissions: [{ permission: "schedule.write", groupId: "pi-21" }], areas: ["staff"],
  } }));
  await mockScheduleCatalog(page);
  await page.goto("/staff/schedule/catalog");
  await expect(page.getByRole("heading", { name: "Все расписания", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Редактировать расписание", exact: true })).toBeVisible();
});
