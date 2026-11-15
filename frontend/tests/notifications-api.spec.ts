import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, account: 'student1' | 'student2' | 'staff') {
  const password = process.env[account === 'staff' ? 'DEMO_STAFF_PASSWORD' : account === 'student1' ? 'DEMO_PASSWORD1' : 'DEMO_PASSWORD2'];
  if (!password) throw new Error('Demo password required');
  await page.goto('/login'); await page.getByLabel('Электронная почта').fill(account + '@demo.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill(password); await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Здравствуйте', { timeout: 20000 });
}
async function post(page: Page, url: string, data: unknown) {
  const token = await (await page.request.get('/api/identity/csrf')).json();
  const response = await page.request.post(url, { data, headers: { 'X-CSRF-TOKEN': token.token } });
  expect(response.ok()).toBeTruthy(); return response;
}
test('live: status event opens the actual request, read survives reload, employee publishes', async ({ browser }) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([360, 1280, 360].map(width => browser.newContext({ viewport: { width, height: 900 } })));
  try {
    const [student, staff, other] = await Promise.all(contexts.map(c => c.newPage()));
    await login(student, 'student1'); await login(staff, 'staff'); await login(other, 'student2');
    const request = await (await post(student, '/api/requests/student', { operationId: crypto.randomUUID(), input: { kind: 'certificate', place: 'Для проверки уведомлений', copies: 1 } })).json();
    await post(staff, `/api/requests/staff/${request.id}/status`, { version: 1, status: 'in_review' });
    await post(staff, `/api/requests/staff/${request.id}/status`, { version: 2, status: 'ready' });
    await student.goto('/student/notifications');
    const item = student.locator('.notifications-feed > li').filter({ hasText: 'Заявка: Готова' }).filter({ has: student.locator(`a[href*="${request.id}"]`) });
    await expect(item).toHaveCount(1); await item.getByRole('link', { name: 'Открыть заявку' }).click();
    await expect(student).toHaveURL(new RegExp(request.id)); await expect(student.getByRole('region', { name: 'История заявки' })).toContainText('Готова');
    await student.goto('/student/notifications'); await student.getByRole('button', { name: 'Отметить всё как прочитанное' }).click();
    await expect(student.getByText('Непрочитанных: 0', { exact: true })).toBeVisible(); await student.reload();
    await expect(student.getByText('Непрочитанных: 0', { exact: true })).toBeVisible();
    await staff.goto('/staff/notifications');
    const title = 'Объявление ' + crypto.randomUUID();
    await staff.getByLabel('Заголовок', { exact: true }).fill(title); await staff.getByLabel('Текст объявления', { exact: true }).fill('Общее объявление студентам нашего университета.');
    await staff.screenshot({ path: 'test-results/notifications-staff-desktop.png', fullPage: true });
    await staff.getByRole('button', { name: 'Опубликовать', exact: true }).click(); await expect(staff.getByRole('status')).toContainText('Объявление опубликовано');
    await student.reload(); await expect(student.getByRole('heading', { name: title })).toBeVisible();
    await other.goto('/student/notifications'); await expect(other.getByRole('heading', { name: title })).toBeVisible();
    await expect(other.locator(`a[href*="${request.id}"]`)).toHaveCount(0);
    await student.screenshot({ path: 'test-results/notifications-live-360.png', fullPage: true });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
