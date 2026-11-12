import { mockPerformance } from "./performance-http";
import { test, expect, type Page } from '@playwright/test';
import { validateRequest, requestExamples } from '../src/modules/requests/model';
async function student(page: Page) { await page.route('**/api/identity/session', r => r.fulfill({ json: { userId: 'demo', studentId: 'demo', universityId: 'u', displayName: 'Студент', roles: ['Student'], areas: ['student'], permissions: [] } })); }
test.beforeEach(async ({ page }) => student(page));
test('validation boundaries', () => {
  expect(validateRequest({ kind: 'certificate', place: ' ', copies: 1 })).toHaveProperty('place');
  for (const copies of [0, 6, 1.5]) expect(validateRequest({ kind: 'certificate', place: 'Тест', copies })).toHaveProperty('copies');
  expect(validateRequest({ kind: 'certificate', place: 'Тест', copies: 5 })).toEqual({});
  expect(validateRequest({ kind: 'certificate', place: 'я'.repeat(201), copies: 1 })).toHaveProperty('place');
  expect(validateRequest({ kind: 'statement', reason: ' ', start: '2026-11-20', end: '2026-11-10' })).toMatchObject({ reason: expect.any(String), end: expect.any(String) });
  expect(validateRequest({ kind: 'statement', reason: 'я'.repeat(2001), start: '', end: '' })).toHaveProperty('reason');
});
for (const kind of ['certificate', 'statement']) test(`${kind}: fill review confirm open reload`, async ({ page }) => {
  await page.goto('/student/requests'); await page.getByRole('link', { name: 'Создать заявку' }).click();
  if (kind === 'certificate') { await page.getByLabel('Место предъявления').fill('По месту требования'); } else { await page.getByLabel('Вид заявки').selectOption('statement'); await page.getByLabel('Причина', { exact: true }).fill('Учебный проект'); await page.getByLabel('Начало периода').fill('2026-11-10'); await page.getByLabel('Окончание периода').fill('2026-11-20'); }
  await page.getByRole('button', { name: 'Проверить' }).click(); await page.getByRole('button', { name: 'Редактировать' }).click(); await page.getByRole('button', { name: 'Проверить' }).click();
  await page.getByRole('button', { name: 'Подтвердить демонстрацию' }).click(); await expect(page.getByRole('heading', { name: 'Демонстрация подтверждена' })).toBeVisible(); await expect(page.getByText('Номер ДЕМО-1005')).toBeVisible(); await page.getByRole('link', { name: 'Открыть заявку', exact: true }).click(); await page.reload(); await expect(page.getByRole('heading', { name: 'Заявка не найдена' })).toBeVisible();
});
test('all status examples and unknown id', async ({ page }) => { for (const r of requestExamples) { await page.goto(`/student/requests?requestId=${r.id}`); await expect(page.getByText(r.number, { exact: false })).toBeVisible(); if (r.status === 'rejected') await expect(page.getByText('Причина отклонения:', { exact: false })).toBeVisible(); } await page.goto('/student/requests?requestId=unknown'); await expect(page.getByRole('heading', { name: 'Заявка не найдена' })).toBeVisible(); });
test('field error focuses invalid input', async ({ page }) => { await page.goto('/student/requests?view=create'); await page.getByRole('button', { name: 'Проверить' }).click(); await expect(page.getByLabel('Место предъявления')).toBeFocused(); await expect(page.getByText('Укажите место предъявления')).toBeVisible(); });
for (const state of ['loading', 'empty', 'error', 'send-error']) test(`fixture ${state}`, async ({ page }) => { await page.goto(`/tests/fixtures/requests.html?state=${state}`); if (state === 'loading') await expect(page.getByText('Загружаем заявки…')).toBeVisible(); if (state === 'empty') await expect(page.getByText('Заявок пока нет.', { exact: false })).toBeVisible(); if (state === 'error') { await expect(page.getByRole('alert')).toBeVisible(); await page.getByRole('button', { name: 'Повторить' }).click(); await expect(page.getByText('ДЕМО-1001', { exact: false })).toBeVisible(); } if (state === 'send-error') { await page.getByLabel('Место предъявления').fill('Тест'); await page.getByRole('button', { name: 'Проверить' }).click(); await page.getByRole('button', { name: 'Подтвердить демонстрацию' }).click(); await expect(page.getByRole('alert')).toContainText('Данные сохранены'); await page.getByRole('button', { name: 'Подтвердить демонстрацию' }).click(); await expect(page.getByRole('heading', { name: 'Демонстрация подтверждена' })).toBeVisible(); } });
test('responsive screenshots', async ({ page }) => { for (const width of [360, 390, 768, 1024, 1280, 1440]) { await page.setViewportSize({ width, height: 1000 }); await page.goto('/student/requests'); await expect(page.getByText('ДЕМО-1001', { exact: false })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); if (width === 360 || width === 1280) await page.screenshot({ path: `../artifacts/requests-${width}.png`, fullPage: true }); } });
test('anonymous and staff cannot open student requests',async({page})=>{
 await page.unroute('**/api/identity/session');
 await page.route('**/api/identity/session',r=>r.fulfill({status:401}));
 await page.goto('/student/requests');await expect(page).toHaveURL(/\/login$/);
 await page.unroute('**/api/identity/session');
 await page.route('**/api/identity/session',r=>r.fulfill({json:{userId:'staff',displayName:'Сотрудник',roles:['Staff'],areas:['staff'],permissions:[]}}));
 await page.goto('/student/requests');await expect(page.getByRole('heading',{name:'Нет доступа'})).toBeVisible();
});
test('home and list share created request',async({page})=>{
 await mockPerformance(page); await page.route('**/api/identity/me',r=>r.fulfill({json:{university:'Демо',group:'ПИ-21'}}));
 await page.goto('/student/requests?view=create');await page.getByLabel('Место предъявления').fill('Для проверки главной');await page.getByRole('button',{name:'Проверить'}).click();await page.getByRole('button',{name:'Подтвердить демонстрацию'}).click();
 await page.getByRole('navigation',{name:'Разделы'}).getByRole('link',{name:'Главная',exact:true}).click();
 const card=page.locator('.request-card');await expect(card).toContainText('Справка об обучении');await expect(card).toContainText('Отправлена');await card.getByRole('link',{name:'Справка об обучении'}).click();await expect(page.getByText('Для проверки главной')).toBeVisible();
});
test('demo store resets on session owner change',async()=>{
 const {resetRequestSession,demoSource}=await import('../src/modules/requests/model');
 resetRequestSession('university/student-a');
 await demoSource.create({kind:'certificate',place:'Временное значение',copies:1});
 expect((await demoSource.load()).length).toBe(5);
 resetRequestSession('university/student-a');expect((await demoSource.load()).length).toBe(5);
 resetRequestSession('other/student-b');expect((await demoSource.load()).length).toBe(4);
 resetRequestSession(undefined);expect((await demoSource.load()).length).toBe(4);
});
test('long form keyboard and 200 percent layout',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/student/requests?view=create');await page.getByLabel('Место предъявления').fill('Длинное название организации '.repeat(6));
 await page.getByRole('button',{name:'Проверить'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Редактировать'})).toBeVisible();
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'../artifacts/requests-review-360-zoom.png',fullPage:true});
});
