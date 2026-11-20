import { test, expect, type Page } from "./test";
import { weekOf, dateKey } from "../src/modules/schedule/model";

async function login(page: Page, email: string, password: string | undefined, area: string) {
  if (!password) throw new Error("Set demo account passwords");
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${area}$`));
}

for (const width of [360, 1280]) test(`one live catalogue, personal scope and owned editing ${width}`, async ({ browser }, testInfo) => {
  const guestContext = await browser.newContext({ viewport: { width, height: 950 } });
  const studentContext = await browser.newContext({ viewport: { width, height: 950 } });
  const teacherContext = await browser.newContext({ viewport: { width, height: 950 } });
  const guest = await guestContext.newPage(), student = await studentContext.newPage(), teacher = await teacherContext.newPage();
  try {
    await login(student, "student1@demo.invalid", process.env.DEMO_PASSWORD1, "student");
    await login(teacher, "staff@demo.invalid", process.env.DEMO_STAFF_PASSWORD, "staff");
    const catalog = await (await guest.request.get("/api/schedule/catalog")).json();
    expect(catalog.groups.length).toBeGreaterThan(1);
    expect(catalog).toEqual(await (await student.request.get("/api/schedule/catalog")).json());
    expect(catalog).toEqual(await (await teacher.request.get("/api/schedule/catalog")).json());
    for (const [page, path] of [[guest, "/schedule"], [student, "/student/schedule/catalog"], [teacher, "/staff/schedule/catalog"]] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Все расписания", exact: true })).toBeVisible();
      await expect(page.locator(".schedule-catalog-list li")).toHaveCount(catalog.groups.length);
      await expect(page.locator(".schedule-search li")).toHaveCount(catalog.teachers.length);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`${path.split("/")[1]}-catalog.png`), fullPage: true });
    }
    const personalContext = await (await student.request.get("/api/schedule/context")).json();
    const week = weekOf(dateKey(new Date()));
    const period = `start=${week[0]}&end=${week[6]}&category=lesson`;
    const mine = await (await student.request.get(`/api/schedule/mine?${period}&groupId=forged`)).json();
    expect(mine.events.length).toBeGreaterThan(0);
    expect(mine.events.every((e: any) => e.groupId === personalContext.groupId)).toBe(true);
    const otherGroup = catalog.groups.find((g: any) => g.id !== personalContext.groupId);
    await student.getByRole("link", { name: otherGroup.name, exact: true }).click();
    await expect(student.getByRole("heading", { name: `Расписание группы ${otherGroup.name}`, exact: true })).toBeVisible();
    await student.goto(`/student/schedule?view=week&week=${week[0]}`);
    await expect(student.getByRole("heading", { name: "Моё расписание", exact: true })).toBeVisible();
    await expect(student.locator(".schedule-row")).toHaveCount(mine.events.length);
    const owned = await (await teacher.request.get(`/api/schedule/teacher/mine?${period}&teacherId=forged`)).json();
    expect(owned.events.length).toBeGreaterThan(0);
    expect(owned.events.every((e: any) => e.teacherId === owned.teacherId)).toBe(true);
    await teacher.goto(`/staff/schedule?view=week&week=${week[0]}`);
    await expect(teacher.getByRole("heading", { name: "Моё расписание", exact: true })).toBeVisible();
    await expect(teacher.locator(".schedule-row")).toHaveCount(owned.events.length);
    await teacher.goto(`/staff/schedule/edit?week=${week[0]}`);
    await expect(teacher.locator(".schedule-staff-list article")).toHaveCount(owned.events.length);
    const ownIds = new Set(owned.events.map((e: any) => e.id));
    const events = await (await teacher.request.get(`/api/schedule/catalog/events?kind=group&id=${personalContext.groupId}&${period}`)).json();
    const foreign = events.find((e: any) => e.teacherId && !ownIds.has(e.id));
    expect(foreign).toBeTruthy();
    await expect(teacher.locator(`#lesson-${foreign.id}`)).toHaveCount(0);
    const token = await (await teacher.request.get("/api/identity/csrf")).json();
    const denied = await teacher.request.put(`/api/schedule/${foreign.id}`, { headers: { "X-CSRF-TOKEN": token.token }, data: {
      startsAt: foreign.startsAt, endsAt: foreign.endsAt, room: foreign.room, teacher: foreign.teacher,
      address: foreign.location.address, building: foreign.location.building, floor: foreign.location.floor,
      cancelled: false, version: foreign.version,
    } });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe("schedule_not_owned");
    const teacherInfo = catalog.teachers.find((t: any) => t.id === owned.teacherId);
    await guest.goto(`/schedule/teachers/${owned.teacherId}?view=week&week=${week[0]}`);
    await expect(guest.getByRole("heading", { name: teacherInfo.name, exact: true })).toBeVisible();
    await expect(guest.locator(".schedule-row")).toHaveCount(owned.events.length);
    await guest.screenshot({ path: testInfo.outputPath("public-teacher-week.png"), fullPage: true });
  } finally {
    await guestContext.close(); await studentContext.close(); await teacherContext.close();
  }
});
