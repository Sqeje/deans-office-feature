import type { PerformanceLoader, Semester, SemesterPerformance } from "./model";
// Synthetic teaching examples shared by all demo students; never personal records.
export const semesters: readonly Semester[] = [
  { id: "2026-autumn", label: "Осень 2026 · 7 семестр" },
  { id: "2026-spring", label: "Весна 2026 · 6 семестр" },
  { id: "2027-spring", label: "Весна 2027 · 8 семестр" },
];
export const defaultSemesterId = "2026-autumn";
export const demoPerformance: Readonly<Record<string, SemesterPerformance>> = {
  "2026-autumn": {
    semesterId: "2026-autumn",
    disciplines: [
      {
        id: "databases",
        name: "Базы данных",
        teacher: "Елена Орлова",
        assessment: "credit",
        grades: [
          {
            id: "db-control",
            date: "2026-10-10",
            activity: "Контрольная работа",
            value: 5,
          },
          {
            id: "db-practice",
            date: "2026-10-24",
            activity: "Практическая работа",
            value: 4,
          },
          {
            id: "db-answer",
            date: "2026-11-07",
            activity: "Ответ на занятии",
            value: 5,
          },
        ],
        final: {
          kind: "credit",
        },
        status: "passed",
        debt: null,
        examDate: null,
      },
      {
        id: "programming",
        name: "Программирование",
        assessment: "exam",
        grades: [],
        final: null,
        status: "pending",
        debt: null,
        examDate: "2027-01-20",
      },
      {
        id: "networks",
        name: "Компьютерные сети",
        assessment: "exam",
        grades: [
          {
            id: "law-essay",
            date: "2026-10-12",
            activity: "Эссе",
            value: 4,
          },
          {
            id: "law-test",
            date: "2026-10-26",
            activity: "Контрольная работа",
            value: 5,
          },
        ],
        final: {
          kind: "grade",
          value: 2,
        },
        status: "debt",
        debt: {
          reason:
            "Итоговый результат неудовлетворительный. Требуется пересдача.",
        },
        examDate: "2027-01-18",
      },
      {
        id: "english",
        name: "Английский язык",
        assessment: "credit",
        grades: [
          {
            id: "language-presentation",
            date: "2026-11-02",
            activity: "Презентация",
            value: 4,
          },
        ],
        final: null,
        status: "pending",
        debt: null,
        examDate: null,
        assessmentDate: "2027-01-25",
      },
    ],
  },
  "2026-spring": {
    semesterId: "2026-spring",
    disciplines: [
      {
        id: "history",
        name: "История международных отношений",
        assessment: "exam",
        grades: [
          {
            id: "history-seminar",
            date: "2026-04-21",
            activity: "Семинар",
            value: 4,
          },
        ],
        final: {
          kind: "grade",
          value: 4,
        },
        status: "passed",
        debt: null,
        examDate: "2026-06-16",
      },
      {
        id: "research",
        name: "Методы научных исследований",
        assessment: "credit",
        grades: [],
        final: {
          kind: "credit",
        },
        status: "passed",
        debt: null,
        examDate: null,
      },
    ],
  },
  "2027-spring": {
    semesterId: "2027-spring",
    disciplines: [],
  },
};
export const loadDemoPerformance: PerformanceLoader = async (
  semesterId,
  signal,
) => {
  signal.throwIfAborted();
  const result = demoPerformance[semesterId];
  if (!result) throw new Error("Unknown demo semester");
  return result;
};
