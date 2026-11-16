import type { ReactNode } from "react";
import { MapPin, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { dateKey, assessmentOutcome, changedFields, formatDay, formatTime, isCurrent, type Lesson, type ScheduleEvent } from "./model";
import { groups } from "./catalog";
import { TeacherButton } from "./TeacherButton";
import "./schedule.css";

function GroupLink({ id }: { id: string }) {
  const [search] = useSearchParams();
  return <Link to={`/student/schedule/groups/${id}?${search.toString()}`}>Группа {groups.find(g => g.id === id)?.name}</Link>;
}

function ChangedValue({ changed, description, children }: {
  changed: boolean; description: string; children: ReactNode;
}) {
  return changed ? (
    <mark className="schedule-field-changed">
      <span className="sr-only">{description}. </span>{children}
    </mark>
  ) : <>{children}</>;
}

export function ScheduleRow({ lesson, now, teacherView = false }: { lesson: Lesson; now: Date; teacherView?: boolean }) {
  const current = isCurrent(lesson, now);
  const event = lesson as Partial<ScheduleEvent>;
  const outcome = assessmentOutcome({ ...lesson, category: event.category, assessmentResult: event.assessmentResult }, now);
  const change = lesson.change;
  const changed = changedFields(lesson);
  const previous: string[] = [];
  const previousLocation = change.status === "rescheduled" ? change.location : undefined;
  if (change.status === "rescheduled") {
    if (changed.time) {
      const date = dateKey(new Date(change.startsAt)) !== dateKey(new Date(lesson.startsAt))
        ? `${formatDay(dateKey(new Date(change.startsAt)), { day: "numeric", month: "long", year: "numeric" })}, `
        : "";
      previous.push(`${date}${formatTime(change.startsAt)}–${formatTime(change.endsAt)}`);
    }
    if (changed.room) previous.push(previousLocation
      ? `${previousLocation.address} · корп. ${previousLocation.building} · ${change.room} · ${previousLocation.floor} этаж`
      : change.room);
    if (changed.teacher) previous.push(change.teacher);
  }
  return (
    <li className={`schedule-row${current ? " schedule-current" : ""}${change.status === "cancelled" ? " schedule-cancelled" : ""}${outcome === "passed" ? " schedule-passed" : outcome ? " schedule-unsuccessful" : ""}`}>
      <p className="schedule-time">
        <ChangedValue changed={changed.time} description="Время изменено">
          <time dateTime={lesson.startsAt}>{formatTime(lesson.startsAt)}</time>
          {"–"}
          <time dateTime={lesson.endsAt}>{formatTime(lesson.endsAt)}</time>
        </ChangedValue>
      </p>
      <div className="schedule-details">
        <h3>{lesson.title}</h3>
        <div className="schedule-meta muted">
          <p className={event.category === "assessment" ? "schedule-assessment-kind" : undefined}>{lesson.kind}</p>
        </div>
      </div>
      <div className="schedule-place muted">
        <MapPin aria-hidden="true" />
        <span>
          {event.location && <>
            <ChangedValue changed={!!previousLocation && previousLocation.address !== event.location.address} description="Адрес изменён">{event.location.address}</ChangedValue>
            {" · "}<ChangedValue changed={!!previousLocation && previousLocation.building !== event.location.building} description="Корпус изменён">корп. {event.location.building}</ChangedValue>{" · "}
          </>}
          <ChangedValue changed={change.status === "rescheduled" && change.room !== lesson.room} description="Аудитория изменена">{lesson.room}</ChangedValue>
          {event.location && <> · <ChangedValue changed={!!previousLocation && previousLocation.floor !== event.location.floor} description="Этаж изменён">{event.location.floor} этаж</ChangedValue></>}
        </span>
      </div>
      <div className="schedule-person">
        {teacherView && event.groupId && <GroupLink id={event.groupId} />}
        {!teacherView &&
          <p className="schedule-teacher">
            <UserRound aria-hidden="true" />
            <ChangedValue changed={changed.teacher} description="Преподаватель изменён">
              {event.teacherId ? <TeacherButton teacherId={event.teacherId} /> : lesson.teacher}
            </ChangedValue>
          </p>}
      </div>
      <div className="schedule-changes">
        <div className="schedule-badges">
          {outcome && <span className={`schedule-badge schedule-result-${outcome}`}>
            {outcome === "passed" ? "Сдано" : outcome === "absent" ? "Неявка" : "Не сдано"}
          </span>}
          {current && <span className="schedule-badge schedule-badge-current">Сейчас</span>}
          {change.status !== "scheduled" && (
            <span className={`schedule-badge schedule-badge-${change.status}`}>
              {change.status === "rescheduled" ? "Перенесено" : "Отменено"}
            </span>
          )}
        </div>
        {previous.length > 0 && (
          <p className="schedule-previous muted">
            Было: {previous.join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}
