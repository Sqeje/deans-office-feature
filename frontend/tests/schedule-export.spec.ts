import { test, expect, type Page } from "./test";
import ExcelJS from "exceljs";
import { buildScheduleXlsx } from "../src/modules/schedule/export";
import { scheduleSource } from "../src/modules/schedule/source";
import { dateKey, type Entity } from "../src/modules/schedule/model";
import { mockScheduleCatalog } from "./schedule-catalog-http";

const instant = "2026-11-11T12:30:00+03:00";
const saveButton = (page: Page) => page.getByRole("button", { name: "Сохранить на устройство", exact: true });
async function open(page: Page, path: string, time = instant) {
  await mockScheduleCatalog(page);
  await page.route("**/api/notifications/student", r => r.fulfill({ json: { items: [], unreadCount: 0 } }));
  await page.route("**/api/identity/session", route => route.fulfill({ json: {
    userId: "demo", universityId: "demo", displayName: "Алексей Примеров", roles: ["Student"], studentId: "demo", permissions: [], areas: ["student"],
  } }));
  // Freeze Date only: JSZip must retain its asynchronous scheduling timers.
  await page.clock.setFixedTime(new Date(time));
  await page.goto(path);
  await expect(saveButton(page)).toBeEnabled();
}
async function download(page: Page, outputPath?: string) {
  const result = page.waitForEvent("download");
  await saveButton(page).click();
  const file = await result;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(await file.failure()).toBeNull();
  if (outputPath) await file.saveAs(outputPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  return { workbook, sheet: workbook.worksheets[0], filename: file.suggestedFilename() };
}

for (const entity of ["group", "teacher"] as const) {
  for (const mode of ["today", "week", "assessments"] as const) {
    test(`downloads real XLSX for ${entity} ${mode}`, async ({ page }, testInfo) => {
      const base = entity === "group" ? "/student/schedule/groups/pi-21" : "/student/schedule/teachers/lebedev";
      const query = mode === "today" ? "" : mode === "week" ? "?view=week&week=2026-11-16" : "?kind=assessments&view=week&week=2025-01-06";
      await open(page, base + query);
      const { workbook, sheet, filename } = await download(page, testInfo.outputPath("schedule.xlsx"));
      expect(workbook.worksheets).toHaveLength(1);
      expect(sheet.getCell("A1").text).toContain(entity === "group" ? "ПИ-21" : "Иван Викторович Лебедев");
      expect(sheet.getCell("A3").text).toBe("Общее расписание университета. Данные с сервера.");
      expect(sheet.getCell("A4").text).toContain("Московское время · UTC+3");
      expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
      const rows = Array.from({ length: sheet.rowCount - 6 }, (_, i) => sheet.getRow(i + 7));
      expect(rows).toHaveLength(mode === "today" ? 3 : mode === "week" ? 18 : entity === "teacher" ? 10 : 6);
      expect(rows.every(row => row.getCell(1).value instanceof Date)).toBe(true);
      expect(sheet.getCell("A6").text).toBe("День недели и дата");
      expect(rows.every(row => row.getCell(1).numFmt === "[$-419]dddd, dd.mm.yyyy")).toBe(true);
      expect(rows.every(row => row.getCell(2).numFmt === "hh:mm")).toBe(true);
      // The reader decodes Excel time fractions as Dates when the format is hh:mm.
      const dates = rows.map(row => (row.getCell(1).value as Date).toISOString().slice(0, 10));
      if (mode === "today") {
        expect(new Set(dates)).toEqual(new Set(["2026-11-11"]));
        expect(sheet.getCell("A2").text).toContain("среда, 11 ноября 2026");
        expect(rows.some(row => row.getCell(9).text.includes("Сейчас"))).toBe(true);
        expect(filename).toContain("сегодня 2026-11-11");
        if (entity === "group") {
          expect(sheet.getCell("B7").value).toEqual(new Date("1899-12-30T12:10:00Z"));
          expect(sheet.getCell("J7").text).toBe("");
          expect(sheet.getCell("I8").text).toBe("Перенесено");
          expect(sheet.getCell("J8").text).toContain("13:00–14:30");
          expect(sheet.getCell("J8").text).toContain("Ауд. 301");
          expect(sheet.getCell("I9").text).toBe("Отменено");
          expect(sheet.getCell("D9").font.strike).toBe(true);
          expect(sheet.getCell("I9").font.strike).not.toBe(true);
          expect(sheet.getCell("J9").text).toBe("");
        }
      } else if (mode === "week") {
        expect(dates.every(day => day >= "2026-11-16" && day <= "2026-11-22")).toBe(true);
        expect(filename).toContain("неделя 2026-11-16–2026-11-22");
        expect(sheet.getCell("A2").text).toContain("понедельник, 16 ноября 2026");
        expect(sheet.getCell("A2").text).toContain("воскресенье, 22 ноября 2026");
        expect(rows.every(row => !row.getCell(9).text.includes("Сейчас"))).toBe(true);
      } else {
        expect(sheet.getCell("A2").text).toContain("Контрольные и экзамены за семестр");
        expect(sheet.getCell("A2").text).toContain("31 января 2027");
        expect(filename).toContain("2026-09-01–2027-01-31");
        expect(dates.every(day => day >= "2026-09-01" && day <= "2027-01-31")).toBe(true);
        expect(dates.some(day => day < "2026-11-11")).toBe(true);
        expect(dates.some(day => day > "2026-11-11")).toBe(true);
        expect(rows.every(row => row.getCell(9).text === "По расписанию")).toBe(true);
        expect(rows.every(row => !row.getCell(4).font.strike)).toBe(true);
      }
      if (entity === "teacher") expect(new Set(rows.map(row => row.getCell(8).text)).size).toBeGreaterThan(1);
      else expect(rows.every(row => row.getCell(8).text === "ПИ-21")).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("schedule-export.png"), animations: "disabled" });
    });
  }
}

