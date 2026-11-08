import { test, expect, type Page } from "@playwright/test";
import { demoPerformance } from "../src/modules/academic-performance/demo";
import {
  formatDate,
  summarize,
} from "../src/modules/academic-performance/model";

const url = "/student/academic-performance";
const session = {
  userId: "demo-student",
  universityId: "10000000-0000-0000-0000-000000000001",
  displayName: "Демонстрационный студент",
  roles: ["Student"],
  studentId: "demo-student",
  permissions: [],
  areas: ["student"],
};
async function mockStudent(page: Page) {
  await page.route("**/api/identity/session", (route) =>
    route.fulfill({ json: session }),
  );
}

test("summary includes failing finals, excludes credits/pending and uses explicit debt", () => {
  const subjects = demoPerformance["2026-autumn"].disciplines;
  expect(summarize(subjects)).toEqual({ passed: 2, debts: 1, average: 3.5 });
  expect(summarize([]).average).toBeNull();
  expect(
    summarize(subjects.filter((d) => d.final?.kind !== "grade")).average,
  ).toBeNull();
  expect(subjects[0].grades.every((g) => g.value >= 4)).toBeTruthy();
  expect(summarize([subjects[0]]).debts).toBe(1);
});
test("calendar dates have the same label in different time zones", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["Pacific/Honolulu", "Asia/Tokyo", "Europe/Moscow"]) {
      process.env.TZ = zone;
      expect(formatDate("2027-01-18")).toBe("18 января 2027 г.");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("acceptance: semester, discipline, current grades, final, debt, exam; reload and back", async ({
  page,
}) => {
  await mockStudent(page);
  await page.goto(url);
  await expect(
    page.getByRole("combobox", { name: "Семестр", exact: true }),
  ).toHaveValue("2026-autumn");
  await expect(page.getByText("3,5 из 5", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Международное право/ }).click();
  const details = page.getByRole("region", { name: "Международное право" });
  await expect(
    details.getByRole("heading", { name: "Международное право" }),
  ).toBeFocused();
  await expect(details.getByLabel("Оценка 4")).toBeVisible();
  await expect(details.getByLabel("Оценка 5")).toBeVisible();
  await expect(details.locator("dd").filter({ hasText: /^2$/ })).toBeVisible();
  await expect(details.getByText(/Требуется пересдача/)).toBeVisible();
  await expect(details.getByText("18 января 2027 г.")).toBeVisible();
  await page.screenshot({
    path: "test-results/performance-debt-360.png",
    fullPage: true,
  });
  await expect(page).toHaveURL(
    /semester=2026-autumn&discipline=international-law/,
  );
  await page.reload();
  await expect(details).toBeVisible();
  await page
    .getByRole("combobox", { name: "Семестр", exact: true })
    .selectOption("2026-spring");
  await expect(
    page.getByRole("heading", { name: "Международное право" }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/discipline=/);
  await page.goBack();
  await expect(details).toBeVisible();
  await page.getByRole("link", { name: /Статистика/ }).click();
  await expect(page.getByText("Текущих оценок пока нет.")).toBeVisible();
  await expect(page.getByText("Задолженности нет")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Семестр", exact: true })
    .selectOption("2027-spring");
  await expect(
    page.getByRole("heading", { name: "Дисциплин пока нет" }),
  ).toBeVisible();
  await expect(
    page.getByText("Оценок пока нет", { exact: true }),
  ).toBeVisible();
});

test("unknown semester and discipline never substitute an unrelated record", async ({
  page,
}) => {
  await mockStudent(page);
  await page.goto(url + "?semester=2026-spring&discipline=international-law");
  await expect(
    page.getByRole("heading", { name: "Дисциплина не найдена" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Международное право" }),
  ).toHaveCount(0);
  await page.goto(url + "?semester=unknown");
  await expect(
    page.getByRole("heading", { name: "Семестр не найден" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Семестр", exact: true })
    .selectOption("2026-autumn");
  await expect(
    page.getByRole("link", { name: /Международное право/ }),
  ).toBeVisible();
});

test("loader: skeleton, retry, no grades and obsolete response", async ({
  page,
}) => {
  const fixture = "/tests/fixtures/performance.html";
  await page.goto(fixture + "?mode=slow");
  await expect(page.getByRole("status")).toContainText(
    "Загружаем успеваемость",
  );
  await expect(
    page.getByRole("link", { name: /Международное право/ }),
  ).toBeVisible();
  await page.goto(fixture + "?mode=retry");
  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(
    page.getByRole("link", { name: /Международное право/ }),
  ).toBeVisible();
  await page.goto(fixture + "?mode=no-grades");
  await expect(
    page.getByText("Оценок пока нет", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Предмет без оценок/ }).click();
  await expect(page.getByText("Дата пока не назначена")).toBeVisible();
  await page.goto(fixture + "?mode=race");
  await expect(page.getByRole("status")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Семестр", exact: true })
    .selectOption("2026-spring");
  await expect(
    page.getByRole("link", { name: /История международных отношений/ }),
  ).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(
    page.getByRole("link", { name: /Международное право/ }),
  ).toHaveCount(0);
});

test("anonymous and staff-only accounts cannot open the student screen", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (route) =>
    route.fulfill({ status: 401, json: { status: 401 } }),
  );
  await page.goto(url);
  await expect(page).toHaveURL(/login/);
  await page.unroute("**/api/identity/session");
  await page.route("**/api/identity/session", (route) =>
    route.fulfill({
      json: { ...session, roles: ["Staff"], studentId: null, areas: ["staff"] },
    }),
  );
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Нет доступа" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Семестр", exact: true }),
  ).toHaveCount(0);
});

test("desktop acceptance", async ({ page }) => {
  await mockStudent(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url + "?semester=2026-autumn&discipline=international-law");
  await expect(
    page.getByRole("region", { name: "Международное право" }),
  ).toContainText("Требуется пересдача");
  await expect(
    page.getByText("Конкурсный концепт, не официальный сайт"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/performance-debt-1280.png",
    fullPage: true,
  });
});

test("responsive snapshots, keyboard and reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockStudent(page);
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url + "?semester=2026-autumn&discipline=foreign-language");
    await expect(
      page.getByRole("region", { name: /Иностранный язык/ }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "test-results/performance-" + width + ".png",
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".discipline-link")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByRole("combobox", { name: "Семестр", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: /Международное право/ }),
  ).toBeFocused();
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement!).outlineStyle,
  );
  expect(outline).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Международное право", exact: true }),
  ).toBeFocused();
  // 200% text scaling also stresses wrapping beyond ordinary viewport checks.
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await page.setViewportSize({ width: 720, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/performance-text-200.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("theme text, status and focus contrast", async ({ page }) => {
  await mockStudent(page);
  await page.goto(url);
  const ratios = await page.evaluate(() => {
    function luminance(color: string) {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const n = v / 255;
          return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    const pairs = [
      ["text", "surface"],
      ["text-muted", "canvas"],
      ["text-muted", "surface"],
      ["success", "success-soft"],
      ["danger", "danger-soft"],
      ["neutral", "neutral-soft"],
      ["primary", "surface"],
    ];
    return pairs.map(([foreground, background]) => {
      const el = document.createElement("span");
      el.style.color = "var(--color-" + foreground + ")";
      el.style.backgroundColor = "var(--color-" + background + ")";
      document.body.append(el);
      const style = getComputedStyle(el);
      const values = [
        luminance(style.color),
        luminance(style.backgroundColor),
      ].sort((a, b) => a - b);
      el.remove();
      return (values[1] + 0.05) / (values[0] + 0.05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});
