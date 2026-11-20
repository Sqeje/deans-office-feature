import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { catalogPath } from "./catalog";
import { useSchedulePaths } from "./paths";
import { useServerCatalog } from "./serverCatalog";
export interface Crumb { title: string; to?: string }
export function Breadcrumbs({items}:{items:Crumb[]}) {return <nav className="schedule-breadcrumbs" aria-label="Путь расписания"><ol>{items.map((item,i)=><li key={i}>{i>0&&<ChevronRight aria-hidden="true"/>}{item.to?<Link to={item.to}>{item.title}</Link>:<span aria-current="page">{item.title}</span>}</li>)}</ol></nav>;}
export function groupCrumbs(groupId:string,catalog=catalogPath):Crumb[]{return [{title:"Все расписания",to:catalog},{title:groupId}];}
export function NotFound(){const {catalog}=useSchedulePaths();return <section><h1>Расписание не найдено</h1><p>Проверьте адрес или выберите доступную группу и преподавателя в каталоге.</p><Link to={catalog}>Открыть каталог</Link></section>;}
export function CatalogPage(){
 const {base}=useSchedulePaths();const {data,error}=useServerCatalog();const [query,setQuery]=useState("");
 if(error)return <p role="alert">Не удалось загрузить каталог. Обновите страницу.</p>;
 if(!data)return <p role="status">Загрузка каталога…</p>;
 const teachers=data.teachers.filter(t=>t.name.toLocaleLowerCase("ru-RU").replaceAll("ё","е").includes(query.toLocaleLowerCase("ru-RU").replaceAll("ё","е")));
 return <><Breadcrumbs items={[{title:"Все расписания"}]}/><h1>Все расписания</h1><p className="muted">Группы и преподаватели, доступные вашему аккаунту</p><div className="schedule-catalog-grid"><section className="card"><h2>Группы</h2>{data.groups.length?<ul className="schedule-catalog-list">{data.groups.map(g=><li key={g.id}><Link to={`${base}/groups/${g.id}`}>{g.name}<ChevronRight aria-hidden="true"/></Link></li>)}</ul>:<p>Доступных групп нет.</p>}</section><section className="card schedule-search"><h2>Расписания преподавателей</h2><label htmlFor="teacher-search">Поиск преподавателя</label><input id="teacher-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Фамилия или имя преподавателя"/>{teachers.length?<ul>{teachers.map(t=><li key={t.id}><Link to={`${base}/teachers/${t.id}`}>{t.name}</Link></li>)}</ul>:<p>Преподаватели не найдены.</p>}</section></div></>;
}
