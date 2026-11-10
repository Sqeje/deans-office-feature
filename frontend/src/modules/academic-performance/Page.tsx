import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { SelectField, Skeleton } from "../../components/ui/primitives";
import { EmptyState } from "../../shared/states";
import { defaultSemesterId, loadDemoPerformance, semesters } from "./demo";
import { Overview, AllResults } from "./Views";
import { DisciplinePage } from "./DisciplinePage";
import { finalLabel, formatDate, type Discipline, type PerformanceLoader, type SemesterPerformance } from "./model";
import "./performance.css";

const Details = DisciplinePage;
type State={semester:string;attempt:number;status:"loading"|"error"|"success";data?:SemesterPerformance};
export function Page({loader=loadDemoPerformance}:{loader?:PerformanceLoader}) {
 const [params,setParams]=useSearchParams();
 const semesterId=params.get("semester")??defaultSemesterId;
 const semester=semesters.find(s=>s.id===semesterId);
 const disciplineId=params.get("discipline");
 const all=params.get("view")==="results";
 const filter=["all","passed","pending","debt"].includes(params.get("filter")??"all")?params.get("filter")??"all":"all";
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<State>({semester:semesterId,attempt,status:"loading"});
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo(0,0)},[disciplineId]);
 useEffect(()=>{
  if(!semester)return;
  const controller=new AbortController();
  setState({semester:semesterId,attempt,status:"loading"});
  void Promise.resolve().then(()=>loader(semesterId,controller.signal)).then(data=>{
   if(!controller.signal.aborted)setState({semester:semesterId,attempt,status:"success",data});
  }).catch(()=>{if(!controller.signal.aborted)setState({semester:semesterId,attempt,status:"error"})});
  return ()=>controller.abort();
 },[semesterId,semester,loader,attempt]);
 const current=state.semester===semesterId&&state.attempt===attempt;
 const data=current&&state.status==="success"?state.data:undefined;
 const selected=data?.disciplines.find(d=>d.id===disciplineId);
 const href=(id?:string)=>{const next=new URLSearchParams(params);next.set("semester",semesterId);if(id)next.set("discipline",id);else next.delete("discipline");return "?"+next};
 return <div className="academic-page">
 {disciplineId&&<Link to={href()}>Вернуться к успеваемости</Link>}
 {all&&!disciplineId&&<nav aria-label="Хлебные крошки" className="academic-breadcrumb"><Link to={"?semester="+semesterId}>Успеваемость</Link><span>/</span><span>Все результаты</span></nav>}
 <header className="academic-page-header"><div><h1 tabIndex={-1} ref={heading}>{disciplineId?selected?.name??"Дисциплина":all?"Все результаты":"Успеваемость"}</h1>{!disciplineId&&!all&&<p>Оценки и результаты обучения</p>}</div>
 <SelectField id="performance-semester" label="Семестр" value={semester?semesterId:""} onChange={e=>{const next=new URLSearchParams(params);next.set("semester",e.target.value);next.delete("discipline");setParams(next)}}>
 {!semester&&<option value="" disabled>Неизвестный семестр</option>}{semesters.map((s,i)=><option key={s.id} value={s.id}>{["Семестр 7","Семестр 6","Семестр 8"][i]}</option>)}</SelectField></header>
 {!semester?<EmptyState title="Семестр не найден" text="Выберите доступный семестр."/>:!current||state.status==="loading"?<Skeleton/>:state.status==="error"?<section className="academic-panel" role="alert"><h2>Не удалось загрузить успеваемость</h2><Button variant="primary" onClick={()=>setAttempt(n=>n+1)}>Повторить</Button></section>:data&&<>
 <span className="sr-only" role="status">Загружено дисциплин: {data.disciplines.length}</span>
 {disciplineId?(selected?<Details discipline={selected}/>:<EmptyState title="Дисциплина не найдена" text="Выберите дисциплину в этом семестре."/>):all?<AllResults disciplines={data.disciplines} href={href} filter={filter} onFilter={value=>{const next=new URLSearchParams(params);next.set("filter",value);setParams(next)}}/>:data.disciplines.length?<Overview disciplines={data.disciplines} href={href}/>:<EmptyState title="Дисциплин пока нет" text="Выберите другой семестр."/>}
 </>}
 <p className="academic-demo-note">Учебные примеры, не персональные результаты.</p></div>;
}
