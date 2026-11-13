import { test, expect, type Page } from '@playwright/test';
async function login(page:Page, account:'student1'|'staff') {
 const password=process.env[account==='staff'?'DEMO_STAFF_PASSWORD':'DEMO_PASSWORD1']; if(!password)throw new Error('Demo password required');
 await page.goto('/login');await page.getByLabel('Электронная почта').fill(account+'@demo.invalid');await page.getByLabel('Пароль',{exact:true}).fill(password);await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toContainText('Здравствуйте');
}
test('live requests: persistence, employee workflow, rejection and ready history',async({browser})=>{
 test.setTimeout(60_000);
 const studentContext=await browser.newContext({viewport:{width:360,height:900}});const staffContext=await browser.newContext({viewport:{width:1280,height:1000}});
 try {const student=await studentContext.newPage(),staff=await staffContext.newPage();await login(student,'student1');await login(staff,'staff');
 for(const kind of ['certificate','statement']) {
 await student.goto('/student/requests?view=create');
 if(kind==='certificate')await student.getByLabel('Место предъявления').fill('Приёмочная проверка');else {await student.getByLabel('Вид заявки').selectOption('statement');await student.getByLabel('Причина',{exact:true}).fill('Учебный проект');await student.getByLabel('Начало периода').fill('2026-11-13');await student.getByLabel('Окончание периода').fill('2026-11-20');}
 await student.getByRole('button',{name:'Проверить'}).click();await student.getByRole('button',{name:'Отправить заявку'}).dblclick();await expect(student.getByRole('heading',{name:'Заявка отправлена'})).toBeVisible();
 const id=new URL(student.url()).searchParams.get('requestId')!;await student.reload();await expect(student.getByRole('region',{name:'История заявки'})).toContainText('Отправлена');
 await student.goto('/student/requests');await expect(student.locator(`a[href*="${id}"]`)).toBeVisible();
 await staff.goto('/staff/requests');await expect(staff.locator(`a[href*="${id}"]`)).toBeVisible();await staff.locator(`a[href*="${id}"]`).click();await staff.getByRole('button',{name:'Взять на рассмотрение'}).click();
 if(kind==='certificate'){await staff.getByLabel('Причина отклонения').fill('Уточните место предъявления');await staff.getByRole('button',{name:'Отклонить заявку'}).click();}else await staff.getByRole('button',{name:'Отметить готовой'}).click();
 await expect(staff.getByText('Обработка завершена')).toBeVisible();await student.goto(`/student/requests?requestId=${id}`);const history=student.getByRole('region',{name:'История заявки'});await expect(history.locator('li')).toHaveCount(3);await expect(history).toContainText(kind==='certificate'?'Уточните место предъявления':'Готова');
 await student.screenshot({path:`../artifacts/requests-live-${kind}-360.png`,fullPage:true});await staff.screenshot({path:`../artifacts/requests-staff-${kind}-1280.png`,fullPage:true});
 await student.goto('/student');await expect(student.locator('.request-card h3 a')).toHaveAttribute('href',new RegExp(id));
 }
 }finally{await studentContext.close();await staffContext.close();}
});
