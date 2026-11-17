import { test, expect } from "@playwright/test";
import { dateKey, weekOf } from "../src/modules/schedule/model";

for (const width of [360, 1280]) test(`room number field, formatted output and cancellation freeze ${width}`, async ({ page }, testInfo) => {
  if (!process.env.DEMO_STAFF_PASSWORD) throw new Error("Set DEMO_STAFF_PASSWORD");
  await page.setViewportSize({ width, height: 950 });
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill("staff@demo.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.DEMO_STAFF_PASSWORD);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
  const week = weekOf(dateKey(new Date()));
  const events = await (await page.request.get(`/api/schedule/staff?start=${week[0]}&end=${week[6]}&category=lesson`)).json();
  const original = events.filter((e: any) => e.groupName === "ПИ-22" && e.canEdit).at(-1);
  let version = original.version;
  const csrf = async () => ({ "X-CSRF-TOKEN": (await (await page.request.get("/api/identity/csrf")).json()).token });
  try {
    await page.goto("/staff/schedule/edit");
    const article = page.locator("article").filter({ has: page.locator(`#lesson-${original.id}`) });
    await article.getByRole("button", { name: "Изменить занятие", exact: true }).click();
    const form = page.getByRole("form", { name: "Изменение занятия" });
    const room = form.getByLabel("Аудитория", { exact: true });
    await expect(room).toHaveValue(original.room.replace(/^Ауд\.\s*/i, ""));
    await room.press("ControlOrMeta+A");
    await room.press("Backspace");
    await expect(room).toHaveValue("");
    await expect(form.getByText("Ауд.", { exact: true })).toHaveCount(0);
    await expect(room).toBeFocused();
    const bounds = await room.boundingBox(), label = await room.locator("..").boundingBox();
    expect(bounds).not.toBeNull(); expect(label).not.toBeNull();
    expect(Math.abs(bounds!.x - label!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds!.width - label!.width)).toBeLessThanOrEqual(1);
    await form.screenshot({ path: testInfo.outputPath("room-number-field.png") });
    await room.fill("305");
    await room.press("Home");
    await room.press("Backspace");
    await expect(room).toHaveValue("305");
    await room.fill("  Ауд. 902");
    await expect(room).toHaveValue("902");
    const saved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith(`/api/schedule/${original.id}`));
    await form.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
    const savedResponse = await saved;
    expect(savedResponse.request().postDataJSON().room).toBe("902");
    const changed = await savedResponse.json(); version = changed.version;
    expect(changed.room).toBe("Ауд. 902");
    await expect(article.locator(".schedule-place")).toContainText("Ауд. 902");
    await article.getByRole("button", { name: "Изменить занятие", exact: true }).click();
    await expect(room).toHaveValue("902");
    await room.fill("999");
    await form.getByLabel("Корпус", { exact: true }).fill("99");
    await form.getByLabel("Занятие отменено", { exact: true }).check();
    for (const input of await form.locator('input:not([type="checkbox"])').all()) await expect(input).toBeDisabled();
    await expect(room).toHaveValue("902");
    await expect(form.getByLabel("Корпус", { exact: true })).toHaveValue(changed.location.building);
    await expect(form.getByRole("button", { name: "Сохранить изменения", exact: true })).toBeEnabled();
    await form.screenshot({ path: testInfo.outputPath("cancelled-form.png") });
    await form.getByLabel("Занятие отменено", { exact: true }).uncheck();
    await expect(room).toBeEditable();
    await form.getByLabel("Занятие отменено", { exact: true }).check();
    const cancelling = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith(`/api/schedule/${original.id}`));
    await form.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
    const response = await cancelling;
    expect(response.status()).toBe(200);
    const cancelled = await response.json(); version = cancelled.version;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.room).toBe(changed.room); expect(cancelled.startsAt).toBe(changed.startsAt);
    expect(cancelled.endsAt).toBe(changed.endsAt); expect(cancelled.location).toEqual(changed.location);
    expect(cancelled.previous).toEqual(changed.previous);
    const body = response.request().postDataJSON();
    expect(body.room).toBe(changed.room); expect(body.building).toBe(changed.location.building);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    const restored = await page.request.put(`/api/schedule/${original.id}`, { headers: await csrf(), data: {
      startsAt: original.startsAt, endsAt: original.endsAt, room: original.room, teacher: original.teacher,
      address: original.location.address, building: original.location.building, floor: original.location.floor,
      cancelled: false, version,
    } });
    expect(restored.status()).toBe(200);
  }
});
