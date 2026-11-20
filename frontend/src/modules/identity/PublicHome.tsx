import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Mail,
  GraduationCap,
  FileText,
  Presentation,
  UserRound,
} from "lucide-react";
import { Brand, PrototypeNotice } from "../../shared/brand";
import { Button } from "../../components/ui/button";
import "./PublicHome.css";

type PublicInfo = "contact";
export function PublicLayout({
  children,
  infoActions,
}: {
  children: ReactNode;
  infoActions?: ReactNode;
}) {
  return (
    <div className="public-page">
      <a className="skip-link" href="#public-main">
        К содержимому
      </a>
      <div className="public-container">
        <header className="public-header">
          <Brand />
          {infoActions && (
            <nav aria-label="Публичная информация">{infoActions}</nav>
          )}
        </header>
        {children}
        <footer className="public-footer">
          <PrototypeNotice />
        </footer>
      </div>
    </div>
  );
}
export function PublicHome() {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const message = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (info) message.current?.focus();
  }, [info]);
  const toggle = (value: PublicInfo) =>
    setInfo((current) => (current === value ? null : value));
  function action(value: PublicInfo, label: string) {
    return (
      <button
        type="button"
        className="public-info-action"
        aria-controls="public-information"
        aria-expanded={info === value}
        onClick={() => toggle(value)}
      >
        <Mail aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <PublicLayout
      infoActions={
        <>
          <Link className="public-info-action" to="/schedule"><CalendarDays aria-hidden="true" />Расписание</Link>
          {action("contact", "Связаться")}
        </>
      }
    >
      <main id="public-main" className="public-main">
        <section className="public-hero" aria-labelledby="public-title">
          <span className="public-hero-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <h1 id="public-title">Вся университетская жизнь в одном месте</h1>
          <p>Расписание, оценки и обращения в деканат</p>
        </section>
        <section className="role-grid" aria-label="Выберите свой путь">
          <article className="role-card">
            <UserRound aria-hidden="true" className="role-icon" />
            <h2>Я студент</h2>
            <p className="role-description">
              Учёба, оценки, заявки и расписание
            </p>
            <Button asChild className="role-action">
              <Link to="/login" aria-label="Продолжить как студент">
                Продолжить <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </article>
          <article className="role-card">
            <FileText aria-hidden="true" className="role-icon" />
            <h2>Я поступающий</h2>
            <p className="role-description">Информация о поступлении</p>
            <div className="role-unavailable">
              <span>Скоро</span>
              <p>Раздел поступления пока недоступен</p>
            </div>
            <Button asChild variant="outline" className="role-action">
              <Link to="/applicants" aria-label="О разделе поступления">
                О разделе <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </article>
          <article className="role-card">
            <Presentation aria-hidden="true" className="role-icon" />
            <h2>Я сотрудник</h2>
            <p className="role-description">
              Рабочий кабинет и доступные разделы университета
            </p>
            <Button asChild className="role-action">
              <Link to="/login" aria-label="Продолжить как сотрудник">
                Продолжить <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </article>
        </section>
        <div className="public-secondary-actions">
          <Link className="public-info-action" to="/schedule"><CalendarDays aria-hidden="true" />Расписание без входа</Link>
          {action("contact", "Связаться с нами")}
        </div>
        <div
          id="public-information"
          hidden={!info}
          className="public-information"
          role="status"
          tabIndex={-1}
          ref={message}
        >
          {info === "contact" ? (
            <>
              <h2>Связаться с нами</h2>
              <p>Контакты университета пока не опубликованы.</p>
            </>
          ) : null}
        </div>
      </main>
    </PublicLayout>
  );
}
export function ApplicantsPage() {
  return (
    <PublicLayout>
      <main id="public-main" className="applicants-main">
        <Link to="/">На главную</Link>
        <span className="applicants-soon">Скоро</span>
        <h1>Будущим студентам</h1>
        <p className="applicants-lead">
          Информация о поступлении появится здесь позже.
        </p>
        <section className="public-information">
          <h2>Раздел поступления пока недоступен</h2>
          <p>
            Это информационная область конкурсного прототипа. Подача заявлений
            здесь не выполняется.
          </p>
          <p>Программы обучения и условия поступления пока не опубликованы.</p>
        </section>
        <Link className="applicants-login" to="/login">
          Вход для студентов и сотрудников <ArrowRight aria-hidden="true" />
        </Link>
      </main>
    </PublicLayout>
  );
}
