import { test, expect } from "./test";
test("server catalog opens permitted groups and teachers",async({page},testInfo)=>{
  await page.route("**/api/identity/session",r=>r.fulfill({json:{userId:"teacher",universityId:"demo",displayName:"Тестовый преподаватель",roles:["Staff","Teacher"],permissions:[{permission:"schedule.write",groupId:"group"},{permission:"grades.read",groupId:"group"}],areas:["staff"]}}));
  await page.route("**/api/schedule/catalog",r=>r.fulfill({json:{groups:[{id:"group",name:"ИВТ-401"}],teachers:[{id:"teacher",name:"Тестовый преподаватель"}]}}));
  await page.route("**/api/schedule/catalog/events?*",r=>r.fulfill({json:[]}));
  await page.goto("/staff/schedule/catalog");
  await expect(page.getByRole("heading",{name:"Все расписания",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"ИВТ-401",exact:true})).toHaveAttribute("href","/staff/schedule/groups/group");
  for(const width of [360,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:testInfo.outputPath("server-catalog-"+width+".png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
  await page.getByLabel("Поиск преподавателя").fill("несуществующий");
  await expect(page.getByText("Преподаватели не найдены.",{exact:true})).toBeVisible();
  await page.getByLabel("Поиск преподавателя").fill("тестовый");
  await page.getByRole("link",{name:"Тестовый преподаватель",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Тестовый преподаватель",exact:true})).toBeVisible();
  await page.goto("/staff/schedule/catalog");
  await page.getByRole("link",{name:"ИВТ-401",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Расписание группы ИВТ-401",exact:true})).toBeVisible();
});
test("staff dashboard shows named assignments and real next lesson",async ({page},testInfo)=>{
  await page.route("**/api/identity/session",r=>r.fulfill({json:{userId:"teacher",universityId:"demo",displayName:"Тестовый преподаватель",roles:["Staff","Teacher"],permissions:[{permission:"grades.read",groupId:"group"},{permission:"schedule.write",groupId:"group"},{permission:"journal.write",groupId:"group"}],areas:["staff"]}}));
  await page.route("**/api/identity/staff-context",r=>r.fulfill({json:{roles:["Teacher"],groups:[{id:"group",name:"ИВТ-401",actions:["grades.read"]}],assignments:[{id:"assignment",courseId:"course",groupId:"group",semesterId:"2026-autumn",courseName:"Базы данных"}]}}));
  await page.route("**/api/schedule/teacher/context",r=>r.fulfill({json:{teacherId:"teacher",teacherName:"Тестовый преподаватель",timeZone:"Europe/Moscow",isDemo:true}}));
  await page.route("**/api/schedule/teacher/mine?*",r=>r.fulfill({json:{timeZone:"Europe/Moscow",events:[{id:"lesson",title:"Базы данных",startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),status:"scheduled",groupName:"ИВТ-401",room:"101"}]}}));
  await page.goto("/staff");
  await expect(page.getByRole("heading",{name:"Ближайшее занятие"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Базы данных",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Базы данных · Осень 2026"})).toHaveAttribute("href","/staff/academic-performance?view=journal&course=course");
  for(const width of [360,1280]) {await page.setViewportSize({width,height:900});await page.screenshot({path:testInfo.outputPath("staff-dashboard-"+width+".png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
test("journal preserves draft on conflict and shows cancelled lesson read only", async ({ page }, testInfo) => {
  await page.route("**/api/identity/session", r => r.fulfill({ json: { userId:"teacher", universityId:"demo", displayName:"Тестовый преподаватель", roles:["Staff","Teacher"], permissions:[{permission:"grades.read",groupId:"group"},{permission:"journal.write",groupId:"group"}], areas:["staff"] } }));
  await page.route("**/api/identity/csrf", r => r.fulfill({ json:{token:"test"} }));
  await page.route("**/api/identity/staff-context", r => r.fulfill({ json: { roles:["Teacher"], groups:[{id:"group",name:"ИВТ-401",actions:["grades.read","journal.write"]}],assignments:[{id:"assignment",courseId:"course",groupId:"group",semesterId:"2026-autumn",courseName:"Базы данных"}] } }));
  const rows = [{ studentId:"student", fullName:"Тестовый Студент", grade:null, attendance:"unmarked" }];
  await page.route("**/api/academic-performance/staff/courses/course/journal", r => r.fulfill({ json:{courseId:"course",courseName:"Базы данных",groupId:"group",semesterId:"2026-autumn",lessons:[{lessonId:"lesson",startsAt:"2026-11-10T09:00:00Z",subject:"Практическая работа",isCancelled:false,canEdit:true,readOnlyReason:null,version:0,rows},{lessonId:"cancelled",startsAt:"2026-11-11T09:00:00Z",subject:"Отменённая пара",isCancelled:true,canEdit:false,readOnlyReason:"Занятие отменено.",version:0,rows}]} }));
  await page.route("**/api/academic-performance/staff/lessons/lesson/journal", r => r.fulfill({status:409,json:{code:"journal_conflict"}}));
  await page.goto("/staff/academic-performance?view=journal&course=course&lesson=lesson");
  await expect(page.getByLabel("Занятие", { exact:true })).toHaveValue("lesson");
  await page.getByLabel("Оценка", { exact:true }).selectOption("5");
  await page.getByLabel("Посещаемость", { exact:true }).selectOption("present");
  await page.getByRole("button",{name:"Сохранить журнал",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Ваш черновик сохранён");
  await expect(page.getByLabel("Оценка", { exact:true })).toHaveValue("5");
  await expect(page.getByLabel("Посещаемость", { exact:true })).toHaveValue("present");
  for (const width of [360,1280]) { await page.setViewportSize({width,height:900}); await page.screenshot({path:testInfo.outputPath("journal-conflict-"+width+".png"),fullPage:true}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); }
  await page.getByLabel("Занятие", { exact:true }).selectOption("cancelled");
  await expect(page).toHaveURL(/lesson=cancelled/);
  await page.reload();
  await expect(page.getByText("Занятие отменено.",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Оценка", { exact:true })).toBeDisabled();
});
test("assigned teacher explicitly enables final correction with mandatory reason", async ({page}, testInfo) => {
  await page.route("**/api/identity/session",r=>r.fulfill({json:{userId:"teacher",universityId:"demo",displayName:"Тестовый преподаватель",roles:["Staff","Teacher"],permissions:[{permission:"grades.read",groupId:"group"},{permission:"grades.write",groupId:"group"}],areas:["staff"]}}));
  await page.route("**/api/identity/staff-context",r=>r.fulfill({json:{roles:["Teacher"],groups:[{id:"group",name:"ИВТ-401",actions:["grades.read","grades.write"]}],assignments:[{id:"assignment",courseId:"course",groupId:"group",semesterId:"term",courseName:"Базы данных"}]}}));
  await page.route("**/api/academic-performance/staff/groups",r=>r.fulfill({json:[{id:"group",name:"ИВТ-401"}]}));
  await page.route("**/api/academic-performance/semesters",r=>r.fulfill({json:{semesters:[{id:"term",label:"Осень 2026"}],defaultSemesterId:"term"}}));
  await page.route("**/api/academic-performance/staff/groups/group/students",r=>r.fulfill({json:[{id:"student",name:"Тестовый Студент"}]}));
  await page.route("**/api/academic-performance/staff/students/student?*",r=>r.fulfill({json:{semesterId:"term",summary:{total:1,passed:1,debts:0,average:4,credits:0,nextExam:null},disciplines:[{id:"course",name:"Базы данных",teacher:"Тестовый преподаватель",assessment:"exam",assessmentDate:null,grades:[],final:{kind:"grade",value:4},status:"passed",debtReason:null,isLocal:true,version:2}]}}));
  await page.route("**/api/academic-performance/staff/students/student/courses/course/history",r=>r.fulfill({json:[]}));
  await page.goto("/staff/academic-performance?view=finals");
  await page.getByLabel("Группа",{exact:true}).selectOption("group");
  await page.getByLabel("Студент",{exact:true}).selectOption("student");
  await page.getByLabel("Дисциплина",{exact:true}).selectOption("course");
  await expect(page.getByLabel("Итоговый результат",{exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Исправить результат",exact:true}).click();
  await expect(page.getByRole("button",{name:"Сохранить результат",exact:true})).toBeDisabled();
  await page.getByLabel("Причина изменения (обязательно)").fill("Исправлена ошибка переноса результата");
  await expect(page.getByRole("button",{name:"Сохранить результат",exact:true})).toBeEnabled();
  await page.screenshot({path:testInfo.outputPath("final-correction-360.png"),fullPage:true});
});
