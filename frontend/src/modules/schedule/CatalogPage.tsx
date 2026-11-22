import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/ui/primitives";
import { ErrorPanel } from "../../shared/states";
import { ApiError } from "../../shared/api";
import { catalogPath } from "./catalog";
import { useSchedulePaths } from "./paths";
import { useServerCatalog } from "./serverCatalog";
export interface Crumb { title: string; to?: string }
export function Breadcrumbs({items}:{items:Crumb[]}) {return <nav className="schedule-breadcrumbs" aria-label="Путь расписания"><ol>{items.map((item,i)=><li key={i}>{i>0&&<ChevronRight aria-hidden="true"/>}{item.to?<Link to={item.to}>{item.title}</Link>:<span aria-current="page">{item.title}</span>}</li>)}</ol></nav>;}
export function groupCrumbs(groupId:string,catalog=catalogPath):Crumb[]{return [{title:"Все расписания",to:catalog},{title:groupId}];}
export function NotFound(){const {catalog}=useSchedulePaths();return <section><PageHeader title="Расписание не найдено" description="Проверьте адрес или выберите доступную группу и преподавателя в каталоге."/><Link to={catalog}>Открыть каталог</Link></section>;}
export function CatalogPage(){
 const {publicSchedule}=useSchedulePaths();
 const {data,error,retry}=useServerCatalog();
 if(error instanceof ApiError && error.status===401 && !publicSchedule)return <Navigate to="/login?expired=1" replace/>;
 return <>
   <PageHeader title="Все расписания" description="Расписания всех групп и преподавателей университета"/>
   {error
     ? <ErrorPanel title="Не удалось загрузить каталог" message="Проверьте соединение и повторите попытку." traceId={error instanceof ApiError ? error.traceId : undefined} onRetry={retry}/>
     : !data
       ? <p role="status">Загружаем каталог…</p>
       : <CatalogContent data={data}/>}
 </>;
}
type CatalogItems = {
  groups: readonly { id: string; name: string }[];
  teachers: readonly { id: string; name: string }[];
};

export function CatalogContent({ data }: {
  data: CatalogItems;
}) {
  const { base } = useSchedulePaths();
  const [search, setSearch] = useSearchParams();
  const query = search.get("q") ?? "";
  function setQuery(value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearch(next, { replace: true });
  }
  const normalize = (value: string) => value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  const teachers = data.teachers.filter(teacher => normalize(teacher.name).includes(normalize(query)));
  return <div className="schedule-catalog-grid">
      <section className="card">
        <h2>Группы</h2>
        {data.groups.length ? <ul className="schedule-catalog-list">
          {data.groups.map(group => <li key={group.id}>
            <Link to={`${base}/groups/${group.id}`}>{group.name}<ChevronRight aria-hidden="true" /></Link>
          </li>)}
        </ul> : <p>Доступных групп нет.</p>}
      </section>
      <section className="card schedule-search">
        <h2>Расписания преподавателей</h2>
        <label htmlFor="teacher-search">Поиск преподавателя</label>
        <input id="teacher-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Фамилия или имя преподавателя" />
        {teachers.length ? <ul>
          {teachers.map(teacher => <li key={teacher.id}>
            <Link to={`${base}/teachers/${teacher.id}?${search.toString()}`}>{teacher.name}<ChevronRight aria-hidden="true" /></Link>
          </li>)}
        </ul> : <p>Преподаватели не найдены.</p>}
      </section>
    </div>;
}
