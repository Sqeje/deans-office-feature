import { client, check, csrf } from "../../shared/api";
import type { components } from "../../shared/schema";
import type {
  Grade,
  SemesterPerformance,
  PerformanceLoader,
  SemesterCatalog,
  FinalResult,
} from "./model";

export type Group = components["schemas"]["DirectoryGroup"];
export type Student = components["schemas"]["DirectoryStudent"];
export type ResultInput = components["schemas"]["SaveResultRequest"];
type Performance = components["schemas"]["PerformanceResponse"];

function grade(input: number | string | null | undefined): Grade {
  const value = Number(input);
  if (value !== 2 && value !== 3 && value !== 4 && value !== 5)
    throw new Error("Invalid grade contract");
  return value;
}
function adapt(data: Performance): SemesterPerformance {
  return {
    semesterId: data.semesterId,
    summary: {
      total: Number(data.summary.total),
      passed: Number(data.summary.passed),
      debts: Number(data.summary.debts),
      average:
        data.summary.average === null ? null : Number(data.summary.average),
      credits: Number(data.summary.credits),
      nextExam: data.summary.nextExam,
    },
    disciplines: data.disciplines.map((d) => {
      const final: FinalResult =
        !d.final || d.final.kind === "pending"
          ? null
          : d.final.kind === "grade"
            ? { kind: "grade", value: grade(d.final.value) }
            : { kind: d.final.kind };
      return {
        id: d.id,
        name: d.name,
        teacher: d.teacher ?? undefined,
        assessment: d.assessment,
        grades: d.grades.map((g) => ({ ...g, value: grade(g.value) })),
        final,
        status: d.status,
        debt: d.debtReason ? { reason: d.debtReason } : null,
        examDate: d.assessment === "exam" ? d.assessmentDate : null,
        assessmentDate: d.assessmentDate ?? undefined,
        isLocal: d.isLocal,
        version: Number(d.version),
      };
    }),
  };
}
export async function loadJournal(courseId: string, signal: AbortSignal) {
  const { data, error, response } = await client.GET("/api/academic-performance/staff/courses/{courseId}/journal", { params: { path: { courseId } }, signal });
  await check(response, error); return data!;
}
export async function saveJournal(lessonId: string, body: components["schemas"]["SaveJournalRequest"]) {
  const { error, response } = await client.PUT("/api/academic-performance/staff/lessons/{lessonId}/journal", { params: { path: { lessonId } }, body, headers: await csrf() });
  await check(response, error);
}
export async function loadHistory(studentId: string, courseId: string, signal: AbortSignal) {
  const { data, error, response } = await client.GET("/api/academic-performance/staff/students/{studentId}/courses/{courseId}/history", { params: { path: { studentId, courseId } }, signal });
  await check(response, error); return data!;
}
export async function loadSemesters(
  signal: AbortSignal,
): Promise<SemesterCatalog> {
  const { data, error, response } = await client.GET(
    "/api/academic-performance/semesters",
    { signal },
  );
  await check(response, error);
  return data!;
}
export const loadPerformance: PerformanceLoader = async (
  semesterId,
  signal,
) => {
  const { data, error, response } = await client.GET(
    "/api/academic-performance/student",
    { params: { query: { semesterId } }, signal },
  );
  await check(response, error);
  return adapt(data!);
};
export async function loadGroups(signal: AbortSignal): Promise<Group[]> {
  const { data, error, response } = await client.GET(
    "/api/academic-performance/staff/groups",
    { signal },
  );
  await check(response, error);
  return data!;
}
export async function loadStudents(
  groupId: string,
  signal: AbortSignal,
): Promise<Student[]> {
  const { data, error, response } = await client.GET(
    "/api/academic-performance/staff/groups/{groupId}/students",
    { params: { path: { groupId } }, signal },
  );
  await check(response, error);
  return data!;
}
export async function loadStudentPerformance(
  studentId: string,
  semesterId: string,
  signal: AbortSignal,
) {
  const { data, error, response } = await client.GET(
    "/api/academic-performance/staff/students/{studentId}",
    { params: { path: { studentId }, query: { semesterId } }, signal },
  );
  await check(response, error);
  return adapt(data!);
}
export async function saveResult(
  studentId: string,
  courseId: string,
  body: ResultInput,
) {
  const { error, response } = await client.PUT(
    "/api/academic-performance/staff/students/{studentId}/courses/{courseId}/result",
    {
      params: { path: { studentId, courseId } },
      body,
      headers: await csrf(),
    },
  );
  await check(response, error);
}
