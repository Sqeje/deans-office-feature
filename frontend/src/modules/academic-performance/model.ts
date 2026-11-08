export type Grade = 2 | 3 | 4 | 5;
export type ResultStatus = "passed" | "debt" | "pending";
export type FinalResult =
  | { kind: "grade"; value: Grade }
  | { kind: "credit" }
  | null;
// Calendar dates (YYYY-MM-DD), not instants in the browser's time zone.
export interface CurrentGrade {
  id: string;
  date: string;
  activity: string;
  value: Grade;
}
export interface Discipline {
  id: string;
  name: string;
  assessment: "exam" | "credit";
  grades: readonly CurrentGrade[];
  final: FinalResult;
  status: ResultStatus;
  debt: { reason: string } | null;
  examDate: string | null;
}
export interface Semester {
  id: string;
  label: string;
}
export interface SemesterPerformance {
  semesterId: string;
  disciplines: readonly Discipline[];
}
export type PerformanceLoader = (
  semesterId: string,
  signal: AbortSignal,
) => Promise<SemesterPerformance>;
export function summarize(disciplines: readonly Discipline[]) {
  const numeric = disciplines.flatMap((d) =>
    d.final?.kind === "grade" ? [d.final.value] : [],
  );
  return {
    passed: disciplines.filter((d) => d.status === "passed").length,
    debts: disciplines.filter((d) => d.debt !== null).length,
    average: numeric.length
      ? numeric.reduce((sum, grade) => sum + grade, 0) / numeric.length
      : null,
  };
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
export function finalLabel(result: FinalResult) {
  return result === null
    ? "Не выставлена"
    : result.kind === "credit"
      ? "Зачтено"
      : String(result.value);
}
export const resultPresentation = {
  passed: { label: "Сдано", tone: "success" },
  debt: { label: "Задолженность", tone: "danger" },
  pending: { label: "Не выставлена", tone: "neutral" },
} as const;
