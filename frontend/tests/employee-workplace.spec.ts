import { test, expect } from "./test";
for (const account of [
  { id: "teacher-it", role: "Teacher", group: "ИВТ-401" },
  { id: "teacher-economics", role: "Teacher", group: "ЭК-301" },
  { id: "teacher-law", role: "Teacher", group: "ЮР-201" },
  { id: "dean-reader", role: "Dean", group: "ИВТ-401" },
  { id: "dean-editor", role: "Dean", group: "ЭК-301" },
]) {
  test(`${account.id}: only permitted work actions and schedule catalog`, async ({ page }, testInfo) => {
    const teacher = account.role === "Teacher";
    const actions = teacher ? ["grades.read", "grades.write", "journal.write", "schedule.write"] : ["grades.read"];
    await page.route("**/api/identity/session", r => r.fulfill({ json: { userId: account.id, universityId: "demo", displayName: account.id, roles: ["Staff", account.role], permissions: actions.map(permission => ({ permission, groupId: "group" })), areas: ["staff"] } }));
    await page.route("**/api/identity/staff-context", r => r.fulfill({ json: { roles: ["Staff", account.role], groups: [{ id: "group", name: account.group, actions }], assignments: teacher ? [{ id: "assignment", courseId: "course", groupId: "group", semesterId: "term", courseName: "Учебная дисциплина" }] : [] } }));
    await page.route("**/api/schedule/catalog", r => r.fulfill({ json: { groups: [{ id: "group", name: account.group }], teachers: [] } }));
    await page.route("**/api/academic-performance/staff/groups", r => r.fulfill({ json: [{ id: "group", name: account.group }] }));
    await page.route("**/api/academic-performance/semesters", r => r.fulfill({ json: { semesters: [{ id: "term", label: "Осень 2026" }], defaultSemesterId: "term" } }));
    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: `Здравствуйте, ${account.id}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Заполнить журнал занятий", exact: true })).toHaveCount(teacher ? 1 : 0);
    await expect(page.getByRole("link", { name: "Проверить итоговые результаты", exact: true })).toHaveCount(0);
    if (!teacher) await expect(page.getByText("Ваши роли: Сотрудник деканата")).toBeVisible();
    await page.getByRole("link", { name: "Успеваемость", exact: true }).click();
    await expect(page.getByLabel("Группа", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Итоговые результаты", exact: true })).toHaveCount(0);
    if (!teacher) {
      await page.goto("/staff/academic-performance?view=journal&course=unassigned");
      await expect(page.getByLabel("Группа", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Группа и дисциплина", { exact: true })).toHaveCount(0);
    }
    await page.goto("/staff/schedule/catalog");
    await expect(page.getByRole("heading", { name: "Все расписания", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Редактировать расписание", exact: true })).toHaveCount(teacher ? 1 : 0);
    if (!teacher) {
      await expect(page.getByRole("link", { name: "Расписания", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Подразделы расписания" })).toHaveCount(0);
      await expect(page.getByRole("group", { name: "Подразделы расписания" })).toHaveCount(0);
    }
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
    if (!teacher) {
      await page.goto("/staff/schedule");
      await expect(page).toHaveURL(/schedule\/catalog$/);
    }
  });
}
