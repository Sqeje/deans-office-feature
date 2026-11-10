import { test, expect } from "@playwright/test";

test("existing login, profile, navigation and logout with mocked HTTP", async ({
  page,
}) => {
  let loggedIn = false;
  const name = "Александр Константинович Демонстрационный-Примеров";
  const session = {
    userId: "demo",
    studentId: "demo",
    universityId: "10000000-0000-0000-0000-000000000001",
    displayName: name,
    roles: ["Student"],
    areas: ["student"],
    permissions: [],
  };
  await page.route("**/api/identity/session", (route) =>
    route.fulfill(
      loggedIn ? { json: session } : { status: 401, json: { status: 401 } },
    ),
  );
  await page.route("**/api/identity/csrf", (route) =>
    route.fulfill({ json: { token: "test-only-csrf" } }),
  );
  await page.route("**/api/identity/login", (route) => {
    loggedIn = true;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/identity/logout", (route) => {
    loggedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/identity/me", (route) =>
    route.fulfill({
      json: {
        fullName: name,
        email: "student@demo.invalid",
        university: "Демонстрационный университет",
        group: "Демо-01",
      },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("student@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill("test-only-password");
  await page.getByLabel("Пароль", { exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Здравствуйте, " + name }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/regression-home-360.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Профиль", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/regression-profile-360.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Успеваемость", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Успеваемость", exact: true }),
  ).toBeFocused();
  await page.getByLabel("Меню профиля").click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/student/academic-performance");
  await expect(page).toHaveURL(/login/);
});

test("staff workspace retains its permissions and placeholder", async ({
  page,
}) => {
  await page.route("**/api/identity/session", (route) =>
    route.fulfill({
      json: {
        userId: "staff",
        studentId: null,
        universityId: "10000000-0000-0000-0000-000000000001",
        displayName: "Сотрудник Примеров",
        roles: ["Staff"],
        areas: ["staff"],
        permissions: [
          {
            permission: "grades.write",
            groupId: "20000000-0000-0000-0000-000000000001",
          },
        ],
      },
    }),
  );
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "Здравствуйте, Сотрудник Примеров" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Успеваемость", exact: true }).click();
  await expect(
    page.getByText(
      "Рабочие операции сотрудника будут добавлены отдельным срезом.",
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("combobox", { name: "Семестр" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/regression-staff-360.png",
    fullPage: true,
  });
});
