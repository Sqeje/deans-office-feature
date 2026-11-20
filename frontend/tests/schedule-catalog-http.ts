import type { Page } from "@playwright/test";
import { groups, teachers } from "../src/modules/schedule/catalog";
import { scheduleSource } from "../src/modules/schedule/source";

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
    await route.fulfill({ json: events.map(event => ({
      ...event, groupName: groups.find(group => group.id === event.groupId)?.name,
      status: event.change.status,
      previous: event.change.status === "rescheduled" ? { ...event.change, location: event.change.location ?? event.location } : null,
      isImported: false, isDemo: true, version: 1, canEdit: false,
    })) });
  });
}
