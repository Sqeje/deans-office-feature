import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../shared/utils";
import "./primitives.css";
export function SectionCard({
  title,
  description,
  action,
  children,
  ...props
}: ComponentProps<"section"> & { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <section {...props} className={cn("section-card", props.className)}>
      <header className="section-card-header">
        <h2>{title}</h2>
        {action && <div className="section-card-action">{action}</div>}
      </header>
      {description && <p className="section-card-description">{description}</p>}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
  children,
  headingProps,
  className,
  ...props
}: ComponentProps<"header"> & { title?: string; description?: ReactNode; action?: ReactNode; headingProps?: Omit<ComponentProps<"h1">, "children"> }) {
  return (
    <header {...props} className={cn("page-header", className)}>
      <div className="page-header-copy">
        {title && <h1 {...headingProps}>{title}</h1>}
        {description && <p>{description}</p>}
      </div>
      {(action || children) && <div className="page-header-actions">{action ?? children}</div>}
    </header>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "aria-describedby"> & {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
};

export function TextField({ id, label, description, error, className, ...props }: TextFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {description && <p id={descriptionId} className="muted">{description}</p>}
      <input
        {...props}
        id={id}
        className={cn("text-field-control", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id" | "aria-describedby"> & {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
};

export function TextAreaField({ id, label, description, error, className, ...props }: TextAreaFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {description && <p id={descriptionId} className="muted">{description}</p>}
      <textarea
        {...props}
        id={id}
        className={cn("text-field-control text-area-control", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}

type PasswordFieldProps = Omit<ComponentProps<"input">, "id" | "type" | "aria-describedby"> & {
  id: string;
  label: string;
  error?: string;
  visible: boolean;
  onToggleVisibility: () => void;
};

export function PasswordField({ id, label, error, visible, onToggleVisibility, ...props }: PasswordFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input {...props} id={id} type={visible ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={errorId} />
        <button className="icon-button" type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible} onClick={onToggleVisibility}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
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
  error,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; id: string; error?: string }) {
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = props["aria-describedby"];
  return (
    <div className="select-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined}>
        {children}
      </select>
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
export function Skeleton({ label = "Загружаем данные…" }: { label?: string }) {
  return (
    <div role="status" className="performance-loading">
      <span className="sr-only">{label}</span>
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}
