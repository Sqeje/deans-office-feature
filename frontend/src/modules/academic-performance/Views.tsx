import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/ui/primitives";
import { finalLabel, formatDate, resultPresentation, type Discipline } from "./model";
import { Icon } from "./Icon";
export function Result({discipline:d}:{discipline:Discipline}) {
 return <StatusBadge tone={resultPresentation[d.status].tone}>{d.status==="debt"?"Задолженность":finalLabel(d.final)}</StatusBadge>;
}
export function ResultsTable({disciplines,href}:{disciplines:readonly Discipline[];href:(id:string)=>string}) {
 return <div className="academic-table" role="table" aria-label="Результаты дисциплин">
 <div role="row" className="academic-table-head"><span role="columnheader">Дисциплина</span><span role="columnheader">Аттестация</span><span role="columnheader">Результат</span><span/></div>
 {disciplines.map(d=><div role="row" key={d.id}><Link className="academic-table-row" to={href(d.id)} aria-label={"Открыть дисциплину: "+d.name}><strong role="cell">{d.name}</strong><span role="cell" className="academic-assessment">{d.assessment==="exam"?"Экзамен":"Зачёт"}</span><span role="cell"><Result discipline={d}/></span><Icon name="arrow"/></Link></div>)}
 </div>;
}
export function Overview({disciplines,href}:{disciplines:readonly Discipline[];href:(id:string)=>string}) {
 const credits=disciplines.filter(d=>d.final?.kind==="credit").length;
 const stats=[["layers","Дисциплины",disciplines.length],["check","Зачёты",credits],["alert","Задолженности",disciplines.filter(d=>d.debt).length]];
 return <><div className="academic-stats">{stats.map(([icon,label,value])=><div className="academic-stat" key={label}><span className="academic-icon"><Icon name={String(icon)}/></span><div><h2>{label}</h2><strong>{value}</strong></div></div>)}</div>
 <div className="academic-overview-grid"><section className="academic-panel"><h2>Дисциплины</h2><ResultsTable disciplines={disciplines} href={href}/></section>
 <section className="academic-panel academic-session"><h2>Сессия</h2><div>{disciplines.filter(d=>d.examDate&&d.status==="pending").map(d=><Link className="academic-session-row" key={d.id} to={href(d.id)}><span className="academic-icon"><Icon name="calendar"/></span><span><strong>{d.name}</strong><span>{d.assessment==="exam"?"Экзамен":"Зачёт"} · {formatDate(d.examDate!)}</span></span></Link>)}</div>
 {!disciplines.some(d=>d.examDate&&d.status==="pending")&&<p className="muted">Даты сессии пока не назначены.</p>}
 </section></div></>;
}

