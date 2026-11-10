import type { Page } from "@playwright/test";
import {
  demoPerformance,
  semesters,
  defaultSemesterId,
} from "../src/modules/academic-performance/demo";
import { summarize } from "../src/modules/academic-performance/model";

// Explicit HTTP fixtures, never imported by the production application.
export function performanceResponse(semesterId: string) {
  const performance = demoPerformance[semesterId];
  const summary = summarize(performance.disciplines);
  return {
    semesterId,
    summary: {
      total: performance.disciplines.length,
      ...summary,
      credits: performance.disciplines.filter((d) => d.final?.kind === "credit")
        .length,
      nextExam:
        semesterId === "2026-autumn"
          ? {
              courseId: "programming",
              name: "Программирование",
              date: "2027-01-20",
            }
          : null,
    },
    disciplines: performance.disciplines.map((d) => ({
      ...d,
      teacher: d.teacher ?? null,
      assessmentDate: d.examDate ?? d.assessmentDate ?? null,
      debtReason: d.debt?.reason ?? null,
      isLocal: true,
    })),
  };
}
export async function mockPerformance(page: Page) {
  await page.route("**/api/academic-performance/semesters", (r) =>
    r.fulfill({ json: { semesters, defaultSemesterId } }),
  );
  await page.route("**/api/academic-performance/student?*", (r) => {
    const id = new URL(r.request().url()).searchParams.get("semesterId")!;
    return r.fulfill({ json: performanceResponse(id) });
  });
}
