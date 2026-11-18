import { test, expect, type Page } from "./test";
import { mockPerformance } from "./performance-http";
import {
  summarize,
  formatDate,
  type Discipline,
} from "../src/modules/academic-performance/model";
const url = "/student/academic-performance";
async function student(page: Page) {
  await mockPerformance(page);
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "demo",
        studentId: "demo",
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Александр",
        roles: ["Student"],
        areas: ["student"],
        permissions: [],
      },
    }),
  );
}
test("summary uses numerical finals and explicit debts", () => {
  const d = {
    id: "x",
    name: "x",
    assessment: "exam",
    grades: [],
    final: { kind: "grade", value: 2 },
    status: "debt",
    debt: { reason: "test" },
    examDate: null,
  } as Discipline;
  expect(
    summarize([
      d,
      {
        ...d,
        id: "y",
        final: { kind: "grade", value: 5 },
        status: "passed",
        debt: null,
      },
      {
        ...d,
        id: "z",
        final: { kind: "credit" },
        status: "passed",
        debt: null,
      },
    ]),
  ).toEqual({ average: 3.5, passed: 2, debts: 1 });
  expect(summarize([]).average).toBeNull();
  expect(formatDate("2027-01-20")).toBe("20 января 2027 г.");
});
test("overview, all results, filter, discipline, back, refresh and semester", async ({
  page,
}) => {
  await student(page);
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Успеваемость", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Все результаты", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Все результаты", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Все результаты", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Фильтр результатов").selectOption("debt");
  await expect(
    page.getByRole("link", {
      name: "Открыть дисциплину: Базы данных",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("link", {
      name: "Открыть дисциплину: Компьютерные сети",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Компьютерные сети", exact: true }),
  ).toBeFocused();
  await expect(page.getByText(/Требуется пересдача/)).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Фильтр результатов")).toHaveValue("debt");
  await page.getByLabel("Фильтр результатов").selectOption("all");
  await page
    .getByRole("link", { name: "Открыть дисциплину: Базы данных", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Базы данных", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Елена Орлова")).toBeVisible();
  await expect(page.getByText("Практическая работа")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Елена Орлова")).toBeVisible();
  await page.getByRole("link", { name: "Вернуться к успеваемости" }).click();
  await expect(
    page.getByRole("heading", { name: "Успеваемость", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Семестр", { exact: true }).selectOption("2027-spring");
  await expect(
    page.getByRole("heading", { name: "Дисциплин пока нет" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Все результаты", exact: true }),
  ).toBeVisible();
});
test("session items open discipline, empty grades and unknown records", async ({
  page,
}) => {
  await student(page);
  await page.goto(url);
  await page
    .locator(".academic-session")
    .getByRole("link", { name: /Программирование/ })
    .click();
  await expect(page.getByText("Текущих оценок пока нет.")).toBeVisible();
  await expect(
    page.getByText("20 января 2027 г.", { exact: true }),
  ).toBeVisible();
  await page.goto(url + "?discipline=missing");
  await expect(
    page.getByRole("heading", { name: "Дисциплина не найдена" }),
  ).toBeVisible();
  await page.goto(url + "?semester=missing");
  await expect(
    page.getByRole("heading", { name: "Семестр не найден" }),
  ).toBeVisible();
});
test("loading, error retry and stale response", async ({ page }) => {
  const fixture = "/tests/fixtures/performance.html";
  await page.goto(fixture + "?mode=slow");
  await expect(page.getByRole("status")).toContainText(
    "Загружаем успеваемость",
  );
  await expect(
    page.getByRole("link", { name: "Все результаты", exact: true }),
  ).toBeVisible();
  await page.goto(fixture + "?mode=retry");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(
    page.getByRole("link", { name: "Все результаты", exact: true }),
  ).toBeVisible();
  await page.goto(fixture + "?mode=race");
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByLabel("Семестр", { exact: true }).selectOption("2026-spring");
  await expect(
    page.getByRole("link", { name: /Открыть дисциплину: История/ }),
  ).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(
    page.getByRole("link", { name: /Открыть дисциплину: Базы данных/ }),
  ).toHaveCount(0);
});
test("unauthenticated and staff-only access", async ({ page }) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401, json: { status: 401 } }),
  );
  await page.goto(url);
  await expect(page).toHaveURL(/login/);
  await page.unroute("**/api/identity/session");
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "s",
        studentId: null,
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Staff",
        roles: ["Staff"],
        areas: ["staff"],
        permissions: [],
      },
    }),
  );
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Нет доступа" }),
  ).toBeVisible();
});
test("three views at six widths, keyboard, large text and no runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await student(page);
  for (const width of [360, 390, 768, 1024, 1280, 1672]) {
    for (const [name, query] of [
      ["overview", ""],
      ["results", "?view=results"],
      ["discipline", "?discipline=databases"],
    ]) {
      await page.setViewportSize({ width, height: 941 });
      await page.goto(url + query);
      await expect(
        page.locator(".academic-table,.academic-attestation").first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: "test-results/reference-" + name + "-" + width + ".png",
        fullPage: true,
      });
    }
  }
  await page.getByLabel("Семестр", { exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html {font-size:200%}" });
  await page.setViewportSize({ width: 720, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
