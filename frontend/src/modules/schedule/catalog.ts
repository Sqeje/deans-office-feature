export const myGroupId = "pi-21";
export const directions = [
  { id: "informatics", name: "Информатика и вычислительная техника" },
  { id: "economics", name: "Экономика" },
  { id: "linguistics", name: "Лингвистика" },
  { id: "mathematics", name: "Математика" },
];
export const programs = [
  { id: "applied-informatics", directionId: "informatics", name: "Прикладная информатика" },
  { id: "finance", directionId: "economics", name: "Финансы и кредит" },
  { id: "translation", directionId: "linguistics", name: "Перевод и переводоведение" },
  { id: "applied-math", directionId: "mathematics", name: "Прикладная математика" },
];
export const groups = [
  { id: "pi-21", name: "ПИ-21", programId: "applied-informatics", year: 2024 },
  { id: "pi-22", name: "ПИ-22", programId: "applied-informatics", year: 2024 },
  { id: "ek-21", name: "ЭК-21", programId: "finance", year: 2024 },
  { id: "lg-21", name: "ЛГ-21", programId: "translation", year: 2024 },
  { id: "mt-21", name: "МТ-21", programId: "applied-math", year: 2024 },
];
export const teachers = [
  { id: "lebedev", name: "Иван Викторович Лебедев", shortName: "И. В. Лебедев" },
  { id: "orlova", name: "Мария Павловна Орлова", shortName: "М. П. Орлова" },
  { id: "mironov", name: "Александр Владимирович Миронов", shortName: "А. В. Миронов" },
];
export const catalogPath = "/student/schedule/catalog";
export function groupPath(id: string) {
  return id === myGroupId ? "/student/schedule" : `/student/schedule/groups/${id}`;
}
export function searchTeachers(query: string) {
  const normalize = (s: string) => s.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[.\s]+/g, " ").trim();
  const tokens = normalize(query).split(" ").filter(Boolean);
  return teachers.filter(t => tokens.every(token => normalize(`${t.name} ${t.shortName}`).includes(token)));
}
