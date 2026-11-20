import ExcelJS from "exceljs";
import { groups, teachers } from "./catalog";
import { assessmentOutcome, changedFields, dateKey, formatDay, formatTime, isCurrent, type Entity, type ScheduleEvent } from "./model";

export interface ScheduleExport {
  entity: Entity;
  events: ScheduleEvent[];
  category: "lesson" | "assessment";
  mode: "today" | "week";
  start: string;
  end: string;
  now: Date;
}
interface ScheduleFile { blob: Blob; filename: string }
const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const dateLabel = (day: string) => formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const place = (event: Pick<ScheduleEvent, "room" | "location">) =>
  `${event.location.address} · корп. ${event.location.building} · ${event.room} · ${event.location.floor} этаж`;

function previousValues(event: ScheduleEvent) {
  const change = event.change;
  if (change.status !== "rescheduled") return "";
  const changed = changedFields(event);
  const values: string[] = [];
  if (changed.time) values.push(`${dateLabel(dateKey(new Date(change.startsAt)))}, ${formatTime(change.startsAt)}–${formatTime(change.endsAt)}`);
  if (changed.room) values.push(change.location ? place({ room: change.room, location: change.location }) : change.room);
  if (changed.teacher) values.push(change.teacher);
  return values.join("\n");
}

// Excel dates are timezone-free. Encode the Moscow wall clock, not the browser's zone.
function excelDate(instant: string) {
  const day = dateKey(new Date(instant));
  return new Date(`${day}T00:00:00Z`);
}
function excelTime(instant: string) {
  const [hour, minute] = formatTime(instant).split(":").map(Number);
  return (hour * 60 + minute) / (24 * 60);
}

export async function buildScheduleXlsx(schedule: ScheduleExport): Promise<ScheduleFile> {
  const { entity, category, mode, start, end, now } = schedule;
  const name = entity.name ?? (entity.kind === "group" ? groups.find(g => g.id === entity.id)?.name : teachers.find(t => t.id === entity.id)?.name);
  if (!name) throw new Error("Unknown schedule entity");
  const title = entity.kind === "group" ? `Расписание группы ${name}` : `Расписание преподавателя: ${name}`;
  const period = category === "assessment" ? "Контрольные и экзамены за семестр" : mode === "today" ? "Занятия на сегодня" : "Занятия на выбранную неделю";
  const range = start === end ? dateLabel(start) : `${dateLabel(start)} – ${dateLabel(end)}`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Деканат";
  workbook.created = now;
  workbook.title = title;
  const origin = entity.personal
    ? entity.isDemo ? "Демонстрационные данные — сохранены на сервере для учебного профиля." : entity.kind === "teacher" ? "Расписание преподавателя. Данные с сервера." : "Расписание учебной группы. Данные с сервера."
    : entity.serverBacked ? "Общее расписание университета. Данные с сервера." : "Демонстрационные данные — не связаны с вашим профилем.";
  workbook.subject = `${period}: ${range}. ${origin}`;
  const sheet = workbook.addWorksheet("Расписание", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, printTitlesRow: "1:6" },
  });
  const headers = ["День недели и дата", "Начало", "Окончание", "Название", "Вид занятия", "Место проведения", "Преподаватель", "Группа", "Статус", "Было до переноса"];
  const widths = [32, 11, 13, 36, 24, 42, 32, 14, 20, 48];
  sheet.columns = widths.map(width => ({ width }));
  for (const [index, text] of [title, `${period}: ${range}`, origin, `Московское время · UTC+3. Состояние на ${dateLabel(dateKey(now))}, ${formatTime(now.toISOString())}.`].entries()) {
    sheet.mergeCells(index + 1, 1, index + 1, headers.length);
    const cell = sheet.getCell(index + 1, 1);
    cell.value = text;
    cell.font = { name: "Arial", size: index === 0 ? 16 : 11, bold: index < 2, color: { argb: index === 2 ? "FF805300" : "FF111318" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(index + 1).height = index === 0 ? 32 : 28;
  }
  const header = sheet.getRow(6);
  header.values = headers;
  header.height = 32;
  header.eachCell(cell => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0057E7" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });

  // Scope defensively as well as using the view's already-filtered snapshot.
  const events = schedule.events.filter(event => {
    const day = dateKey(new Date(event.startsAt));
    return event.category === category && day >= start && day <= end
      && (entity.kind === "group" ? event.groupId === entity.id : event.teacherId === entity.id);
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  for (const event of events) {
    const outcome = assessmentOutcome(event, now);
    const current = isCurrent(event, now);
    const change = event.change.status;
    const statuses = [change === "cancelled" ? "Отменено" : change === "rescheduled" ? "Перенесено" : "По расписанию"];
    if (current) statuses.push("Сейчас");
    if (outcome) statuses.push(outcome === "passed" ? "Сдано" : outcome === "absent" ? "Неявка" : "Не сдано");
    const row = sheet.addRow([
      excelDate(event.startsAt), excelTime(event.startsAt), excelTime(event.endsAt),
      event.title, event.kind, place(event), event.teacher,
      event.groupName ?? groups.find(g => g.id === event.groupId)?.name ?? event.groupId,
      statuses.join("\n"), previousValues(event) || null,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Arial", size: 11, color: { argb: "FF111318" },
        strike: column <= 8 && (change === "cancelled" || outcome === "passed"),
        bold: outcome === "absent" || outcome === "failed" };
      cell.alignment = { wrapText: true, vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDEDDE3" } } };
      if (current) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5EEFF" } };
    });
    // Russian weekday names even when the spreadsheet viewer uses another locale.
    // Keep a real Excel date, so sorting and editing still work as dates.
    row.getCell(1).numFmt = "[$-419]dddd, dd.mm.yyyy";
    row.getCell(1).alignment = { ...row.getCell(1).alignment, horizontal: "left" };
    row.getCell(2).numFmt = row.getCell(3).numFmt = "hh:mm";
    const changed = changedFields(event);
    for (const column of [1, 2, 3, 6, 7]) {
      if ((column <= 3 && changed.time) || (column === 6 && changed.room) || (column === 7 && changed.teacher)) {
        row.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4D6" } };
      }
    }
    const status = row.getCell(9);
    status.font = { ...status.font, bold: true, color: { argb: change === "cancelled" || outcome === "absent" || outcome === "failed" ? "FFB42318" : outcome === "passed" ? "FF246338" : change === "rescheduled" ? "FF805300" : "FF111318" } };
    // Explicit wrapped heights also work in readers without automatic row fitting.
    let lines = 1;
    row.eachCell((cell, column) => {
      if (typeof cell.value === "string") lines = Math.max(lines, ...cell.value.split("\n").map(line => Math.max(1, Math.ceil(line.length / (widths[column - 1] - 2)))));
    });
    row.height = Math.max(48, lines * 16 + 12);
  }
  if (events.length) sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: sheet.rowCount, column: headers.length } };
  else {
    sheet.mergeCells("A7:J7");
    sheet.getCell("A7").value = category === "assessment" ? "В этом семестре контрольных и экзаменов нет" : "В выбранный период занятий нет";
    sheet.getCell("A7").font = { name: "Arial", size: 11 };
    sheet.getRow(7).height = 32;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = category === "assessment" ? "контрольные и экзамены" : mode === "today" ? "сегодня" : "неделя";
  const filename = `Расписание ${name} — ${suffix} ${start}${end === start ? "" : `–${end}`}.xlsx`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return { filename, blob: new Blob([new Uint8Array(buffer)], { type: mime }) };
}

export function downloadSchedule({ blob, filename }: ScheduleFile) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // Let the browser start reading the Blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
