import type { Page } from "@playwright/test";
import { groups, teachers } from "../src/modules/schedule/catalog";
import { scheduleSource } from "../src/modules/schedule/source";
import type { components } from "../src/shared/schema";

// Shared HTTP fixture for presentation tests. Production always reads the API.
export async function mockScheduleCatalog(page: Page) {
  await page.route("**/api/schedule/catalog", route => route.fulfill({ json: { groups, teachers } }));
  await page.route("**/api/schedule/catalog/events?*", async route => {
    const query = new URL(route.request().url()).searchParams;
    const events = await scheduleSource({
      entity: { kind: query.get("kind") as "group" | "teacher", id: query.get("id")! },
      category: query.get("category") as "lesson" | "assessment",
      start: query.get("start")!, end: query.get("end")!,
    }, new AbortController().signal);
    // Match the server DTO: fixture-only assessment results never cross HTTP.
    const payload: components["schemas"]["EventDto"][] = events.map(event => ({
      id: event.id, groupId: event.groupId,
      groupName: groups.find(group => group.id === event.groupId)!.name,
      teacherId: event.teacherId, teacher: event.teacher, title: event.title,
      kind: event.kind, category: event.category, room: event.room,
      startsAt: event.startsAt, endsAt: event.endsAt, location: event.location,
      status: event.change.status,
      previous: event.change.status === "rescheduled" ? { ...event.change, location: event.change.location ?? event.location } : null,
      isImported: false, isDemo: true, version: 1, canEdit: false,
    }));
    await route.fulfill({ json: payload });
  });
}
