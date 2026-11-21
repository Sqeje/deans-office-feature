import { test as base } from "@playwright/test";
export * from "@playwright/test";
// Isolate mocked identities from the live API. Explicit test routes take precedence.
export const test = base.extend<{ mockIdentityBoundary: void }>({
  mockIdentityBoundary: [async ({ page }, use) => {
    await page.route("**/api/**", async route => {
      const account = route.request().headers()["x-dean-account"];
      if (!account || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(account)) return route.fallback();
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/notifications/student") return route.fulfill({ json: { items: [], unreadCount: 0 } });
      if (path === "/api/schedule/next") return route.fulfill({ json: { event: null, timeZone: "Europe/Moscow" } });
      if (path.match(/^\/api\/academic-performance\/staff\/courses\/[^/]+\/points-plan$/)) return route.fulfill({ json: { courseId: path.split("/")[5], version: 0, components: [] } });
      if (path.match(/^\/api\/academic-performance\/staff\/students\/[^/]+\/courses\/[^/]+\/points$/)) return route.fulfill({ json: [] });
      if (path.match(/^\/api\/academic-performance\/student\/courses\/[^/]+\/points$/)) return route.fulfill({ json: { courseId: path.split("/")[5], planVersion: 0, components: [], earned: 0, maximum: 0, attendanceIncomplete: false } });
      return route.fulfill({ status: 501, json: { code: "unmocked_test_endpoint" } });
    });
    await use();
  }, { auto: true }],
});
