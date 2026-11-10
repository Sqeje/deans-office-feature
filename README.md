# Цифровой деканат будущего

Кабинеты студента и сотрудника для AI Challenge MGIMO. Работают вход, выход, общий сеанс, студенческий профиль и успеваемость: серверные результаты, сводка главной и внесение локальных итогов сотрудником назначенной группы. Расписание, обращения и уведомления пока представлены отдельными пустыми страницами. Данные вымышлены.

Стек: React/TypeScript/Vite, Tailwind 4 и компоненты shadcn/ui; ASP.NET Core Identity / EF Core / Npgsql 10; PostgreSQL 17; Caddy и Docker Compose. Архитектура — модульный монолит.

## Быстрый запуск

1. Установите Git и Docker Desktop (Windows: Linux containers/WSL2) либо Docker Engine с Compose на Linux. Убедитесь: `docker --version`, `docker compose version`.
2. Получите репозиторий: `git clone <URL>` и перейдите в его каталог.
3. Скопируйте `.env.example` в `.env` (`Copy-Item .env.example .env` в PowerShell, `cp .env.example .env` в Linux).
4. В `.env` замените четыре CHANGE_ME пароля уникальными. Демо-пароли: минимум 12 символов, верхний/нижний регистр, цифры и символы. Пароль БД — случайный, без `;`. Не публикуйте этот файл.
5. `docker compose up -d --build`. Первая сборка скачивает зависимости и занимает несколько минут.
6. `docker compose ps -a`: initialize должен завершиться с кодом 0, db/api/web — работать. При ошибке: `docker compose logs initialize api web`.
7. Откройте **https://localhost**. Локальный сертификат Caddy не доверенный: для разработки подтвердите исключение для localhost либо установите локальный корневой сертификат Caddy. На публичном домене Caddy получает доверенный сертификат автоматически.
8. Сотрудник входит как `staff@demo.invalid` с паролем Demo__StaffPassword. Студенты входят как `student1@demo.invalid` и `student2@demo.invalid`, используя соответствующие пароли из `.env`. Для независимых сеансов используйте обычное и приватное окно. Проверьте разные ФИО в профиле, обновление страницы и выход.
9. https://localhost/health должен вернуть Healthy. https://localhost/openapi/v1.json — описание API. `/api/identity/session` возвращает общий контекст аккаунта; `/api/identity/me` — профиль студента. Без входа /api/identity/me возвращает 401.

Остановка: `docker compose down`. Данные остаются в томах. **Не добавляйте -v**, если хотите сохранить данные. Seed повторяемый и не сбрасывает пароли существующих пользователей.

## Разработка вне контейнеров

Нужны .NET SDK 10, Node.js 24 и PostgreSQL 17. `docker compose up -d db` запускает БД без опубликованного порта; для локального API используйте собственную локальную PostgreSQL или временный Compose override с привязкой `127.0.0.1:5432:5432`.

PowerShell, из корня:

```powershell
$env:ConnectionStrings__Database='Host=localhost;Database=dean;Username=dean;Password=<ваш-пароль>'
$env:Demo__Enabled='true'
$env:Demo__Password1='<первый-пароль>'
$env:Demo__Password2='<второй-пароль>'
$env:Demo__StaffPassword='<пароль-сотрудника>'
dotnet tool restore
dotnet run --project backend/Dean.Api -- --initialize
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet run --project backend/Dean.Api --urls http://localhost:8080
```

Во втором терминале: `cd frontend`, `npm ci`, `npm run dev`; откройте http://localhost:5173. Vite проксирует /api на API. HTTP допустим только в локальном Development; публичное развёртывание использует HTTPS.

## Проверки

```powershell
dotnet build backend/Dean.Api/Dean.Api.csproj
$env:TEST_DATABASE='Host=localhost;Database=dean_test;Username=dean;Password=<пароль>'
dotnet test backend/Dean.Api.Tests
cd frontend
npm ci
npm run build
```

TEST_DATABASE должна быть отдельной пустой БД для каждого полного прогона. AcademicPerformanceTests дополнительно создают на том же сервере уникальные БД `slice6_test_<uuid>` и удаляют только эти БД после тестов; тестовому пользователю нужны права CREATEDB. Пользовательская БД не используется. CI создаёт одноразовую PostgreSQL. Контракты клиента обновляются командой `npm run api:generate` при работающем API.

Браузерная проверка: при запущенном локальном API задайте DEMO_PASSWORD1, DEMO_PASSWORD2 и DEMO_STAFF_PASSWORD равными паролям созданных аккаунтов. В frontend выполните `npx playwright install chromium`, затем `npx playwright test`. Тест сам запустит Vite и проверит два студенческих аккаунта, сотрудника, публичную часть и старые ссылки на ширине 360 px. Для установленного Chrome можно вместо скачивания Chromium задать CHROME_PATH полным путём к chrome.exe.

Границы модулей: [ARCHITECTURE](docs/ARCHITECTURE.md). Работа втроём и миграции: [CONTRIBUTING](docs/CONTRIBUTING.md). [Развёртывание](docs/DEPLOYMENT.md), [решения](docs/DECISIONS.md), [шаблон среза](docs/SLICE_TEMPLATE.md).

## Продолжение фундамента: Kernel

Три области: `/student`, `/staff`, `/applicants`. Старые `/app/*` перенаправляются в кабинет студента. Учётная запись отделена от студенческого профиля. Разрешения сотрудника выдаются по операциям и группам, общевузовские — отдельно. Для успеваемости реализована запись локального итога с `grades.write`; остальные рабочие операции сотрудников, реальные источники и расписание ещё не реализованы.

При включённом Demo seed создаёт разные результаты двух студентов. `/student/academic-performance` и сводка `/student` используют один персональный API и одинаковый выбранный семестр. Сотрудник на `/staff/academic-performance` выбирает группу ЦД-101, студента, семестр и дисциплину, сохраняет итог. После обновления студент видит его в разделе и на главной. Повторная инициализация не заменяет внесённый итог. [Срез 6: контракты, проверки и приёмка](docs/slices/6-academic-performance-api.md).

[Как подключить модуль и источник](docs/EXTENDING.md), [следующие срезы](docs/SLICES.md). Миграция KernelIdentity переносит прежние аккаунты/группы без смены паролей. Перед обновлением сохраните резервную копию: автоматический downgrade к схеме без сотрудников запрещён, восстановление выполняется из копии. Демо-seed требует три разных пароля аккаунтов и не сбрасывает уже существующие.
