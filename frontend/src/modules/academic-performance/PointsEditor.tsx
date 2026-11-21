import { useCallback, useState } from "react";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/primitives";
import { ApiError } from "../../shared/api";
import { loadPointPlan, loadStaffPointScores, savePointPlan, savePointScore, type PointPlan } from "./api";
import { RequestFailure, useRemote } from "./remote";

export function PointsEditor({ studentId, courseId }: { studentId: string; courseId: string }) {
  const loadPlan = useCallback((signal: AbortSignal) => loadPointPlan(courseId, signal), [courseId]);
  const plan = useRemote(courseId, loadPlan);
  const loadScores = useCallback((signal: AbortSignal) => loadStaffPointScores(studentId, courseId, signal), [studentId, courseId]);
  const scores = useRemote(studentId + "/" + courseId, loadScores);
  const [draft, setDraft] = useState<PointPlan>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const value = draft ?? plan.data;
  if (plan.error) return <RequestFailure error={plan.error} retry={plan.retry} title="Не удалось загрузить балльный план" />;
  if (!value || scores.data === undefined) return <Skeleton />;
  const components = value.components.length ? value.components : [
    { id: "", name: "Контрольная работа 1", kind: "assessment", maximum: 20, isAttendance: false },
    { id: "", name: "Контрольная работа 2", kind: "assessment", maximum: 20, isAttendance: false },
    { id: "", name: "Посещение занятий", kind: "attendance", maximum: 10, isAttendance: true },
    { id: "", name: "Итоговая аттестация", kind: "final", maximum: 50, isAttendance: false },
  ];
  const scored = scores.data.length > 0;
  async function submitPlan() {
    setBusy(true); setMessage("");
    try {
      const saved = await savePointPlan(courseId, { version: Number(value?.version ?? 0), components: components.map(x => ({ id: x.id || null, name: x.name, kind: x.kind, maximum: Number(x.maximum), isAttendance: x.isAttendance })) });
      setDraft(saved); plan.retry(); scores.retry(); setMessage("Балльный план сохранён.");
    } catch (error) { setMessage(error instanceof ApiError && error.status === 409 ? "План изменился или его веса уже закреплены выставленными баллами." : "Не удалось сохранить балльный план."); }
    finally { setBusy(false); }
  }
  return <section className="academic-panel points-editor" aria-label="Балльный план и баллы студента">
    <h3>Баллы по дисциплине · 100 баллов</h3>
    {components.map((component, i) => {
      const score = scores.data?.find(x => x.componentId === component.id);
      return <div className="points-editor-row" key={component.id || i}>
        <label>Название компонента<input aria-label={`Название компонента ${i + 1}`} value={component.name} disabled={busy || scored} onChange={e => setDraft({ ...value, components: components.map((x,n) => n === i ? { ...x, name: e.target.value } : x) })} /></label>
        <label>Максимум баллов<input aria-label={`Максимум: ${component.name}`} type="number" min="1" max="100" step="0.5" value={component.maximum} disabled={busy || scored} onChange={e => setDraft({ ...value, components: components.map((x,n) => n === i ? { ...x, maximum: Number(e.target.value) } : x) })} /></label>
        {!scored && <button type="button" className="text-button" aria-label={`Удалить компонент ${component.name}`} disabled={busy} onClick={() => setDraft({ ...value, components: components.filter((_,n) => n !== i) })}>Удалить</button>}
        {component.isAttendance ? <span>Из журнала посещаемости</span> : <label>Баллы студента<input aria-label={`Баллы: ${component.name}`} type="number" min="0" max={component.maximum} step="0.5" placeholder="Не выставлено" defaultValue={score?.points ?? ""} disabled={!component.id || busy} onBlur={async e => { if (!component.id) return; try { await savePointScore(studentId, courseId, component.id, { points: e.target.value === "" ? null : Number(e.target.value), version: Number(score?.version ?? 0) }); scores.retry(); setMessage("Баллы сохранены."); } catch (error) { setMessage(error instanceof ApiError && error.status === 409 ? "Баллы уже изменились. Обновите страницу." : "Не удалось сохранить баллы."); } }} /> </label>}
      </div>;
    })}
    {!scored && <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft({ ...value, components: [...components, { id: "", name: "Новая работа", kind: "assessment", maximum: 0, isAttendance: false }] })}>Добавить компонент</Button>}
    <p>Всего: {components.reduce((sum,x) => sum + Number(x.maximum), 0)} из 100</p>
    <Button type="button" disabled={busy || components.reduce((sum,x) => sum + Number(x.maximum), 0) !== 100} onClick={() => void submitPlan()}>{busy ? "Сохраняем…" : "Сохранить план баллов"}</Button>
    {message && <p role="status">{message}</p>}
  </section>;
}
