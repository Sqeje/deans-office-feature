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
    let actionRequiredCount = 1;
    const actions = teacher ? ["grades.read", "grades.write", "journal.write", "schedule.write"] : ["grades.read", "grades.correct", "requests.manage"];
    await page.route("**/api/identity/session", r => r.fulfill({ json: { userId: account.id, universityId: "demo", displayName: account.id, roles: ["Staff", account.role], permissions: actions.map(permission => ({ permission, groupId: "group" })), areas: ["staff"] } }));
    await page.route("**/api/identity/staff-context", r => r.fulfill({ json: { roles: ["Staff", account.role], groups: [{ id: "group", name: account.group, actions }], assignments: teacher ? [{ id: "assignment", courseId: "course", groupId: "group", semesterId: "term", courseName: "Учебная дисциплина" }] : [] } }));
    await page.route("**/api/requests/staff/summary", r => r.fulfill({ json: { actionRequiredCount } }));
    await page.route("**/api/schedule/catalog", r => r.fulfill({ json: { groups: [{ id: "group", name: account.group }], teachers: [] } }));
    await page.route("**/api/schedule/teacher/context", r => r.fulfill({ json: { teacherId: account.id, teacherName: account.id, timeZone: "Europe/Moscow", isDemo: false } }));
    await page.route("**/api/schedule/teacher/mine?*", r => r.fulfill({ json: { timeZone: "Europe/Moscow", events: [] } }));
    await page.route("**/api/academic-performance/staff/groups", r => r.fulfill({ json: [{ id: "group", name: account.group }] }));
    await page.route("**/api/academic-performance/semesters", r => r.fulfill({ json: { semesters: [{ id: "term", label: "Осень 2026" }], defaultSemesterId: "term" } }));
    await page.route("**/api/academic-performance/staff/journal-courses", r => r.fulfill({ json: [{ courseId: "course", courseName: "Учебная дисциплина", groupId: "group", groupName: account.group, semesterId: "term" }] }));
    await page.route("**/api/academic-performance/staff/courses/course/journal", r => r.fulfill({ json: { courseId: "course", courseName: "Учебная дисциплина", groupId: "group", semesterId: "term", lessons: [{ lessonId: "lesson", startsAt: "2026-11-10T09:00:00Z", subject: "Практическая работа", isCancelled: false, canEdit: true, readOnlyReason: null, version: 0, rows: [{ studentId: "student", fullName: "Тестовый студент", grade: null, attendance: "unmarked", correctionReason: null }, { studentId: "graded", fullName: "Уже оценён", grade: 4, attendance: "present", correctionReason: null }] }] } }));
    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: `Здравствуйте, ${account.id}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Заполнить журнал занятий", exact: true })).toHaveCount(teacher ? 1 : 0);
    await expect(page.getByRole("link", { name: "Проверить итоговые результаты", exact: true })).toHaveCount(0);
    if (!teacher) await expect(page.getByText("Ваши роли: Сотрудник деканата")).toBeVisible();
    if (!teacher) {
      await expect(page.getByRole("link", { name: "Корректировать оценки", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Обработать обращения", exact: true })).toBeVisible();
      actionRequiredCount = 0;
      await page.reload();
      await expect(page.getByRole("link", { name: "Обработать обращения", exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Задачи", exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByRole("link", { name: "Обработать обращения", exact: true })).toHaveCount(0);
    }
    await page.getByRole("link", { name: "Журнал", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Журнал", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Оценки по занятиям" })).toBeVisible();
    await expect(page.getByRole("link", { name: "К итоговым результатам", exact: true })).toHaveCount(0);
    if (teacher) {
      await expect(page.getByLabel(/Оценка Тестовый студент/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Исправить оценку/ })).toHaveCount(0);
    } else {
      const grade = page.getByRole("button", { name: /Исправить оценку Уже оценён/ });
      await expect(grade).toBeVisible();
      await grade.click();
      await expect(page.getByRole("heading", { name: "Исправить оценку", exact: true })).toBeVisible();
      const saveCorrection = page.getByRole("button", { name: "Сохранить исправление", exact: true });
      await expect(saveCorrection).toBeDisabled();
      await page.getByLabel("Причина исправления", { exact: true }).fill("Исправление по результатам проверки");
      await page.getByLabel("Новая оценка", { exact: true }).selectOption("3");
      await expect(saveCorrection).toBeEnabled();
      await page.getByRole("button", { name: "Отмена", exact: true }).click();
    }
    await page.goto("/staff/schedule/catalog");
    await expect(page.getByRole("heading", { name: "Все расписания", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Редактировать расписание", exact: true })).toHaveCount(teacher ? 1 : 0);
    if (!teacher) {
      await expect(page.getByRole("link", { name: "Расписания", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Подразделы расписания" })).toHaveCount(0);
      await expect(page.getByRole("group", { name: "Подразделы расписания" })).toHaveCount(0);
    }
    for (const width of [360, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      const nav = page.getByRole("navigation", { name: "Разделы", exact: true });
      await expect(nav).toHaveCSS("position", width < 1024 ? "fixed" : "static");
      await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
    if (!teacher) {
      await page.goto("/staff/schedule");
      await expect(page).toHaveURL(/schedule\/catalog$/);
    }
  });
}
