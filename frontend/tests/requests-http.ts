import type { Page } from '@playwright/test';
import { requestExamples } from '../src/modules/requests/demo';
export async function mockRequests(page: Page) {
 let rows = requestExamples.map(r=>({...r,version:1,history:[]}));
 await page.route('**/api/identity/csrf',r=>r.fulfill({json:{token:'test-token'}}));
 await page.route('**/api/requests/student**',async route=>{
 const request=route.request(),path=new URL(request.url()).pathname;
 if(request.method()==='POST') { const body=request.postDataJSON();const row={id:'11111111-1111-1111-1111-111111111115',number:'1005',title:body.input.kind==='certificate'?'Справка об обучении':'Заявление на индивидуальный график',status:'submitted',submittedAt:new Date().toISOString(),input:body.input,version:1,history:[]}; rows=[row,...rows];return route.fulfill({status:201,json:row});}
 if(path.endsWith('/summary'))return route.fulfill({json:rows[0]});
 if(path.endsWith('/student'))return route.fulfill({json:rows});
 const row=rows.find(r=>r.id===path.split('/').pop());return row?route.fulfill({json:row}):route.fulfill({status:404,json:{code:'request_not_found'}});
 });
}
