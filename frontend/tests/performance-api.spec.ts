import { test, expect, type Page } from "./test";
import { mockPerformance, performanceResponse } from "./performance-http";
import type { components } from "../src/shared/schema";

type Performance = components["schemas"]["PerformanceResponse"];
async function readPerformance(page: Page, semesterId: string): Promise<Performance> {
  const response = await page.request.get(`/api/academic-performance/student?semesterId=${semesterId}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
const formatNumber = (value: number | string) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(value));
async function expectHome(page: Page, summary: Performance["summary"]) {
  const values = page.locator(".performance-summary-values");
  for (const [label, value] of [
    ["Сдано дисциплин", `${summary.passed} из ${summary.total}`],
    ["Зачёты", String(summary.credits)],
    ["Средний балл", summary.average === null ? "Оценок пока нет" : formatNumber(summary.average)],
    ["Задолженности", String(summary.debts)],
  ]) await expect(values.locator("div").filter({ hasText: label })).toHaveText(label + value);
}

async function login(page: Page, account: "student1" | "student2" | "staff") {
  const key =
    account === "staff"
      ? "DEMO_STAFF_PASSWORD"
      : account === "student1"
        ? "DEMO_PASSWORD1"
        : "DEMO_PASSWORD2";
  const password = process.env[key];
  if (!password) throw new Error(`Set ${key}`);
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(account + "@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Здравствуйте",
  );
}

test("live PostgreSQL: employee saves, two students stay separate, home and section agree after reload", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [1, 2, 3].map(() =>
      browser.newContext({ viewport: { width: 360, height: 900 } }),
    ),
  );
  let restore = async () => {};
  try {
    const [first, second, staff] = await Promise.all(
      contexts.map((c) => c.newPage()),
    );
    const errors: string[] = [];
    for (const page of [first, second, staff])
      page.on("pageerror", (e) => errors.push(e.message));
    await login(first, "student1");
    await login(second, "student2");
    await login(staff, "staff");
    const profile = await (await first.request.get("/api/identity/me")).json();
    const catalog = await (await first.request.get("/api/academic-performance/semesters")).json();
    const semesterId = catalog.defaultSemesterId;
    const original = await readPerformance(first, semesterId);
    const otherOriginal = await readPerformance(second, semesterId);
    const contextResponse = await staff.request.get("/api/identity/staff-context");
    expect(contextResponse.ok()).toBeTruthy();
    const context = await contextResponse.json();
    const discipline = original.disciplines.find(d => d.isLocal && d.assessment === "exam" &&
      context.assignments.some((a: { courseId: string; semesterId: string }) => a.courseId === d.id && a.semesterId === semesterId));
    expect(discipline, "Teacher must have an assigned local exam in the student's semester").toBeTruthy();
    const course = discipline!.id;
    const assignment = context.assignments.find((a: { courseId: string }) => a.courseId === course);
    const resultUrl = `/api/academic-performance/staff/students/${profile.id}/courses/${course}/result`;
    const setResult = async (kind: string, value: number | null, reason: string) => {
      const current = await readPerformance(first, semesterId);
      const version = current.disciplines.find(d => d.id === course)!.version;
      const csrf = await (await staff.request.get("/api/identity/csrf")).json();
      const response = await staff.request.put(resultUrl, {
        data: { kind, value, version, reason }, headers: { "X-CSRF-TOKEN": csrf.token },
      });
      expect(response.status()).toBe(204);
    };
    restore = async () => {
      const final = discipline!.final;
      await setResult(final?.kind ?? "pending", final?.value == null ? null : Number(final.value), "Восстановление исходного результата после теста");
    };
    await setResult("grade", 2, "Подготовка результата для проверки сохранения");
    const before = await readPerformance(first, semesterId);
    await first.reload();
    await expectHome(first, before.summary);
    await expectHome(second, otherOriginal.summary);
    const nextExam = before.summary.nextExam;
    expect(nextExam, "Demo semester must retain a pending upcoming exam").toBeTruthy();
    await first
      .getByRole("link", {
        name: `Открыть ближайший экзамен: ${nextExam!.name}`,
        exact: true,
      })
      .click();
    await expect(first.getByRole("heading", { level: 1 })).toHaveText(
      nextExam!.name,
    );
    await expect(
      first.getByText(new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(nextExam!.date + "T12:00:00")), { exact: true }),
    ).toBeVisible();
    await first.goto("/student");
    await expect(first.locator(".performance-summary-values")).toBeVisible();
    await staff.goto("/staff/academic-performance?view=finals");
    await staff
      .getByLabel("Группа", { exact: true })
      .selectOption(assignment.groupId);
    await staff.getByLabel("Студент", { exact: true }).selectOption(profile.id);
    await staff.getByLabel("Дисциплина", { exact: true }).selectOption(course);
    await staff.getByRole("button", { name: "Исправить результат", exact: true }).click();
    await staff.getByLabel("Причина изменения", { exact: false }).fill("Проверка сохранения исправленного результата");
    await staff.getByLabel("Итоговый результат").selectOption("4");
    await staff
      .getByRole("button", { name: "Сохранить результат", exact: true })
      .click();
    await expect(staff.locator(".performance-save-success")).toContainText(
      "Результат сохранён",
    );
    await expect(staff.getByText("Текущий итог: 4")).toBeVisible();
    await first.reload();
    const after = await readPerformance(first, semesterId);
    expect(after.disciplines.find(d => d.id === course)!.final).toEqual({ kind: "grade", value: 4 });
    expect(Number(after.summary.passed)).toBe(Number(before.summary.passed) + 1);
    expect(Number(after.summary.debts)).toBe(Number(before.summary.debts) - 1);
    const grades = before.disciplines.filter(d => d.final?.kind === "grade").map(d => d.id === course ? 4 : Number(d.final!.value));
    expect(after.summary.average).toBeCloseTo(grades.reduce((a, b) => a + b, 0) / grades.length, 2);
    await expectHome(first, after.summary);
    await first
      .getByRole("link", { name: "Открыть успеваемость", exact: true })
      .click();
    await expect(first.locator(".academic-results-summary")).toHaveText(
      `Сдано дисциплин: ${after.summary.passed} · Средний балл: ${formatNumber(after.summary.average!)}`,
    );
    await first
      .getByRole("link", {
        name: `Открыть дисциплину: ${discipline!.name}`,
        exact: true,
      })
      .and(first.locator(`a[href*="discipline=${course}"]`))
      .click();
    await expect(first.locator(".academic-attestation")).toContainText("4");
    await first.reload();
    await expect(first.locator(".academic-attestation")).toContainText("4");
    await second.reload();
    expect(await readPerformance(second, semesterId)).toEqual(otherOriginal);
    await expectHome(second, otherOriginal.summary);
    await first.goto("/student");
    await expectHome(first, after.summary);
    await first
      .getByLabel("Семестр", { exact: true })
      .selectOption("2026-spring");
    await expect(
      first.getByText("Предстоящих экзаменов пока нет."),
    ).toBeVisible();
    await expect(
      first
        .locator(".performance-summary-values div")
        .filter({ hasText: "Зачёты" }),
    ).toHaveText("Зачёты1");
    await first
      .getByRole("link", { name: "Открыть успеваемость", exact: true })
      .click();
    await expect(first.getByLabel("Семестр", { exact: true })).toHaveValue(
      "2026-spring",
    );
    await expect(
      first.locator(".academic-stat").filter({ hasText: "Зачёты" }),
    ).toContainText("1");
    await first.goto(`/student?semester=${semesterId}`);
    await expect(
      first.getByRole("link", {
        name: `Открыть ближайший экзамен: ${after.summary.nextExam!.name}`,
        exact: true,
      }),
    ).toBeVisible();
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      for (const [page, name] of [
        [first, "home"],
        [staff, "staff"],
      ] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: `test-results/slice6-live-${name}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await staff.getByRole("button", { name: "Исправить результат", exact: true }).click();
    await staff.getByLabel("Итоговый результат").focus();
    await expect(staff.getByLabel("Итоговый результат")).toBeFocused();
    await staff.emulateMedia({ reducedMotion: "reduce" });
    await staff.addStyleTag({ content: "html {font-size:200%}" });
    await staff.setViewportSize({ width: 720, height: 1000 });
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    try {
      await restore();
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  }
});

