import { test, expect } from './test';
import { mockRequests } from './requests-http';
import { requestExamples } from '../src/modules/requests/demo';
test('lost create response retains operation key across reload and retry',async({page})=>{
 await page.route('**/api/identity/session',r=>r.fulfill({json:{userId:'s',universityId:'u',studentId:'s',roles:['Student'],areas:['student'],permissions:[],displayName:'Студент'}}));
 await mockRequests(page);const operations:string[]=[];
 await page.route('**/api/requests/student/11111111-1111-1111-1111-111111111115', r=>r.fulfill({json:{...requestExamples[0],id:'11111111-1111-1111-1111-111111111115',number:'1005'}}));
 await page.route('**/api/requests/student',async route=>{if(route.request().method()!=='POST')return route.fallback();const body=route.request().postDataJSON();operations.push(body.operationId);if(operations.length===1)return route.abort();return route.fulfill({status:200,json:{...requestExamples[0],id:'11111111-1111-1111-1111-111111111115',number:'1005',input:body.input}})});
 for(let i=0;i<2;i++) {if(i===0)await page.goto('/student/requests?view=create');else await page.reload();await page.getByLabel('Место предъявления').fill('Проверка повтора');await page.getByRole('button',{name:'Проверить'}).click();await page.getByRole('button',{name:'Отправить заявку'}).click();if(i===0)await expect(page.getByRole('alert')).toContainText('Данные сохранены');else await expect(page.getByRole('heading',{name:'Заявка отправлена'})).toBeVisible();}
 expect(operations).toHaveLength(2);expect(operations[1]).toBe(operations[0]);
});
test('late staff mutation cannot replace another request',async({page})=>{
 await page.route('**/api/identity/session',r=>r.fulfill({json:{userId:'staff',universityId:'u',roles:['Staff'],areas:['staff'],permissions:[{permission:'requests.manage',groupId:'g'}],displayName:'Сотрудник'}}));
 await page.route('**/api/identity/csrf',r=>r.fulfill({json:{token:'test'}}));
 const a={...requestExamples[1],id:'a',number:'1001',version:1,history:[],status:'submitted'},b={...a,id:'b',number:'1002',title:'Другая заявка'};
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let started!:()=>void;const pending=new Promise<void>(resolve=>started=resolve);
 await page.route('**/api/requests/staff**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/groups'))return route.fulfill({json:[{id:'g',name:'Группа'}]});if(path.endsWith('/status')){started();await gate;return route.fulfill({json:{...a,status:'in_review',version:2}})}if(path.endsWith('/a'))return route.fulfill({json:a});if(path.endsWith('/b'))return route.fulfill({json:b});return route.fulfill({json:[a,b]})});
 await page.goto('/staff/requests?groupId=g&requestId=a');await page.getByRole('button',{name:'Взять на рассмотрение'}).click();await pending;await page.getByRole('link',{name:'К списку заявок'}).click();await page.getByRole('link',{name:/Другая заявка/}).click();await expect(page.getByRole('heading',{name:'Другая заявка'})).toBeVisible();release();await expect(page.getByText('Номер 1002',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Взять на рассмотрение'})).toBeEnabled();
 for(const width of [360,390,768,1024,1280,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();if(width===360)await page.screenshot({path:'../artifacts/requests-staff-pending-360.png',fullPage:true});}
});

test('resolved operation does not remain behind Back navigation',async({page})=>{
 await page.route('**/api/identity/session',r=>r.fulfill({json:{userId:'s',universityId:'u',studentId:'s',roles:['Student'],areas:['student'],permissions:[],displayName:'Студент'}}));
 await mockRequests(page);const operations:string[]=[];
 await page.route('**/api/requests/student',async route=>{if(route.request().method()!=='POST')return route.fallback();operations.push(route.request().postDataJSON().operationId);return route.fallback()});
 await page.goto('/student/requests');
 for(let i=0;i<2;i++) {await page.getByRole('link',{name:'Создать заявку'}).click();await page.getByLabel('Место предъявления').fill('Новая заявка '+i);await page.getByRole('button',{name:'Проверить'}).click();await page.getByRole('button',{name:'Отправить заявку'}).click();await expect(page.getByRole('heading',{name:'Заявка отправлена'})).toBeVisible();await page.goBack();await expect(page).toHaveURL(/\/student\/requests$/);}
 expect(operations).toHaveLength(2);expect(operations[1]).not.toBe(operations[0]);
});
