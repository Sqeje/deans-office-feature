import { client, check, csrf } from "../../shared/api";
import type { components } from "../../shared/schema";
import type { EventSource, Lesson, ScheduleEvent } from "./model";

export type ServerEvent = components["schemas"]["EventDto"];
export type ScheduleContext = components["schemas"]["ScheduleContextDto"];
export type UpdateEvent = components["schemas"]["UpdateEventRequest"];
export type TeacherContext = components["schemas"]["TeacherContextDto"];
export const scheduleApi = {
  async teacherContext(signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/teacher/context", { signal });
    await check(response, error); return data!;
  },
  async teacherMine(start: string, end: string, category: "lesson" | "assessment", signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/teacher/mine", { params: { query: { start, end, category } }, signal });
    await check(response, error); return data!;
  },
  async context(signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/context", { signal });
    await check(response, error); return data!;
  },
  async mine(start: string, end: string, category: "lesson" | "assessment", signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/mine", { params: { query: { start, end, category } }, signal });
    await check(response, error); return data!;
  },
  async next(signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/next", { signal });
    await check(response, error); return data!;
  },
  async staff(start: string, end: string, category: "lesson" | "assessment", signal?: AbortSignal) {
    const { data, response, error } = await client.GET("/api/schedule/staff", { params: { query: { start, end, category } }, signal });
    await check(response, error); return data!;
  },
  async update(id: string, body: UpdateEvent) {
    const { data, response, error } = await client.PUT("/api/schedule/{id}", { params: { path: { id } }, body, headers: await csrf() });
    await check(response, error); return data!;
  },
};
export function toEvent(event: ServerEvent): ScheduleEvent {
  const change: Lesson["change"] = event.status === "rescheduled" && event.previous
    ? { status: "rescheduled", ...event.previous, location: { ...event.previous.location, floor: Number(event.previous.location.floor) } }
    : { status: event.status === "cancelled" ? "cancelled" : "scheduled" };
  return { id: event.id, groupId: event.groupId, groupName: event.groupName, teacherId: "", teacher: event.teacher,
    title: event.title, courseId: event.courseId, kind: event.kind, category: event.category, room: event.room,
    startsAt: event.startsAt, endsAt: event.endsAt, location: { ...event.location, floor: Number(event.location.floor) }, change, serverBacked: true };
}
export const personalSource: EventSource = async (query, signal) =>
  (await scheduleApi.mine(query.start, query.end, query.category, signal)).events.map(toEvent);
export const teacherSource: EventSource = async (query, signal) =>
  (await scheduleApi.teacherMine(query.start, query.end, query.category, signal)).events.map(event => ({ ...toEvent(event), teacherId: query.entity.id }));
