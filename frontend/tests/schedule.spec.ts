import { test, expect, type Page as BrowserPage, type Locator } from "./test";
import { addDays, changedFields, dateKey, isCurrent, lessonsForDay, assessmentOutcome, semesterOf, validDate, weekOf, type Lesson } from "../src/modules/schedule/model";
import { scheduleSource } from "../src/modules/schedule/source";
import { groups, searchTeachers } from "../src/modules/schedule/catalog";
import { mockScheduleCatalog } from "./schedule-catalog-http";
const wednesday = "2026-11-11T12:30:00+03:00";
const sample: Lesson = {
  id: "one", title: "Предмет", kind: "Лекция", room: "Ауд. 1", teacher: "Преподаватель",
  startsAt: "2026-11-11T12:10:00+03:00", endsAt: "2026-11-11T13:40:00+03:00", change: { status: "scheduled" },
};
async function session(page: BrowserPage) {
  await mockScheduleCatalog(page);
  await page.route("**/api/notifications/student", r => r.fulfill({ json: { items: [], unreadCount: 0 } }));
  await page.route("**/api/identity/session", route => route.fulfill({ json: {
    userId: "demo", universityId: "demo", displayName: "Алексей Примеров", roles: ["Student"], studentId: "demo", permissions: [], areas: ["student"],
  } }));
  await page.route("**/api/schedule/context", r => r.fulfill({ json: { groupId: "personal", groupName: "ПИ-21", timeZone: "Europe/Moscow", isDemo: true } }));
  await page.route("**/api/schedule/mine?*", r => r.fulfill({ json: { groupId: "personal", groupName: "ПИ-21", timeZone: "Europe/Moscow", isDemo: true, events: [] } }));
  await page.route("**/api/schedule/next", r => r.fulfill({ json: { event: null, timeZone: "Europe/Moscow" } }));
}
async function openSchedule(page: BrowserPage, path = "/student/schedule", instant = wednesday) {
  if (path === "/student/schedule" || path.startsWith("/student/schedule?")) path = path.replace("/student/schedule", "/student/schedule/groups/pi-21");
  await session(page);
  await page.clock.install({ time: new Date(instant) });
  await page.clock.pauseAt(new Date(instant));
  await page.goto(path);
}
async function chooseMonth(calendar: Locator, value: string) {
  await calendar.getByLabel("Год", { exact: true }).selectOption(value.slice(0, 4));
  await calendar.getByLabel("Месяц", { exact: true }).selectOption(value.slice(5));
}
const period = (page: BrowserPage) => page.getByRole("group", { name: "Период занятий", exact: true });
const type = (page: BrowserPage) => page.getByRole("group", { name: "Тип событий", exact: true });
const nav = (page: BrowserPage) => page.getByRole("navigation", { name: "Разделы", exact: true });

