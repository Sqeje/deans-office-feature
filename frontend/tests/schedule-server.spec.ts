import { test, expect, type Page, type APIRequestContext } from "./test";
import ExcelJS from "exceljs";
import { dateKey, formatTime } from "../src/modules/schedule/model";

async function login(page: Page, email: string, password: string | undefined) {
  if (!password) throw new Error("Set demo account passwords for integration tests");
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(email.startsWith("staff") ? /\/staff$/ : /\/student$/);
}
const local = (date: Date) => `${dateKey(date)}T${formatTime(date.toISOString())}`;
async function csrf(request: APIRequestContext) { return { "X-CSRF-TOKEN": (await (await request.get("/api/identity/csrf")).json()).token }; }

for (const width of [360, 1280]) test(`server schedule, staff edit, home, second student and XLSX ${width}`, async ({ browser }, testInfo) => {
  const a = await browser.newContext({ viewport: { width, height: 950 } });
  const b = await browser.newContext({ viewport: { width, height: 950 } });
  const employee = await browser.newContext({ viewport: { width, height: 950 } });
  const student = await a.newPage(), other = await b.newPage(), staff = await employee.newPage();
  let original: any, changed: any;
  try {
    await login(student, "student1@demo.invalid", process.env.DEMO_PASSWORD1);
    await login(other, "student2@demo.invalid", process.env.DEMO_PASSWORD2);
    const contextA = await (await a.request.get("/api/schedule/context")).json();
    const contextB = await (await b.request.get("/api/schedule/context")).json();
    expect(contextA.groupName).toBeTruthy(); expect(contextB.groupName).toBe(contextA.groupName);
    expect(contextA.groupId).toBe(contextB.groupId);
    const next = await (await a.request.get("/api/schedule/next")).json();
    expect(next.event).toBeTruthy();
    await student.getByRole("link", { name: "Перейти в расписание" }).click();
    await expect(student).toHaveURL(new RegExp(`event=${next.event.id}`));
    await expect(student.locator(`#lesson-${next.event.id}`)).toContainText(next.event.room);
    await expect(student.getByRole("heading", { name: "Моё расписание", exact: true })).toBeVisible();
    await expect(student.locator(".demo-notice")).toContainText("сохранено на сервере");
    await login(staff, "staff@demo.invalid", process.env.DEMO_STAFF_PASSWORD);
    await staff.goto("/staff/schedule/edit");
    await expect(staff.locator(".schedule-staff-list article").first()).toBeVisible();
    const firstDay = dateKey(new Date()), until = new Date(Date.now() + 6 * 86400000);
    const data = await (await a.request.get(`/api/schedule/mine?start=${firstDay}&end=${dateKey(until)}&category=lesson`)).json();
    original = data.events.find((event: any) => !event.isImported && new Date(event.endsAt).getTime() > Date.now());
    expect(original).toBeTruthy();
    await staff.getByLabel("Неделя с датой").fill(dateKey(new Date(original.startsAt)));
    const article = staff.locator("article").filter({ has: staff.locator(`#lesson-${original.id}`) });
    await article.getByRole("button", { name: "Изменить занятие" }).click();
    const form = staff.getByRole("form", { name: "Изменение занятия" });
    await form.getByLabel("Начало занятия", { exact: true }).fill(local(new Date(Date.now() - 2 * 3600000)));
    await form.getByLabel("Окончание занятия", { exact: true }).fill(local(new Date(Date.now() + 30 * 60000)));
    await form.getByLabel("Аудитория", { exact: true }).fill(`Ауд. тест ${width}`);
    await expect(form.getByLabel("Преподаватель", { exact: true })).toHaveAttribute("readonly", "");
    expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await staff.screenshot({ path: testInfo.outputPath("staff-edit.png"), fullPage: true });
    const saved = staff.waitForResponse(response => response.url().endsWith(`/api/schedule/${original.id}`) && response.request().method() === "PUT");
    await form.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
    const result = await saved; expect(result.status()).toBe(200); changed = await result.json();
    await expect(staff.getByRole("status", { name: "" }).filter({ hasText: "Изменения сохранены." })).toBeVisible();
    await student.goto("/student");
    await expect(student.locator(".lesson-card")).toContainText(`Ауд. тест ${width}`);
    await student.getByRole("link", { name: "Перейти в расписание" }).click();
    await expect(student.locator(`#lesson-${original.id}`)).toContainText(`Ауд. тест ${width}`);
    await student.reload();
    await expect(student.locator(`#lesson-${original.id}`)).toContainText(original.teacher);
    const pending = student.waitForEvent("download");
    await student.getByRole("button", { name: "Сохранить на устройство", exact: true }).click();
    const download = await pending;
    const book = new ExcelJS.Workbook(); await book.xlsx.readFile((await download.path())!);
    const sheet = book.worksheets[0];
    expect(sheet.getCell("A3").text).toContain("сохранены на сервере");
    expect(sheet.getCell("A1").text).toContain(contextA.groupName);
    expect(Array.from({ length: sheet.rowCount - 6 }, (_, i) => sheet.getCell(i + 7, 6).text).some(text => text.includes(`Ауд. тест ${width}`))).toBe(true);
    const otherData = await (await b.request.get(`/api/schedule/mine?start=${firstDay}&end=${dateKey(until)}&category=lesson&groupId=${contextA.groupId}`)).json();
    expect(otherData.events.every((event: any) => event.groupId === contextB.groupId)).toBe(true);
    await student.getByRole("button", { name: "Контрольные и экзамены", exact: true }).click();
    await expect(student.locator(".schedule-row")).not.toHaveCount(0);
    await expect(student.getByText("Сдано", { exact: true })).toHaveCount(0);
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await student.screenshot({ path: testInfo.outputPath("personal-assessments.png"), fullPage: true });
  } finally {
    if (original && changed) {
      const response = await employee.request.put(`/api/schedule/${original.id}`, { headers: await csrf(employee.request), data: {
        startsAt: original.startsAt, endsAt: original.endsAt, room: original.room, teacher: original.teacher,
        address: original.location.address, building: original.location.building, floor: original.location.floor,
        cancelled: original.status === "cancelled", version: changed.version,
      } });
      expect(response.status()).toBe(200);
    }
    await a.close(); await b.close(); await employee.close();
  }
});

test("personal API error never falls back to demo data; retry can load an empty schedule", async ({ page }) => {
  await page.route("**/api/identity/session", r => r.fulfill({ json: { userId: "demo", universityId: "demo", displayName: "Пример", roles: ["Student"], studentId: "demo", permissions: [], areas: ["student"] } }));
  let fail = true;
  await page.route("**/api/schedule/context", r => r.fulfill({ json: { groupId: "server-group", groupName: "Серверная группа", timeZone: "Europe/Moscow", isDemo: false } }));
  await page.route("**/api/schedule/mine?*", r => fail ? r.fulfill({ status: 503, json: { code: "source_unavailable", traceId: "schedule-test" } })
    : r.fulfill({ json: { groupId: "server-group", groupName: "Серверная группа", timeZone: "Europe/Moscow", isDemo: false, events: [] } }));
  await page.goto("/student/schedule");
  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить расписание");
  await expect(page.getByRole("alert")).toContainText("schedule-test");
  await expect(page.locator(".schedule-row")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сохранить на устройство" })).toBeDisabled();
  fail = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "В этот день занятий нет" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить на устройство" })).toBeEnabled();
});
