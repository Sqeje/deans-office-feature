import { test, expect } from './test';
import { mockPerformance } from './performance-http';
import { mockRequests } from './requests-http';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/identity/session', r => r.fulfill({ json: { userId: 'demo', universityId: 'demo', displayName: 'Demo Student', roles: ['Student'], studentId: 'demo', permissions: [], areas: ['student'] } }));
  await page.route('**/api/identity/me', r => r.fulfill({ json: { fullName: 'Demo Student', university: 'Demo', group: 'IT-21' } }));
  await page.route('**/api/identity/csrf', r => r.fulfill({ json: { token: 'test' } }));
  await mockPerformance(page); await mockRequests(page);
});
test('server feed, read persistence, direct link and mutation failure', async ({ page }) => {
  let read = false, fail = true;
  const id = '10000000-0000-0000-0000-000000000001';
  await page.route('**/api/notifications/student', r => r.fulfill({ json: { items: [{ id, category: 'request', title: 'Заявка: Готова', text: 'Откройте заявку', createdAt: '2026-11-14T10:00:00Z', readAt: read ? '2026-11-14T11:00:00Z' : null, relatedType: 'request', relatedId: id }], unreadCount: read ? 0 : 1 } }));
  await page.route('**/api/notifications/student/*/read', r => { if (fail) return r.fulfill({ status: 500, json: { code: 'test', traceId: 'trace-test' } }); read = true; return r.fulfill({ status: 204 }); });
  await page.goto('/student/notifications');
  await expect(page.getByText('Непрочитанных: 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть заявку' })).toHaveAttribute('href', `/student/requests?requestId=${id}`);
  await page.getByRole('button', { name: 'Отметить прочитанным', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('trace-test');
  await expect(page.getByText('Непрочитанных: 1', { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Отметить прочитанным', exact: true }).click();
  await expect(page.getByText('Непрочитанных: 0', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Непрочитанных: 0', { exact: true })).toBeVisible();
  await page.goto('/student'); await expect(page.locator('.notification-summary')).toContainText('Заявка: Готова');
  await expect(page.locator('.notification-count')).toHaveCount(0);
});
test('empty, loading, error and retry use real API states', async ({ page }) => {
  await page.route('**/api/notifications/student', r => r.fulfill({ status: 500, json: {} }));
  await page.goto('/student/notifications');
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await page.route('**/api/notifications/student', async r => { await new Promise(resolve => setTimeout(resolve, 300)); await r.fulfill({ json: { items: [], unreadCount: 0 } }); });
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Уведомлений пока нет')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Загружаем уведомления…')).toBeVisible();
  await expect(page.getByText('Уведомлений пока нет')).toBeVisible();
});
for (const width of [360, 390, 768, 1024, 1280, 1440]) test(`layout ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/notifications/student', r => r.fulfill({ json: { items: [{ id: 'a', category: 'announcement', title: 'Длинное объявление '.repeat(10), text: 'Подробности '.repeat(100), createdAt: '2026-11-14T10:00:00Z', readAt: null }], unreadCount: 1 } }));
  await page.goto('/student/notifications'); await expect(page.locator('.notifications-feed > li')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/notifications-${width}.png`, fullPage: true });
  if (width === 360) { await page.getByRole('button', { name: 'Отметить всё как прочитанное' }).focus(); await expect(page.getByRole('button', { name: 'Отметить всё как прочитанное' })).toBeFocused(); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});

test('employee publication keeps input and operation on retry at 360px', async ({ page }) => {
  await page.route('**/api/identity/session', r => r.fulfill({ json: { userId: 'staff', universityId: 'demo', displayName: 'Employee', roles: ['Staff'], permissions: [{ permission: 'announcements.publish', groupId: null }], areas: ['staff'] } }));
  const bodies: { operationId: string }[] = [];
  await page.route('**/api/notifications/staff/announcements', r => {
    bodies.push(r.request().postDataJSON()); return bodies.length === 1 ? r.fulfill({ status: 500, json: { code: 'test' } }) : r.fulfill({ status: 201, json: {} });
  });
  await page.goto('/staff/notifications');
  await page.getByLabel('Заголовок', { exact: true }).fill('Заголовок объявления');
  await page.getByLabel('Текст объявления', { exact: true }).fill('Подробности объявления');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Текст объявления', { exact: true })).toHaveValue('Подробности объявления');
  await page.getByLabel('Текст объявления', { exact: true }).focus();
  await expect(page.getByLabel('Текст объявления', { exact: true })).toHaveCSS('outline-color', 'rgb(0, 87, 231)');
  await page.screenshot({ path: 'test-results/notifications-staff-error-360.png', fullPage: true });
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Объявление опубликовано');
  expect(bodies[0].operationId).toEqual(bodies[1].operationId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
