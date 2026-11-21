import { test, expect } from "./test";
import { mockPerformance } from "./performance-http";

for (const width of [360, 1280]) test(`points explain works separately from final grades at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 940 });
  await mockPerformance(page);
  await page.route("**/api/identity/session", r => r.fulfill({ json: { userId: "demo", studentId: "demo", universityId: "10000000-0000-0000-0000-000000000001", displayName: "Александр", roles: ["Student"], areas: ["student"], permissions: [] } }));
  await page.route("**/api/academic-performance/student/courses/*/points", r => r.fulfill({ json: { courseId: "databases", planVersion: 1, earned: 18, maximum: 100, attendanceIncomplete: true, components: [
    { id: "work", name: "Проект", kind: "assessment", maximum: 60, points: 18, incomplete: false },
    { id: "attendance", name: "Посещение", kind: "attendance", maximum: 10, points: null, incomplete: true },
    { id: "final", name: "Экзамен", kind: "final", maximum: 30, points: null, incomplete: false }
  ] } }));
  await page.goto("/student/academic-performance?discipline=databases");
  await expect(page.getByText("Набрано 18 из 100", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Накопленные баллы" })).toHaveAttribute("value", "18");
  await expect(page.getByRole("table", { name: "Текущие оценки" })).toHaveCount(0);
  await page.getByText("Правила оценивания дисциплины", { exact: true }).click();
  await expect(page.getByText(/Шкала перевода баллов в итоговую оценку пока не опубликована/)).toBeVisible();
  await expect(page.getByText(/Баллы за посещение предварительные/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `test-results/points-rules-${width}.png`, fullPage: true });
});
