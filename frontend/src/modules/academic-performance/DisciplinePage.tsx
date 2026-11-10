import { Icon } from "./Icon";
import { Result } from "./Views";
import { formatDate, type Discipline } from "./model";
export function DisciplinePage({discipline:d}:{discipline:Discipline}) {
 return <><section className="academic-attestation" aria-label="Итоговая аттестация"><span className="academic-icon"><Icon name="layers"/></span><div><p>Итоговая аттестация</p><h2>{d.assessment==="credit"?"Зачёт":"Экзамен"}</h2></div><Result discipline={d}/></section>
 <div className="academic-discipline-grid"><section className="academic-panel"><h2>Текущие оценки</h2>
 {d.grades.length?<div className="academic-grades" role="table" aria-label="Текущие оценки"><div className="academic-grades-row academic-table-head" role="row"><span role="columnheader">Вид работы</span><span role="columnheader">Дата</span><span role="columnheader">Оценка</span></div>
 {d.grades.map((g,i)=><div className="academic-grades-row" role="row" key={g.id}><span role="cell" className="academic-work"><span className="academic-icon"><Icon name={["document","code","chat"][i%3]}/></span><strong>{g.activity}</strong></span><time role="cell" dateTime={g.date}>{formatDate(g.date)}</time><span role="cell" className="academic-grade" aria-label={"Оценка "+g.value}>{g.value}</span></div>)}</div>:<p className="muted">Текущих оценок пока нет.</p>}</section>
 <section className="academic-panel academic-about"><h2>О дисциплине</h2><div><span className="academic-icon"><Icon name="user"/></span><p>Преподаватель:<strong>{d.teacher??"Пока не указан"}</strong></p></div><div><span className="academic-icon"><Icon name="cap"/></span><p>Форма аттестации:<strong>{d.assessment==="credit"?"зачёт":"экзамен"}</strong></p></div>
 {(d.examDate||d.assessmentDate)&&<div><span className="academic-icon"><Icon name="calendar"/></span><p>{d.assessment==="exam"?"Дата экзамена:":"Дата зачёта:"}<strong>{formatDate((d.examDate??d.assessmentDate)!)}</strong></p></div>}</section></div>
 {d.debt&&<section className="academic-panel" role="note"><h2>Задолженность</h2><p>{d.debt.reason}</p></section>}</>;
}
