import { test, expect, type Page } from './test';
async function login(page: Page, account: 'student1' | 'student2' | 'dean1' | 'staff') {
  const password = process.env[account === 'dean1' || account === 'staff' ? 'DEMO_STAFF_PASSWORD' : account === 'student1' ? 'DEMO_PASSWORD1' : 'DEMO_PASSWORD2'];
  if (!password) throw new Error('Demo password required');
  await page.goto('/login'); await page.getByLabel('Электронная почта').fill(account + '@demo.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill(password); await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Здравствуйте', { timeout: 20000 });
}
async function post(page: Page, url: string, data: unknown) {
  const token = await (await page.request.get('/api/identity/csrf')).json();
  const response = await page.request.post(url, { data, headers: { 'X-CSRF-TOKEN': token.token } });
  expect(response.ok(), `${url} returned ${response.status()}`).toBeTruthy(); return response;
}
test('live: request notifications persist and announcement publication requires permission', async ({ browser }) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([360, 1280, 360, 1280].map(width => browser.newContext({ viewport: { width, height: 900 } })));
  try {
    const [student, staff, other, teacher] = await Promise.all(contexts.map(c => c.newPage()));
    await login(student, 'student1'); await login(staff, 'dean1'); await login(other, 'student2');
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
    await login(teacher, 'staff');
    const title = 'Запрещённое объявление ' + crypto.randomUUID();
    const token = await (await teacher.request.get('/api/identity/csrf')).json();
    const denied = await teacher.request.post('/api/notifications/staff/announcements', {
      headers: { 'X-CSRF-TOKEN': token.token },
      data: { operationId: crypto.randomUUID(), title, text: 'У преподавателя нет права публикации объявлений.' },
    });
    expect(denied.status()).toBe(403);
    for (const page of [student, other]) {
      const response = await page.request.get('/api/notifications/student');
      expect(response.ok()).toBeTruthy();
      const feed = await response.json();
      expect(feed.items.some((message: { title: string }) => message.title === title)).toBe(false);
    }
    await other.goto('/student/notifications');
    await expect(other.locator(`a[href*="${request.id}"]`)).toHaveCount(0);
    await student.screenshot({ path: 'test-results/notifications-live-360.png', fullPage: true });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

// No demo role has announcements.publish. UI publication/delivery is covered by
// an explicit HTTP fixture; authorized server publication is in RequestsTests.
test('HTTP fixture: authorized announcement is published and shown to both students', async ({ browser }) => {
  const contexts = await Promise.all([1280, 360, 1280].map(width => browser.newContext({ viewport: { width, height: 900 } })));
  let message: { id: string; category: string; title: string; text: string; createdAt: string; readAt: null; relatedType: null; relatedId: null } | undefined;
  const title = 'Объявление ' + crypto.randomUUID();
  const text = 'Общее объявление студентам нашего университета.';
  try {
    const [publisher, first, second] = await Promise.all(contexts.map(c => c.newPage()));
    for (const [index, page] of [publisher, first, second].entries()) {
      await page.route('**/api/identity/session', route => route.fulfill({ json: {
        userId: `fixture-${index}`, universityId: 'fixture-university', displayName: `Пользователь ${index}`,
        roles: [index === 0 ? 'Staff' : 'Student'], areas: [index === 0 ? 'staff' : 'student'],
        studentId: index === 0 ? null : `fixture-${index}`,
        permissions: index === 0 ? [{ permission: 'announcements.publish', groupId: null }] : [],
      } }));
      await page.route('**/api/identity/csrf', route => route.fulfill({ json: { token: 'fixture-csrf' } }));
      await page.route('**/api/notifications/student', route => route.fulfill({ json: {
        items: message ? [message] : [], unreadCount: message ? 1 : 0,
      } }));
    }
    await publisher.route('**/api/notifications/staff/announcements', route => {
      const input = route.request().postDataJSON();
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['x-csrf-token']).toBe('fixture-csrf');
      expect(input).toMatchObject({ title, text });
      expect(input.operationId).toMatch(/^[0-9a-f-]{36}$/i);
      message = { id: crypto.randomUUID(), category: 'announcement', title, text,
        createdAt: new Date().toISOString(), readAt: null, relatedType: null, relatedId: null };
      return route.fulfill({ status: 201, json: message });
    });
    for (const page of [first, second]) {
      await page.goto('/student/notifications');
      await expect(page.getByText('Уведомлений пока нет', { exact: true })).toBeVisible();
    }
    await publisher.goto('/staff/notifications');
    await publisher.getByLabel('Заголовок', { exact: true }).fill(title);
    await publisher.getByLabel('Текст объявления', { exact: true }).fill(text);
    await publisher.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    await expect(publisher.getByRole('status')).toContainText('Объявление опубликовано');
    await publisher.screenshot({ path: 'test-results/notifications-staff-desktop.png', fullPage: true });
    for (const page of [first, second]) {
      await page.reload();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText(text, { exact: true })).toBeVisible();
      await expect(page.getByText('Непрочитанных: 1', { exact: true })).toBeVisible();
    }
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
