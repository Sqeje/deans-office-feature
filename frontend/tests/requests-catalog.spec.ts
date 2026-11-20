import { test, expect } from './test';
import { mockRequests } from './requests-http';
import { requestTypes } from '../src/modules/requests/catalog';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/identity/session', route => route.fulfill({ json: { userId: 'catalog-student', studentId: 'catalog-student', universityId: 'demo', displayName: 'Студент', roles: ['Student'], areas: ['student'], permissions: [] } }));
  await mockRequests(page);
});

test('catalog explains every request and shows fields appropriate to its form', async ({ page }) => {
  await page.goto('/student/requests?view=create');
  for (const type of requestTypes) {
    await page.getByLabel('Вид заявки').selectOption(type.kind);
    const info = page.getByRole('complementary', { name: 'О выбранной заявке' });
    await expect(info).toContainText(type.description);
    await expect(info).toContainText(type.format);
    if (type.fields === 'certificate') await expect(page.getByLabel('Место предъявления')).toBeVisible();
    else await expect(page.getByLabel('Причина', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Начало периода')).toHaveCount(type.fields === 'period' ? 1 : 0);
  }
});

test('help is available on hover, keyboard focus and touch click', async ({ page }) => {
  await page.goto('/student/requests?view=create');
  await page.getByRole('button', { name: 'Каталог заявок', exact: true }).click();
  const help = page.getByRole('button', { name: 'О заявке «Справка об обучении»', exact: true });
  const tooltip = page.locator('#help-certificate');
  await help.hover(); await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0); await help.focus(); await expect(tooltip).toBeVisible();
  await help.click(); await expect(help).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape'); await expect(help).toHaveAttribute('aria-expanded', 'false'); await expect(tooltip).toBeHidden();
});

test('status filter, search and completion distinguish an uncollected document', async ({ page }) => {
  await page.goto('/student/requests');
  await page.getByLabel('Статус', { exact: true }).selectOption('ready');
  await expect(page.locator('.request-register-row')).toHaveCount(1);
  await expect(page.locator('.request-register-row')).toContainText('Документ ещё не получен');
  await page.getByLabel('Поиск заявок').fill('несуществующая справка');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page.locator('.request-register-row')).toHaveCount(4);
});

test('catalog and request form fit portal widths and save visual references', async ({ page }) => {
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/student/requests?view=create');
    await expect(page.getByLabel('Место предъявления')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (width === 360 || width === 1440) await page.screenshot({ path: `../artifacts/requests-catalog-${width}.png`, fullPage: true });
  }
});
