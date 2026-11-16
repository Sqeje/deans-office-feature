import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { catalogPath, directions, programs, groups, groupPath, searchTeachers } from "./catalog";

export interface Crumb { title: string; to?: string }
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return <nav className="schedule-breadcrumbs" aria-label="Путь расписания"><ol>
    {items.map((item, i) => <li key={i}>{i > 0 && <ChevronRight aria-hidden="true" />}
      {item.to ? <Link to={item.to}>{item.title}</Link> : <span aria-current="page">{item.title}</span>}
    </li>)}
  </ol></nav>;
}
export function groupCrumbs(groupId: string): Crumb[] {
  const group = groups.find(g => g.id === groupId)!;
  const program = programs.find(p => p.id === group.programId)!;
  const direction = directions.find(d => d.id === program.directionId)!;
  const base = `${catalogPath}/${direction.id}`;
  return [{ title: "Все расписания", to: catalogPath }, { title: direction.name, to: base },
    { title: program.name, to: `${base}/${program.id}` }, { title: String(group.year), to: `${base}/${program.id}/${group.year}` }, { title: group.name }];
}
export function NotFound() {
  return <section><h1>Расписание не найдено</h1><p>Проверьте адрес или выберите группу и преподавателя в каталоге.</p><Link to={catalogPath}>Открыть каталог</Link></section>;
}
function TeacherSearch() {
  const [search, setSearch] = useSearchParams();
  const query = search.get("q") ?? "";
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  const results = searchTeachers(query);
  return <section className="card schedule-search"><h2>Расписания преподавателей</h2>
    <form onSubmit={event => { event.preventDefault(); setSearch(input.trim() ? { q: input.trim() } : {}); }}>
      <label className="sr-only" htmlFor="teacher-search">Поиск преподавателя</label>
      <div className="schedule-search-input"><Search aria-hidden="true" /><input id="teacher-search" value={input} onChange={event => setInput(event.target.value)} placeholder="Фамилия или имя преподавателя" /></div>
      <Button type="submit">Найти</Button>
    </form>
    <p className="sr-only" role="status">Найдено преподавателей: {results.length}</p>
    {results.length ? <ul>{results.map(t => <li key={t.id}><Link to={`/student/schedule/teachers/${t.id}?${new URLSearchParams({ q: query }).toString()}`}>{t.shortName}</Link></li>)}</ul> : <p>Преподаватели не найдены. Измените запрос.</p>}
  </section>;
}
export function CatalogPage() {
  const { directionId, programId, year } = useParams();
  const direction = directions.find(d => d.id === directionId);
  const program = programs.find(p => p.id === programId && p.directionId === directionId);
  const matchingGroups = groups.filter(g => g.programId === programId);
  const years = [...new Set(matchingGroups.map(g => g.year))].sort((a, b) => b - a);
  if ((directionId && !direction) || (programId && !program) || (year && !years.some(y => String(y) === year))) return <NotFound />;
  const base = `${catalogPath}/${directionId}`;
  const crumbs: Crumb[] = [{ title: "Все расписания", ...(direction ? { to: catalogPath } : {}) }];
  if (direction) crumbs.push({ title: direction.name, ...(program ? { to: base } : {}) });
  if (program) crumbs.push({ title: program.name, ...(year ? { to: `${base}/${program.id}` } : {}) });
  if (year) crumbs.push({ title: year });
  const entries = !direction ? directions.map(d => ({ title: d.name, to: `${catalogPath}/${d.id}` }))
    : !program ? programs.filter(p => p.directionId === direction.id).map(p => ({ title: p.name, to: `${base}/${p.id}` }))
    : !year ? years.map(y => ({ title: String(y), to: `${base}/${program.id}/${y}` }))
    : matchingGroups.filter(g => g.year === Number(year)).map(g => ({ title: g.name, to: groupPath(g.id) }));
  return <>
    <Breadcrumbs items={crumbs} />
    <h1>{direction?.name ?? "Все расписания"}</h1>
    <p className="muted">{program ? `${program.name}${year ? ` · ${year} год поступления` : ""}` : "Выберите направление или найдите преподавателя"}</p>
    <div className="schedule-catalog-grid">
      <section className="card"><h2>{!direction ? "Направления" : !program ? "Образовательные программы" : !year ? "Годы поступления" : "Группы"}</h2>
        <ul className="schedule-catalog-list">{entries.map(entry => <li key={entry.to}><Link to={entry.to}>{entry.title}<ChevronRight aria-hidden="true" /></Link></li>)}</ul>
      </section>
      {!direction && <TeacherSearch />}
    </div>
  </>;
}