test("current lesson uses actual half-open interval, cancellation and new rescheduled time", () => {
  expect(isCurrent(sample, new Date("2026-11-11T12:09:59+03:00"))).toBe(false);
  expect(isCurrent(sample, new Date(sample.startsAt))).toBe(true);
  expect(isCurrent(sample, new Date("2026-11-11T13:39:59+03:00"))).toBe(true);
  expect(isCurrent(sample, new Date(sample.endsAt))).toBe(false);
  expect(isCurrent({ ...sample, change: { status: "cancelled" } }, new Date(wednesday))).toBe(false);
  const moved: Lesson = { ...sample, startsAt: "2026-11-11T14:00:00+03:00", endsAt: "2026-11-11T15:30:00+03:00", change: { status: "rescheduled", startsAt: sample.startsAt, endsAt: sample.endsAt, room: "Ауд. 2", teacher: sample.teacher } };
  expect(isCurrent(moved, new Date(wednesday))).toBe(false);
  expect(isCurrent(moved, new Date("2026-11-11T14:30:00+03:00"))).toBe(true);
  expect(lessonsForDay([moved, sample], "2026-11-11").map(l => l.startsAt)).toEqual([sample.startsAt, moved.startsAt]);
});
test("calendar, semester boundaries and malformed dates are deterministic", () => {
  expect(dateKey(new Date("2026-11-11T21:00:00Z"))).toBe("2026-11-12");
  expect(weekOf("2027-01-01")[0]).toBe("2026-12-28");
  expect(weekOf("2026-11-15")[0]).toBe("2026-11-09");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(semesterOf("2027-01-31")).toEqual({ start: "2026-09-01", end: "2027-01-31" });
  expect(semesterOf("2027-02-01")).toEqual({ start: "2027-02-01", end: "2027-08-31" });
  expect(semesterOf("2026-08-31")).toEqual({ start: "2026-02-01", end: "2026-08-31" });
  expect(semesterOf("2026-09-01")).toEqual({ start: "2026-09-01", end: "2027-01-31" });
  for (const date of ["2026-02-31", "no-date", "0099-01-01", "2026-13-01"]) expect(validDate(date)).toBe(false);
});
test("canonical source shares group events with teachers and respects semester and cancellation", async () => {
  const signal = new AbortController().signal;
  for (const category of ["lesson", "assessment"] as const) {
    const range = category === "lesson" ? { start: "2026-11-09", end: "2026-11-15" } : semesterOf("2026-11-11");
    const group = await scheduleSource({ entity: { kind: "group", id: "pi-21" }, category, ...range }, signal);
    const teacher = await scheduleSource({ entity: { kind: "teacher", id: "lebedev" }, category, ...range }, signal);
    for (const event of group.filter(e => e.teacherId === "lebedev")) expect(teacher.find(e => e.id === event.id)).toEqual(event);
    expect(new Set(teacher.map(e => e.id)).size).toBe(teacher.length);
    expect(new Set(teacher.map(e => e.groupId)).size).toBeGreaterThan(1);
    expect(group.every(e => dateKey(new Date(e.startsAt)) >= range.start && dateKey(new Date(e.startsAt)) <= range.end)).toBe(true);
    if (category === "assessment") {
      expect(new Set(group.map(e => e.kind))).toEqual(new Set(["Контрольная работа", "Зачёт", "Экзамен"]));
      expect(group.some(e => e.startsAt < wednesday)).toBe(true);
      expect(group.some(e => e.startsAt > wednesday)).toBe(true);
    }
  }
  const controller = new AbortController(); controller.abort();
  await expect(scheduleSource({ entity: { kind: "group", id: "pi-21" }, category: "lesson", start: "2026-11-09", end: "2026-11-15" }, controller.signal)).rejects.toThrow();
  expect(searchTeachers("  ЛЕБЕДЕВ ").map(t => t.id)).toEqual(["lebedev"]);
  expect(searchTeachers("И.В. Лебедев").map(t => t.id)).toEqual(["lebedev"]);
  expect(searchTeachers("Никто")).toEqual([]);
});

test("today, full week, changes, Sunday and history", async ({ page }) => {
  await openSchedule(page);
  await expect(page.getByRole("heading", { name: "Расписание группы ПИ-21", exact: true })).toBeVisible();
  await expect(page.locator(".schedule-row")).toHaveCount(3);
  await expect(page.getByText("Сейчас", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Перенесено", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Отменено", { exact: true })).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator(".schedule-place").first()).toContainText("ул. Учебная, 10 · корп. 1 · Ауд. 305 · 3 этаж");
  await period(page).getByRole("button", { name: "Неделя", exact: true }).click();
  await expect(page.locator(".schedule-day-title")).toHaveCount(7);
  await expect(page.locator(".schedule-row")).toHaveCount(18);
  await expect(page.getByText("В этот день занятий нет", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /Следующая неделя/ }).click();
  await expect(page).toHaveURL(/week=2026-11-16/);
  await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-16");
  await page.reload();
  await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-16");
  await page.getByRole("button", { name: /Предыдущая неделя/ }).click();
  await expect(page).toHaveURL(/week=2026-11-09/);
  await page.goBack();
  await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-16");
  await period(page).getByRole("button", { name: "Сегодня", exact: true }).click();
  await expect(page.locator(".schedule-day-title time")).toHaveCount(1);
  await expect(page.locator(".schedule-day-title time")).toHaveAttribute("datetime", "2026-11-11");
});

