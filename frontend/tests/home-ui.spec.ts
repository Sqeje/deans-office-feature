import { mockRequests } from './requests-http';
import { test, expect } from "./test";
import { mockPerformance } from "./performance-http";
test.beforeEach(async ({ page }) => {
  await mockPerformance(page); await mockRequests(page);
  await page.route("**/api/notifications/student", r => r.fulfill({ json: { items: [], unreadCount: 0 } }));
  await page.route("**/api/schedule/next", r => r.fulfill({ json: { timeZone: "Europe/Moscow", event: {
    id: "demo-lesson", title: "Программирование", startsAt: "2026-11-09T12:10:00+03:00", room: "Ауд. 305", kind: "Лекция", groupName: "ПИ-21",
  } } }));
});
test("login validates locally and password toggle never submits", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401 }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByText("Введите логин", { exact: true })).toBeVisible();
  await expect(page.getByText("Введите пароль", { exact: true })).toBeVisible();
  await page.getByLabel("Пароль", { exact: true }).fill("demo-password");
  await page.getByRole("button", { name: "Показать пароль" }).click();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});

test("pending login is not duplicated and errors preserve values", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401 }),
  );
  await page.route("**/api/identity/csrf", (r) =>
    r.fulfill({ json: { token: "test" } }),
  );
  let count = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/identity/login", async (r) => {
    count++;
    await gate;
    await r.fulfill({
      status: 401,
      json: { status: 401, code: "authentication_required" },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("demo@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill("unchanged");
  await page.getByLabel("Пароль", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Входим…" })).toBeDisabled();
  await page.getByLabel("Пароль", { exact: true }).press("Enter");
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Проверьте логин и пароль",
  );
  expect(count).toBe(1);
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue(
    "unchanged",
  );
  await page.route("**/api/identity/login", (r) => r.abort());
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось связаться с сервером",
  );
});
for (const width of [360, 390, 768, 1024, 1280, 1440])
  test(`home layout and font ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/identity/session", (r) =>
      r.fulfill({
        json: {
          userId: "demo",
          universityId: "demo",
          displayName: "Алексей Примеров",
          roles: ["Student", "Staff"],
          studentId: "demo",
          permissions: [],
          areas: ["student", "staff"],
        },
      }),
    );
    await page.route("**/api/identity/me", (r) =>
      r.fulfill({
        json: {
          id: "demo",
          fullName: "Алексей Примеров",
          email: "demo@example.invalid",
          universityId: "demo",
          university: "Демонстрационный университет",
          faculty: "Факультет информационных технологий",
          program: "Прикладная информатика",
          group: "ПИ-21",
        },
      }),
    );
    await page.goto("/student");
    await expect(
      page.getByText("Демонстрационный университет · Факультет информационных технологий · Прикладная информатика · Группа ПИ-21", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Демонстрационные данные:", { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Разделы", exact: true }).locator(".nav-link")).toHaveCount(5);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".performance-home .performance-summary-values")).toBeVisible();
    await expect(page.locator(".request-card .status-badge")).toBeVisible();
    const cardLayout = await page.evaluate(() => {
      const performance = document.querySelector(".performance-home")!;
      const request = document.querySelector(".request-card")!;
      const performanceBox = performance.getBoundingClientRect();
      const requestBox = request.getBoundingClientRect();
      return {
        performance: { top: performanceBox.top, bottom: performanceBox.bottom, left: performanceBox.left },
        request: { top: requestBox.top, bottom: requestBox.bottom, left: requestBox.left },
        performancePadding: getComputedStyle(performance).padding,
        requestPadding: getComputedStyle(request).padding,
      };
    });
    if (width >= 768) {
      expect(cardLayout.request.top).toBeCloseTo(cardLayout.performance.top, 0);
      expect(cardLayout.request.bottom).toBeCloseTo(cardLayout.performance.bottom, 0);
      expect(cardLayout.request.left).toBeGreaterThan(cardLayout.performance.left);
      expect(cardLayout.requestPadding).toBe(cardLayout.performancePadding);
    }
    expect(
      await page.evaluate(() =>
        document.fonts.check('16px "Inter Variable"', "Привет"),
      ),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Меню профиля" }).click();
    await expect(
      page.getByRole("link", { name: "Профиль", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Меню профиля" }),
    ).toBeFocused();
    const composition = await page.evaluate(() => {
      const lesson = document.querySelector(".lesson-card")!;
      const event = document.querySelector(".important-event")!;
      const icon = event.querySelector("svg")!.getBoundingClientRect();
      const text = event.querySelector("h3")!.getBoundingClientRect();
      return {
        lessonHeight: lesson.getBoundingClientRect().height,
        labelSize: parseFloat(
          getComputedStyle(lesson.querySelector("h2")!).fontSize,
        ),
        eventIconRight: icon.right,
        eventTextLeft: text.left,
      };
    });
    expect(composition.labelSize).toBe(14);
    expect(composition.eventIconRight).toBeLessThanOrEqual(
      composition.eventTextLeft,
    );
    if (width >= 1024)
      expect(composition.lessonHeight).toBeLessThanOrEqual(180);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });

test("profile expiry redirects and partial failure can be retried", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: {
        userId: "demo",
        universityId: "demo",
        displayName: "Алексей Примеров",
        roles: ["Student"],
        studentId: "demo",
        permissions: [],
        areas: ["student"],
      },
    }),
  );
  let failed = true;
  await page.route("**/api/identity/me", (r) =>
    failed
      ? r.fulfill({ status: 500, json: { code: "internal_error" } })
      : r.fulfill({
          json: { university: "Тестовый университет", group: "ПИ-21" },
        }),
  );
  await page.goto("/student");
  await expect(page.getByRole("alert").filter({ hasText: "Не удалось загрузить профиль" })).toContainText(
    "Не удалось загрузить профиль",
  );
  await expect(
    page.getByRole("heading", { name: "Ближайшее занятие" }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("alert").filter({ hasText: "Не удалось загрузить профиль" }).getByRole("button", { name: "Повторить" }).click();
  await expect(
    page.getByText("Тестовый университет", { exact: false }),
  ).toBeVisible();
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401 }),
  );
  await page.route("**/api/identity/me", (r) => r.fulfill({ status: 401 }));
  await page.reload();
  await expect(page).toHaveURL(/login/);
});

test("summary component supports loading, empty and retry states", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401 }),
  );
  await page.goto("/login");
  const states = await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js",
      rootPath = "/node_modules/.vite/deps/react-dom_client.js",
      componentPath = "/src/modules/identity/StudentHome.tsx";
    const reactModule = await import(reactPath),
      React = reactModule.default ?? reactModule,
      rootModule = await import(rootPath),
      createRoot = (rootModule.default ?? rootModule).createRoot,
      { SummaryCard } = await import(componentPath);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let retries = 0;
    const render = async (block: unknown) => {
      root.render(
        React.createElement(SummaryCard, {
          title: "Тест",
          block,
          empty: "Нет записей",
          children: () => React.createElement("p", null, "Данные"),
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
      return host.textContent;
    };
    const loading = await render({ status: "loading" }),
      empty = await render({ status: "success", data: null }),
      error = await render({ status: "error", retry: () => retries++ });
    host.querySelector("button")?.click();
    const success = await render({ status: "success", data: {} });
    root.unmount();
    host.remove();
    return { loading, empty, error, success, retries };
  });
  expect(states.loading).toContain("Загружаем");
  expect(states.empty).toContain("Нет записей");
  expect(states.error).toContain("Повторить");
  expect(states.retries).toBe(1);
  expect(states.success).toContain("Данные");
});

for (const width of [360, 1280])
  test(`login font and layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/identity/session", (r) =>
      r.fulfill({ status: 401 }),
    );
    await page.goto("/login");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (f) => f.family === "Inter Variable" && f.status === "loaded",
        ),
      ),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
  });