test("empty today exports a valid workbook with the selected date, also in another timezone", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  await open(page, "/student/schedule/groups/pi-21", "2026-11-15T00:30:00+03:00");
  const { sheet, filename } = await download(page);
  expect(filename).toContain("2026-11-15");
  expect(sheet.getCell("A7").text).toBe("В выбранный период занятий нет");
  expect(sheet.getCell("A2").text).toContain("15 ноября 2026");
  expect(sheet.getCell("A2").text).toContain("воскресенье");
  await context.close();
});

test("XLSX scopes events, preserves previous values and keeps formula-looking text literal", async () => {
  const entity: Entity = { kind: "group", id: "pi-21" };
  const all = await scheduleSource({ entity, category: "lesson", start: "2026-11-09", end: "2026-11-15" }, new AbortController().signal);
  const event = { ...all[0], title: '=HYPERLINK("https://example.invalid")', teacher: "Новый преподаватель", room: "Ауд. 100", startsAt: "2026-11-11T14:00:00+03:00", endsAt: "2026-11-11T15:30:00+03:00", change: {
    status: "rescheduled" as const, startsAt: all[0].startsAt, endsAt: all[0].endsAt, room: all[0].room, teacher: all[0].teacher, location: all[0].location,
  } };
  const { blob } = await buildScheduleXlsx({ entity, category: "lesson", mode: "today", start: "2026-11-11", end: "2026-11-11", now: new Date(instant), events: [
    event, all[0], { ...event, groupId: "pi-22" }, { ...event, category: "assessment" },
  ] });
  expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(7);
  expect(sheet.getCell("D7").value).toBe(event.title);
  expect(sheet.getCell("D7").type).toBe(ExcelJS.ValueType.String);
  expect(sheet.getCell("J7").text).toContain("9 ноября 2026");
  expect(sheet.getCell("J7").text).toContain(all[0].teacher);
  expect(sheet.getCell("I7").text).toBe("Перенесено");
  expect(dateKey(sheet.getCell("A7").value as Date)).toBe("2026-11-11");
});

test("a failed download shows an error and allows retry", async ({ page }) => {
  await open(page, "/student/schedule/groups/pi-21");
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { URL.createObjectURL = create; throw new Error("test download failure"); };
  });
  await saveButton(page).click();
  await expect(page.getByRole("alert")).toHaveText("Не удалось сохранить XLSX. Попробуйте ещё раз.");
  await expect(saveButton(page)).toBeEnabled();
  await download(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