test("flat server catalog keeps group navigation separate from the personal schedule", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSchedule(page, "/student/schedule/catalog");
  await page.getByRole("button", { name: "Подразделы расписания", exact: true }).click();
  await expect(nav(page).getByRole("link", { name: "Все расписания", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".schedule-catalog-list li")).toHaveCount(groups.length);
  await page.getByRole("link", { name: "ПИ-22", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Расписание группы ПИ-22" })).toBeVisible();
  await expect(page.locator(".schedule-row")).toHaveCount(1);
  await page.getByRole("navigation", { name: "Путь расписания" }).getByRole("link", { name: "Все расписания", exact: true }).click();
  await page.getByRole("link", { name: "ПИ-21", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/schedule\/groups\/pi-21$/);
  await expect(nav(page).getByRole("link", { name: "Все расписания", exact: true })).toHaveAttribute("aria-current", "page");
  for (const group of groups.filter(g => g.id !== "pi-21")) {
    await page.goto(`/student/schedule/groups/${group.id}`);
    await expect(page.getByRole("heading", { name: `Расписание группы ${group.name}` })).toBeVisible();
  }
  await page.goto("/student/schedule/groups/pi-21?view=week");
  await expect(page).toHaveURL(/\/student\/schedule\/groups\/pi-21\?view=week$/);
});

test("teacher search filters full names as typed and preserves query through navigation and reload", async ({ page }) => {
  await openSchedule(page, "/student/schedule/catalog");
  const input = page.getByRole("textbox", { name: "Поиск преподавателя" });
  await input.fill("ЛЕБЕДЕВ");
  await expect(page.locator(".schedule-search li")).toHaveCount(1);
  await expect(page).toHaveURL(/q=/);
  await input.fill("нет такого преподавателя");
  await expect(page.getByText("Преподаватели не найдены.")).toBeVisible();
  await input.fill("");
  await expect(page.locator(".schedule-search li")).toHaveCount(3);
  await input.fill("Иван Викторович");
  await page.locator(".schedule-search").getByRole("link", { name: "Иван Викторович Лебедев", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Иван Викторович Лебедев", exact: true })).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue("Иван Викторович");
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Иван Викторович Лебедев", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← К поиску преподавателя" }).click();
  await expect(input).toHaveValue("Иван Викторович");
  await page.reload();
  await expect(input).toHaveValue("Иван Викторович");
  await expect(page.locator(".schedule-search li")).toHaveCount(1);
});

test("teacher card opens first, Escape restores focus; teacher week shows multiple groups", async ({ page }) => {
  await openSchedule(page);
  const teacher = page.getByRole("button", { name: "И. В. Лебедев", exact: true });
  await teacher.click();
  await expect(page.getByRole("group", { name: "Карточка: Иван Викторович Лебедев" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Посмотреть расписание →" })).toBeFocused();
  const card = await page.getByRole("group", { name: "Карточка: Иван Викторович Лебедев" }).boundingBox();
  expect(card!.x).toBeGreaterThanOrEqual(0);
  expect(card!.x + card!.width).toBeLessThanOrEqual(360);
  await page.getByRole("group", { name: "Карточка: Иван Викторович Лебедев" }).screenshot({ path: "test-results/schedule-teacher-card-mobile.png", animations: "disabled" });
  await page.keyboard.press("Escape"); await expect(teacher).toBeFocused();
  await teacher.click(); await page.getByRole("heading", { name: "Расписание группы ПИ-21" }).click();
  await expect(page.getByRole("group", { name: /Карточка:/ })).toHaveCount(0);
  await teacher.click(); await page.getByRole("link", { name: "Посмотреть расписание →" }).click();
  await expect(page.getByRole("heading", { name: "Иван Викторович Лебедев", exact: true })).toBeVisible();
  await expect(page.locator(".schedule-row")).toHaveCount(3);
  await period(page).getByRole("button", { name: "Неделя", exact: true }).click();
  await expect(page.locator(".schedule-day-title")).toHaveCount(7);
  await expect(page.locator(".schedule-row")).toHaveCount(18);
  await expect(page.getByRole("link", { name: "Группа ПИ-21", exact: true })).toHaveCount(6);
  await page.screenshot({ path: "test-results/schedule-teacher-week-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "← К поиску преподавателя" }).click();
  await expect(page.getByRole("textbox", { name: "Поиск преподавателя" })).toHaveValue("Иван Викторович Лебедев");
});

test("assessments include all current semester dates, hide period controls and restore lesson mode", async ({ page }) => {
  await openSchedule(page, "/student/schedule?view=week&week=2026-11-16");
  await type(page).getByRole("button", { name: "Контрольные и экзамены", exact: true }).click();
  await expect(period(page)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Навигация по неделям" })).toHaveCount(0);
  await expect(page.locator(".schedule-row")).toHaveCount(6);
  await expect(page.locator(".schedule-semester")).toContainText("1 сентября 2026");
  await expect(page.locator(".schedule-semester")).toContainText("31 января 2027");
  const dates = await page.locator(".schedule-day-title time").evaluateAll(nodes => nodes.map(n => n.getAttribute("datetime")!));
  expect(dates).toEqual([...dates].sort());
  expect(dates.some(d => d < "2026-11-11")).toBe(true);
  expect(dates.some(d => d > "2026-11-11")).toBe(true);
  await expect(page.getByText("В этот день занятий нет", { exact: true })).toHaveCount(0);
  await type(page).getByRole("button", { name: "Занятия", exact: true }).click();
  await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-16");
});

test("midnight, minute ticks, timezone and malformed query keep real Moscow dates", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  await openSchedule(page, "/student/schedule?kind=bad&view=oops&week=2026-02-31", "2026-11-11T13:39:00+03:00");
  await expect(page).toHaveURL(/\/student\/schedule\/groups\/pi-21$/);
  await expect(page.getByText("Сейчас", { exact: true })).toHaveCount(1);
  await page.clock.runFor(60_000); await expect(page.getByText("Сейчас", { exact: true })).toHaveCount(0);
  await page.clock.setSystemTime(new Date("2026-11-12T00:01:00+03:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".schedule-day-title time")).toHaveAttribute("datetime", "2026-11-12");
  await page.clock.setSystemTime(new Date("2026-11-16T00:01:00+03:00"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await period(page).getByRole("button", { name: "Неделя", exact: true }).click();
  await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-16");
  await context.close();
});

test("unknown route and entity IDs show catalog exit; legacy hierarchy routes open the flat catalog", async ({ page }) => {
  await session(page);
  for (const path of ["groups/missing", "teachers/missing", "unknown"]) {
    await page.goto(`/student/schedule/${path}`);
    await expect(page.getByRole("heading", { name: "Расписание не найдено" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть каталог" })).toBeVisible();
  }
  for (const path of ["catalog/economics/applied-informatics", "catalog/informatics/applied-informatics/2099"]) {
    await page.goto(`/student/schedule/${path}`);
    await expect(page.getByRole("heading", { name: "Все расписания", exact: true })).toBeVisible();
    await expect(page.locator(".schedule-catalog-list li")).toHaveCount(groups.length);
  }
});

// Dependency injection exercises loading/retry and out-of-order responses without fake HTTP.
async function controlled(page: BrowserPage) {
  await page.route("**/api/identity/session", r => r.fulfill({ status: 401 }));
  await page.goto("/login");
  await page.evaluate(async () => {
    const harnessPath = "/tests/schedule-harness.tsx";
    const { mountControlled } = await import(harnessPath);
    const host = document.createElement("div"); host.id = "schedule-test";
    host.style.padding = "16px"; document.body.append(host);
    Object.assign(window, { scheduleTest: mountControlled(host) });
  });
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(1);
  return page.locator("#schedule-test");
}
declare global { interface Window { scheduleTest: { count(): number; reject(i: number): void; resolve(i: number, empty?: boolean, long?: boolean): Promise<void>; jump(value: string): void; aborted(i: number): boolean } } }

test("source loading, failure, retry, empty assessment and stale week protection", async ({ page }) => {
  const host = await controlled(page);
  await host.getByRole("button", { name: "Дополнительные действия", exact: true }).click();
  await expect(host.getByRole("status")).toHaveText("Загружаем расписание…");
  await expect(host.getByRole("button", { name: "Сохранить на устройство" })).toBeDisabled();
  await page.evaluate(() => window.scheduleTest.reject(0));
  await expect(host.getByRole("alert")).toContainText("Не удалось загрузить расписание");
  await expect(host.getByRole("button", { name: "Сохранить на устройство" })).toBeDisabled();
  await host.getByRole("button", { name: "Повторить" }).click();
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(2);
  await page.evaluate(() => window.scheduleTest.resolve(1));
  await expect(host.locator(".schedule-row")).toHaveCount(3);
  await expect(host.getByRole("button", { name: "Сохранить на устройство" })).toBeEnabled();
  await host.getByRole("button", { name: "Неделя", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(3);
  await host.getByRole("button", { name: /Следующая неделя/ }).click();
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(4);
  expect(await page.evaluate(() => window.scheduleTest.aborted(2))).toBe(true);
  await host.getByRole("button", { name: /Следующая неделя/ }).click();
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(5);
  expect(await page.evaluate(() => window.scheduleTest.aborted(3))).toBe(true);
  await page.evaluate(() => window.scheduleTest.resolve(4));
  await expect(host.locator(".schedule-row")).toHaveCount(18);
  await page.evaluate(() => window.scheduleTest.resolve(2, true));
  await page.evaluate(() => window.scheduleTest.resolve(3, true));
  await expect(host.locator(".schedule-row")).toHaveCount(18);
  await expect(host.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-11-23");
  await host.getByRole("button", { name: "Контрольные и экзамены", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scheduleTest.count())).toBe(6);
  await page.evaluate(() => window.scheduleTest.resolve(5, true));
  await expect(host.getByRole("heading", { name: "В этом семестре контрольных и экзаменов нет" })).toBeVisible();
});

for (const width of [360, 390, 768, 1024, 1280, 1440]) {
  test(`responsive catalog, full week, controls and screenshots ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await openSchedule(page, "/student/schedule?view=week");
    await expect(page.locator(".schedule-row")).toHaveCount(18);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const save = page.getByRole("button", { name: "Сохранить на устройство", exact: true });
    const actions = page.getByRole("button", { name: "Дополнительные действия", exact: true });
    if (width < 768) {
      await expect(actions).toHaveAttribute("aria-expanded", "false");
      await expect(save).toBeHidden();
      const lesson = await page.locator(".schedule-row h3").first().boundingBox();
      const mobileNav = await nav(page).boundingBox();
      expect(lesson!.y + lesson!.height).toBeLessThan(mobileNav!.y);
      await actions.click();
      await expect(actions).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(actions).toBeHidden();
    }
    const saveBox = await save.boundingBox(), headerBox = await page.locator(".schedule-view-header").boundingBox();
    expect(saveBox!.height).toBeGreaterThanOrEqual(44);
    expect(saveBox!.x + saveBox!.width).toBeCloseTo(headerBox!.x + headerBox!.width, 0);
    if (width < 768) await actions.click();
    if (width < 1024) await expect(nav(page).getByRole("link")).toHaveCount(5);
    else {
      await page.getByRole("button", { name: "Подразделы расписания", exact: true }).click();
      await expect(nav(page).getByRole("link", { name: "Все расписания", exact: true })).toHaveAttribute("aria-current", "page");
      await page.getByRole("button", { name: "Подразделы расписания", exact: true }).click();
      await expect(nav(page).getByRole("link", { name: "Моё расписание", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Подразделы расписания", exact: true }).click();
    }
    for (const frame of await page.locator(".schedule-modes").all()) {
      const sizes = await frame.evaluate(element => {
        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
        const buttons = Array.from(element.querySelectorAll("button"));
        const boxes = buttons.map(b => b.getBoundingClientRect());
        return { inner: rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth), widths: boxes.map(b => b.width), seam: boxes[1].left - boxes[0].right, radii: buttons.map(b => getComputedStyle(b).borderRadius) };
      });
      expect(sizes.widths[0]).toBeCloseTo(sizes.inner / 2, 1); expect(sizes.widths[1]).toBeCloseTo(sizes.inner / 2, 1);
      expect(sizes.seam).toBe(0); expect(sizes.radii).toEqual(["0px", "0px"]);
    }
    if (width >= 1024) {
      const columns = await page.locator(".schedule-day-table").first().evaluate(table => {
        const headers = Array.from(table.querySelectorAll(".schedule-table-labels > span")).map(n => n.getBoundingClientRect().x);
        const row = table.querySelector(".schedule-row")!;
        const cells = [".schedule-time", ".schedule-details", ".schedule-place", ".schedule-person"].map(selector => row.querySelector(selector)!.getBoundingClientRect().x);
        return { headers, cells };
      });
      expect(columns.cells).toEqual(columns.headers);
    }
    await page.screenshot({ path: `test-results/schedule-week-${width}.png`, fullPage: true, animations: "disabled" });
    await type(page).getByRole("button", { name: "Контрольные и экзамены", exact: true }).click();
    await expect(page.locator(".schedule-row")).toHaveCount(6);
    if (width >= 1024) {
      const ranges = await page.locator(".schedule-time").evaluateAll(elements => elements.map(element => {
        const times = element.querySelectorAll("time");
        return [times[0].getBoundingClientRect().y, times[1].getBoundingClientRect().y];
      }));
      expect(ranges.every(([start, end]) => start === end)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/schedule-assessments-${width}.png`, fullPage: true, animations: "disabled" });
    await page.goto("/student/schedule/catalog");
    await expect(page.locator(".schedule-catalog-list li")).toHaveCount(groups.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/schedule-catalog-${width}.png`, fullPage: true, animations: "disabled" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    if (width < 1024) {
      const footer = await page.locator(".cabinet-main > footer").boundingBox(), menu = await nav(page).boundingBox();
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(menu!.y);
    }
  });
}

test("long text, enlarged text and keyboard focus remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const host = await controlled(page);
  await page.evaluate(() => window.scheduleTest.resolve(0, false, true));
  await expect(host.locator(".schedule-row")).toHaveCount(3);
  await page.addStyleTag({ content: "#schedule-test { font-size: 200%; } #schedule-test * { font-size: inherit; line-height: 1.5; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const today = host.getByRole("button", { name: "Сегодня", exact: true });
  await today.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(today).toBeFocused(); await expect(today).toHaveCSS("outline-width", "2px");
  await host.screenshot({ path: "test-results/schedule-long-text-200.png" });
});

test("anonymous access and real login through existing home link", async ({ page }) => {
  await page.goto("/student/schedule/catalog"); await expect(page).toHaveURL(/login/);
  const password = process.env.DEMO_PASSWORD1; if (!password) throw new Error("Set DEMO_PASSWORD1");
  await page.getByLabel("Электронная почта").fill("student1@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("link", { name: "Перейти в расписание" }).click();
  await expect(page.getByRole("heading", { name: "Моё расписание", exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText(/Демонстрационное расписание — сохранено на сервере/)).toBeVisible();
});
test("only actual changed fields are selected, comparing instants rather than offset strings", () => {
  const previous = { status: "rescheduled" as const, startsAt: sample.startsAt, endsAt: sample.endsAt, room: sample.room, teacher: sample.teacher };
  expect(changedFields({ ...sample, change: previous })).toEqual({ time: false, room: false, teacher: false });
  expect(changedFields({ ...sample, change: { ...previous, startsAt: "2026-11-11T09:10:00Z", endsAt: "2026-11-11T10:40:00Z" } })).toEqual({ time: false, room: false, teacher: false });
  expect(changedFields({ ...sample, room: "Ауд. 2", change: previous })).toEqual({ time: false, room: true, teacher: false });
  expect(changedFields({ ...sample, teacher: "Другой преподаватель", change: previous })).toEqual({ time: false, room: false, teacher: true });
  expect(changedFields({ ...sample, endsAt: "2026-11-11T14:00:00+03:00", change: previous })).toEqual({ time: true, room: false, teacher: false });
  expect(changedFields({ ...sample, change: { status: "cancelled" } })).toEqual({ time: false, room: false, teacher: false });
});

for (const width of [360, 1280]) {
  test(`cancelled text is struck and only modified fields have yellow backgrounds ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/identity/session", r => r.fulfill({ status: 401 }));
    await page.goto("/login");
    await page.evaluate(async (sample) => {
      const reactPath = "/node_modules/.vite/deps/react.js";
      const rootPath = "/node_modules/.vite/deps/react-dom_client.js";
      // Reuse Vite's versioned module URL so the wrapper and row share Router contexts.
      const routerPath = performance.getEntriesByType("resource").map(entry => entry.name)
        .find(url => new URL(url).pathname.endsWith("/react-router-dom.js"));
      if (!routerPath) throw new Error("Router module was not loaded");
      const componentPath = "/src/modules/schedule/Page.tsx";
      const rm = await import(reactPath), React = rm.default ?? rm;
      const dm = await import(rootPath), { ScheduleRow } = await import(componentPath);
      const { MemoryRouter } = await import(routerPath);
      const previous = { status: "rescheduled", startsAt: sample.startsAt, endsAt: sample.endsAt, room: sample.room, teacher: sample.teacher };
      const lessons = [
        { ...sample, title: "Только время", startsAt: "2026-11-11T14:00:00+03:00", endsAt: "2026-11-11T15:30:00+03:00", change: previous },
        { ...sample, title: "Только аудитория", room: "Ауд. 2", change: previous },
        { ...sample, title: "Только преподаватель", teacher: "Новый преподаватель", change: previous },
        { ...sample, title: "Без изменений", change: previous },
        { ...sample, title: "Все изменения", room: "Ауд. 2", teacher: "Новый преподаватель", endsAt: "2026-11-11T15:30:00+03:00", change: previous },
        { ...sample, title: "Отменённое", change: { status: "cancelled" } },
      ];
      const host = document.createElement("div");
      host.id = "changed-fields-test";
      host.style.padding = "16px";
      document.body.append(host);
      (dm.default ?? dm).createRoot(host).render(React.createElement(MemoryRouter, null,
        React.createElement("ul", { className: "schedule-list" }, lessons.map((lesson, i) => React.createElement(ScheduleRow, { key: i, lesson, now: new Date("2026-11-11T12:30:00+03:00") })))));
    }, sample);
    const host = page.locator("#changed-fields-test");
    await expect.poll(async () => ({ rows: await host.getByRole("listitem").count(), errors })).toEqual({ rows: 6, errors: [] });
    for (const [title, field, description, old] of [
      ["Только время", ".schedule-time", "Время изменено", "12:10–13:40"],
      ["Только аудитория", ".schedule-place", "Аудитория изменена", "Ауд. 1"],
      ["Только преподаватель", ".schedule-teacher", "Преподаватель изменён", "Преподаватель"],
    ]) {
      const row = host.getByRole("listitem").filter({ hasText: title });
      await expect(row.locator("mark")).toHaveCount(1);
      await expect(row.locator(`${field} mark`)).toHaveCSS("background-color", "rgb(255, 244, 214)");
      await expect(row.locator("mark .sr-only")).toContainText(description);
      await expect(row.locator(".schedule-previous")).toHaveText(`Было: ${old}`);
      await expect(row.getByRole("heading")).not.toHaveCSS("text-decoration-line", "line-through");
    }
    await expect(host.getByRole("listitem").filter({ hasText: "Без изменений" }).locator("mark, .schedule-previous")).toHaveCount(0);
    await expect(host.getByRole("listitem").filter({ hasText: "Все изменения" }).locator("mark")).toHaveCount(3);
    const cancelled = host.getByRole("listitem").filter({ hasText: "Отменённое" });
    for (const text of await cancelled.locator(".schedule-time, time, h3, .schedule-meta p").all()) {
      await expect(text).toHaveCSS("text-decoration-line", "line-through");
    }
    await expect(cancelled.getByText("Отменено", { exact: true })).toHaveCSS("text-decoration-line", "none");
    await expect(cancelled.getByText("Сейчас", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const positions = await host.evaluate(element => {
      const snapshot = () => Array.from(element.querySelectorAll(".schedule-time, .schedule-time time, h3, .schedule-meta p, .schedule-place")).map(node => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      });
      const marked = Array.from(element.querySelectorAll(".schedule-field-changed"));
      const highlighted = snapshot();
      marked.forEach(node => node.classList.remove("schedule-field-changed"));
      const plain = snapshot();
      marked.forEach(node => node.classList.add("schedule-field-changed"));
      return { highlighted, plain };
    });
    expect(positions.highlighted).toEqual(positions.plain);
    await host.screenshot({ path: `test-results/schedule-changed-fields-${width}.png` });
  });
}


test("assessment outcome appears at end, honours failed/absent and never marks future or cancelled as passed", () => {
  const event = { ...sample, category: "assessment" as const };
  expect(assessmentOutcome(event, new Date("2026-11-11T13:39:59+03:00"))).toBeNull();
  expect(assessmentOutcome(event, new Date(event.endsAt))).toBe("passed");
  expect(assessmentOutcome({ ...event, assessmentResult: "absent" }, new Date(event.endsAt))).toBe("absent");
  expect(assessmentOutcome({ ...event, assessmentResult: "failed" }, new Date(event.endsAt))).toBe("failed");
  expect(assessmentOutcome({ ...event, change: { status: "cancelled" } }, new Date(event.endsAt))).toBeNull();
  expect(assessmentOutcome(sample, new Date(sample.endsAt))).toBeNull();
  expect(assessmentOutcome({ ...event, serverBacked: true }, new Date(event.endsAt))).toBeNull();
});

test("only the arrow opens navigation and subitems include the arrow column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSchedule(page, "/student/schedule/catalog");
  const arrow = page.getByRole("button", { name: "Подразделы расписания", exact: true });
  const parent = nav(page).getByRole("link", { name: "Расписание", exact: true });
  await expect(arrow).toHaveAttribute("aria-expanded", "false");
  await parent.click();
  await expect(arrow).toHaveAttribute("aria-expanded", "false");
  await arrow.click();
  await expect(arrow).toHaveAttribute("aria-expanded", "true");
  const my = nav(page).getByRole("link", { name: "Моё расписание", exact: true });
  const all = nav(page).getByRole("link", { name: "Все расписания", exact: true });
  for (const item of [my, all]) {
    const p = await page.locator(".schedule-nav-parent").boundingBox(), box = await item.boundingBox();
    expect(box!.x).toBe(p!.x); expect(box!.x + box!.width).toBe(p!.x + p!.width);
    expect(await item.evaluate(element => getComputedStyle(element, "::before").width)).toBe("4px");
  }
  await all.click();
  const crumbs = page.getByRole("navigation", { name: "Путь расписания" });
  await expect(crumbs.getByRole("link", { name: "Главная", exact: true })).toHaveCount(0);
  await expect(crumbs.getByRole("link", { name: "Расписание", exact: true })).toHaveCount(0);
  await expect(crumbs.getByRole("link", { name: "Моё расписание", exact: true })).toHaveCount(0);
  await expect(arrow).toHaveAttribute("aria-expanded", "true");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Моё расписание", exact: true })).toBeVisible();
  await arrow.click(); await parent.click();
  await expect(arrow).toHaveAttribute("aria-expanded", "false");
  await arrow.click(); await all.click();
  await page.locator(".schedule-nav-entry").screenshot({ path: "test-results/schedule-submenu-aligned.png", animations: "disabled" });
});

for (const width of [360, 1280]) {
  test(`mini calendar picks any week, survives reload and closes with focus return ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSchedule(page, "/student/schedule?view=week");
    const trigger = page.getByRole("button", { name: "Выбрать неделю", exact: true });
    await trigger.click();
    const calendar = page.getByRole("dialog", { name: "Выбор недели", exact: true });
    await expect(calendar).toBeVisible();
    const box = await calendar.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await expect(calendar.getByRole("button", { name: /Неделя с 9 ноября 2026/ })).toBeFocused();
    await chooseMonth(calendar, "2027-01");
    await calendar.getByRole("button", { name: /Неделя с 4 января 2027.*10 января 2027/ }).click();
    await expect(calendar).toHaveCount(0); await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/week=2027-01-04/);
    await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2027-01-04");
    await page.reload(); await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2027-01-04");
    await trigger.click(); await page.keyboard.press("Escape");
    await expect(calendar).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByRole("heading", { name: "Расписание группы ПИ-21", exact: true }).click();
    await expect(calendar).toHaveCount(0);
    await trigger.click(); await calendar.getByRole("button", { name: "Следующий месяц", exact: true }).click();
    await expect(calendar.getByLabel("Месяц", { exact: true })).toHaveValue("02");
    await calendar.getByRole("button", { name: "Предыдущий месяц", exact: true }).click();
    await expect(calendar.getByLabel("Месяц", { exact: true })).toHaveValue("01");
    await calendar.screenshot({ path: `test-results/schedule-week-calendar-${width}.png`, animations: "disabled" });
    await calendar.getByRole("button", { name: "Закрыть календарь", exact: true }).click();
    await expect(trigger).toBeFocused();
    await page.goto("/student/schedule/teachers/lebedev?view=week");
    await trigger.click(); await chooseMonth(calendar, "2026-12");
    await calendar.getByRole("button", { name: /Неделя с 28 декабря 2026.*3 января 2027/ }).click();
    await expect(page).toHaveURL(/week=2026-12-28/);
    await expect(page.locator(".schedule-day-title time").first()).toHaveAttribute("datetime", "2026-12-28");
  });

  test(`server assessments never invent passed, absent or failed results ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSchedule(page, "/student/schedule?kind=assessments");
    await expect(page.getByRole("button", { name: "Контрольные и экзамены", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".schedule-row")).toHaveCount(6);
    const dates = await page.locator(".schedule-day-title time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")!));
    expect(dates.some(day => day < "2026-11-11")).toBe(true);
    expect(dates.some(day => day > "2026-11-11")).toBe(true);
    await expect(page.locator(".schedule-passed, .schedule-result-passed, .schedule-result-absent, .schedule-result-failed")).toHaveCount(0);
    for (const label of ["Сдано", "Неявка", "Не сдано"]) await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    for (const text of await page.locator(".schedule-row h3, .schedule-row time").all()) {
      await expect(text).toHaveCSS("text-decoration-line", "none");
    }
    await page.screenshot({ path: `test-results/schedule-assessment-results-${width}.png`, fullPage: true, animations: "disabled" });
  });
}


test("logo collapses schedule navigation from a nested route and when already home", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await session(page);
  await page.route("**/api/identity/me", r => r.fulfill({ json: { university: "Демонстрационный университет", group: "ЦД-101" } }));
  await page.goto("/student/schedule/catalog");
  const arrow = page.getByRole("button", { name: "Подразделы расписания", exact: true });
  const brand = page.locator(".cabinet-header .brand");
  await arrow.click(); await expect(arrow).toHaveAttribute("aria-expanded", "true");
  await brand.click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(arrow).toHaveAttribute("aria-expanded", "false");
  await expect(nav(page).getByRole("link", { name: "Все расписания", exact: true })).toHaveCount(0);
  await arrow.click(); await expect(arrow).toHaveAttribute("aria-expanded", "true");
  await brand.focus(); await page.keyboard.press("Enter");
  await expect(arrow).toHaveAttribute("aria-expanded", "false");
  await arrow.click(); await expect(arrow).toHaveAttribute("aria-expanded", "true");
});


for (const width of [360, 1280]) {
  test(`today has a clear badge in selected and unselected calendar weeks ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSchedule(page, "/student/schedule?view=week");
    const trigger = page.getByRole("button", { name: "Выбрать неделю", exact: true });
    await trigger.click();
    const calendar = page.getByRole("dialog", { name: "Выбор недели", exact: true });
    const today = calendar.locator('[aria-current="date"]');
    await expect(today).toHaveText("11");
    await expect(today).toHaveAttribute("title", /Сегодня, 11 ноября 2026/);
    await expect(today).toHaveCSS("background-color", "rgb(0, 87, 231)");
    await expect(today).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(today).toHaveCSS("border-radius", "50%");
    await expect(today).toHaveCSS("width", "30px");
    await expect(today.locator("..")).toHaveAttribute("aria-pressed", "true");
    await calendar.screenshot({ path: `test-results/schedule-today-selected-${width}.png`, animations: "disabled" });
    await calendar.getByRole("button", { name: /Неделя с 16 ноября 2026/ }).click();
    await trigger.click();
    await expect(today.locator("..")).toHaveAttribute("aria-pressed", "false");
    await expect(today).toHaveCSS("background-color", "rgb(0, 87, 231)");
    await expect(today).toHaveCSS("color", "rgb(255, 255, 255)");
    await calendar.screenshot({ path: `test-results/schedule-today-unselected-${width}.png`, animations: "disabled" });
  });
}