test("session with no areas explains access and permits logout", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({
      json: { displayName: "Тест", areas: [], roles: [], permissions: [] },
    }),
  );
  await page.route("**/api/identity/csrf", (r) =>
    r.fulfill({ json: { token: "test" } }),
  );
  await page.route("**/api/identity/login", (r) => r.fulfill({ status: 204 }));
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("demo@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "нет доступного кабинета",
  );
  await expect(
    page.getByRole("button", { name: "Выйти из учётной записи" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test("empty summaries never invent grades and partial errors preserve other cards", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (r) =>
    r.fulfill({ status: 401 }),
  );
  await page.goto("/login");
  await page.evaluate(async () => {
    const rp = "/node_modules/.vite/deps/react.js",
      dp = "/node_modules/.vite/deps/react-dom_client.js",
      cp = "/src/modules/identity/StudentHome.tsx",
      fp = "/src/modules/identity/homeDemo.ts";
    const rm = await import(rp),
      React = rm.default ?? rm,
      dm = await import(dp),
      { HomeSummaries } = await import(cp),
      { homeDemo } = await import(fp);
    const routerPath = "/node_modules/.vite/deps/react-router-dom.js";
    const { MemoryRouter } = await import(routerPath);
    const host = document.createElement("div");
    host.id = "summary-test";
    document.body.append(host);
    const root = (dm.default ?? dm).createRoot(host);
    const render = (data: unknown, blocks?: unknown) =>
      root.render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(HomeSummaries, { data, blocks }),
        ),
      );
    render(
      { ...homeDemo, performance: null, request: null, notifications: [] },
      {
        lesson: {
          status: "error",
          retry: () =>
            render({
              ...homeDemo,
              lesson: null,
              performance: null,
              request: null,
              notifications: [],
            }),
        },
      },
    );
  });
  const host = page.locator("#summary-test");
  await expect(
    host.getByText("Оценок пока нет", { exact: true }),
  ).toBeVisible();
  await expect(host.getByRole("img", { name: /Средний балл/ })).toHaveCount(0);
  await expect(
    host.getByText("Заявок пока нет", { exact: true }),
  ).toBeVisible();
  await expect(
    host.getByText("Уведомлений пока нет", { exact: true }),
  ).toBeVisible();
  await expect(
    host.getByRole("heading", { name: "Важное событие" }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Повторить" }).click();
  await expect(
    host.getByText("Ближайших занятий нет", { exact: true }),
  ).toBeVisible();
});
