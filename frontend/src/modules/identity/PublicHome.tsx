import type { ReactNode } from "react";
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
  function contact(label: string) {
    return <Link className="public-info-action" to="/contacts"><Mail aria-hidden="true" />{label}</Link>;
  }
  return (
    <PublicLayout
      infoActions={
        <>
          <Link className="public-info-action" to="/schedule"><CalendarDays aria-hidden="true" />Расписание</Link>
          {contact("Связаться")}
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
              <Link to="/login" state={{ role: "student" }} aria-label="Продолжить как студент">
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
              <Link to="/login" state={{ role: "staff" }} aria-label="Продолжить как сотрудник">
                Продолжить <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </article>
        </section>
        <div className="public-secondary-actions">
          <Link className="public-info-action" to="/schedule"><CalendarDays aria-hidden="true" />Расписание без входа</Link>
          {contact("Связаться с нами")}
        </div>
      </main>
    </PublicLayout>
  );
}
export function ContactsPage() {
  return <PublicLayout><main id="public-main" className="applicants-main">
    <Link to="/">На главную</Link>
    <h1>Контакты и помощь</h1>
    <p className="applicants-lead">Демонстрационные контакты прототипа. Они не связаны с реальной службой поддержки.</p>
    <section className="public-information">
      <h2>Нет логина или пароля?</h2>
      <p>Для демонстрации используйте выданную тестовую учётную запись. Сброс пароля и отправка обращений в этом прототипе не подключены.</p>
      <Link to="/login">Перейти ко входу</Link>
    </section>
    <section className="public-information">
      <h2>Деканат</h2>
      <p>Условный демонстрационный адрес: <a href="mailto:dean.office@example.invalid">dean.office@example.invalid</a></p>
    </section>
  </main></PublicLayout>;
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
      </main>
    </PublicLayout>
  );
}
