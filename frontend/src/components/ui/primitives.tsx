import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../shared/utils";
import "./primitives.css";
export function SectionCard({
  title,
  children,
  ...props
}: ComponentProps<"section"> & { title: string }) {
  return (
    <section {...props} className={cn("section-card", props.className)}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "danger" | "neutral";
  children: ReactNode;
}) {
  return <span className={"status-badge status-" + tone}>{children}</span>;
}
export function SelectField({
  label,
  id,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; id: string }) {
  return (
    <div className="select-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}
export function Skeleton() {
  return (
    <div role="status" className="performance-loading">
      <span className="sr-only">Загружаем успеваемость…</span>
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}
