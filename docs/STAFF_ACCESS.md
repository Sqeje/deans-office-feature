# Доступ сотрудников

Роль `Staff` открывает кабинет. Рабочие роли `Teacher` и `Dean` можно совмещать; сами по себе они не предоставляют доступ к группе. `CurrentActor` читает роли и разрешения из БД в каждом запросе, поэтому отзыв применяется к существующему сеансу.

Операции доступа выполняет оператор на сервере, через конфигурацию соединения `ConnectionStrings__Database`. Публичного HTTP API администрирования нет. Пример:

```powershell
& ./scripts/Enter-DevEnvironment.ps1
dotnet run --project backend/Dean.Api -- --staff-access list <UniversityId> <UserId>
dotnet run --project backend/Dean.Api -- --staff-access assign-role <UniversityId> <UserId> Teacher
dotnet run --project backend/Dean.Api -- --staff-access grant <UniversityId> <UserId> journal.write <GroupId>
dotnet run --project backend/Dean.Api -- --staff-access assign-teaching <UniversityId> <UserId> <CourseId>
```

Поддерживаются `list`, `assign-role`, `revoke-role`, `grant`, `revoke-grant`, `assign-teaching`, `revoke-teaching`. Назначение рабочей роли также назначает техническую `Staff`; перед отзывом `Staff` нужно отозвать рабочие роли. Каждая команда проверяет университет пользователя, группу/дисциплину и выполняется атомарно в транзакции. Повторное назначение идемпотентно.

Групповые разрешения: `grades.read` — чтение успеваемости; `journal.write` — журнал; `grades.write` — итоги; `grades.correct` — исправление итогов деканатом. Последнее требует роли `Dean` и отдельного явного назначения, в демо не выдаётся. Преподавателю для записи также требуется назначение дисциплины. Остальные разрешения сохраняют существующую область действия; `announcements.publish` и `sources.manage` назначаются без GroupId.

`GET /api/identity/staff-context` возвращает рабочие роли, названия доступных групп с эффективными действиями и назначения преподавания. Это информационный контекст; сервер повторно проверяет доступ при операциях.

Демонстрационные `teacher2@demo.invalid`, `teacher3@demo.invalid`, `dean1@demo.invalid`, `dean2@demo.invalid` используют настроенный `Demo__StaffPassword`. Деканы имеют разные наборы групп и право чтения; права исправления не выдаются. Эти аккаунты и данные вымышлены.