test("API UI states: loading, retry without demo fallback, empty semester, denied and expired session", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "test-student",
        studentId: "test-student",
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Студент",
        roles: ["Student"],
        areas: ["student"],
        permissions: [],
      },
    }),
  );
  await mockPerformance(page);
  let fail = true;
  await page.route("**/api/academic-performance/student?*", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return r.fulfill(
      fail
        ? { status: 503, json: { code: "unavailable", traceId: "test-trace" } }
        : { json: performanceResponse("2026-autumn") },
    );
  });
  await page.goto("/student/academic-performance");
  await expect(page.getByRole("status")).toContainText("Загружаем");
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить успеваемость",
  );
  await expect(page.getByText("Код обращения: test-trace")).toBeVisible();
  await expect(page.getByText("Базы данных", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(
    page.getByRole("link", {
      name: "Открыть дисциплину: Базы данных",
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/academic-performance/student?*");
  await mockPerformance(page);
  await page.getByLabel("Семестр", { exact: true }).selectOption("2027-spring");
  await expect(
    page.getByRole("heading", { name: "Дисциплин пока нет" }),
  ).toBeVisible();
  await page.route("**/api/academic-performance/student?*", (r) =>
    r.fulfill({ status: 403, json: { code: "access_denied" } }),
  );
  await page.goto("/student/academic-performance");
  await expect(
    page.getByRole("heading", { name: "Нет доступа" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
  await page.route("**/api/academic-performance/student?*", (r) =>
    r.fulfill({ status: 401, json: { code: "authentication_required" } }),
  );
  await page.reload();
  await expect(page).toHaveURL(/login\?expired=1/);
  await expect(page.getByText("Сеанс завершён. Войдите снова")).toBeVisible();
});

test("staff changes selection safely, keeps failed input, prevents duplicate save and supports long text", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "staff",
        studentId: null,
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Сотрудник",
        roles: ["Staff", "Teacher"],
        areas: ["staff"],
        permissions: [
          { permission: "grades.read", groupId: "group" },
          { permission: "grades.write", groupId: "group" },
        ],
      },
    }),
  );
  await mockPerformance(page);
  await page.route("**/api/identity/staff-context", r => r.fulfill({ json: {
    roles: ["Staff", "Teacher"],
    groups: [{ id: "group", name: "Учебная группа с очень длинным демонстрационным названием", actions: ["grades.read", "grades.write"] }],
    assignments: [{ id: "assignment", courseId: "networks", groupId: "group", semesterId: "2026-autumn", courseName: "Компьютерные сети" }],
  } }));
  await page.route("**/api/academic-performance/staff/students/*/courses/networks/history", r => r.fulfill({ json: [] }));
  await page.route("**/api/academic-performance/staff/groups", (r) =>
    r.fulfill({
      json: [
        {
          id: "group",
          name: "Учебная группа с очень длинным демонстрационным названием",
        },
      ],
    }),
  );
  await page.route(
    "**/api/academic-performance/staff/groups/group/students",
    (r) =>
      r.fulfill({
        json: [
          { id: "first", name: "Первый Студент", groupId: "group" },
          {
            id: "second",
            name: "Второй Студент С Очень Длинным Вымышленным Именем",
            groupId: "group",
          },
        ],
      }),
  );
  let release!: () => void;
  const oldResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  const name =
    "Очень длинное название дисциплины для проверки переноса и доступности формы результатов";
  let saved = false;
  await page.route(
    "**/api/academic-performance/staff/students/*?*",
    async (r) => {
      const first = r.request().url().includes("/first?");
      if (first) await oldResponse;
      const data = performanceResponse("2026-autumn");
      data.disciplines = [data.disciplines[2]];
      data.disciplines[0] = {
        ...data.disciplines[0],
        name: first ? "Устаревший ответ первого студента" : name,
      };
      await r.fulfill({ json: { ...data, disciplines: data.disciplines.map(d => ({
        ...d, version: saved ? 2 : 1, ...(saved ? { final: { kind: "grade", value: 4 }, status: "passed" } : {}),
      })) } });
    },
  );
  await page.goto("/staff/academic-performance");
  await page.getByLabel("Группа", { exact: true }).selectOption("group");
  await page.getByLabel("Студент", { exact: true }).selectOption("first");
  await page.getByLabel("Студент", { exact: true }).selectOption("second");
  await page.getByLabel("Дисциплина", { exact: true }).selectOption("networks");
  release();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Устаревший ответ первого студента")).toHaveCount(
    0,
  );
  let writes = 0;
  let fail = true;
  await page.route("**/api/identity/csrf", (r) =>
    r.fulfill({ json: { token: "test-only" } }),
  );
  await page.route(
    "**/api/academic-performance/staff/students/second/courses/networks/result",
    async (r) => {
      writes++;
      expect(r.request().postDataJSON()).toEqual({ kind: "grade", value: 4, version: 1, reason: "Проверка исправления результата" });
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!fail) saved = true;
      await r.fulfill(
        fail
          ? { status: 400, json: { code: "validation_failed" } }
          : { status: 204 },
      );
    },
  );
  await page.getByRole("button", { name: "Исправить результат", exact: true }).click();
  await page.getByLabel("Причина изменения", { exact: false }).fill("Проверка исправления результата");
  await page.getByLabel("Итоговый результат").selectOption("4");
  await page
    .getByRole("button", { name: "Сохранить результат", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохраняем…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Студент", { exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Проверьте итог");
  await expect(page.getByLabel("Итоговый результат")).toHaveValue("4");
  await expect(page.getByLabel("Итоговый результат")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/slice6-staff-long-validation-360.png",
    fullPage: true,
  });
  fail = false;
  await page
    .getByRole("button", { name: "Сохранить результат", exact: true })
    .click();
  await expect(page.locator(".performance-save-success")).toContainText(
    "Результат сохранён",
  );
  expect(writes).toBe(2);
});

test("home does not invent a numerical average when there are no finals", async ({
  page,
}) => {
  await page.route("**/api/identity/me", (r) =>
    r.fulfill({ json: { university: "Тестовый университет", group: "Демо-01" } }),
  );
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "student",
        studentId: "student",
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Студент",
        roles: ["Student"],
        areas: ["student"],
        permissions: [],
      },
    }),
  );
  await mockPerformance(page);
  await page.route("**/api/requests/student/summary", r => r.fulfill({status:204}));
  await page.route("**/api/academic-performance/student?*", (r) =>
    r.fulfill({
      json: {
        semesterId: "2026-autumn",
        disciplines: [],
        summary: {
          total: 1,
          passed: 0,
          debts: 0,
          average: null,
          credits: 0,
          nextExam: null,
        },
      },
    }),
  );
  await page.goto("/student");
  await expect(
    page.getByText("Оценок пока нет", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".performance-average-ring")).toHaveCount(0);
  await expect(page.getByText("Стипендия", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Предстоящих экзаменов пока нет.")).toBeVisible();
});
