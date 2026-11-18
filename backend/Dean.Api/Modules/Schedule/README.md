# Schedule

Владелец занятий и контрольных, серверного расписания и демонстрационного импорта.

ScheduleModule регистрируется через AppModules, модель — IEntityTypeConfiguration;
используется AppDbContext.Set<ScheduleEntry>(). Межмодульное чтение групп — через
IGroupDirectory модуля Identity, без прямого изменения его таблиц.

GET context/mine/next ограничиваются доверенными StudentId и UniversityId и
группой профиля. GET teacher/context, teacher/mine, staff и PUT требуют
schedule.write. События преподавателя ограничены TeacherUserId текущего аккаунта,
университетом и разрешениями групп; AccessGuard проверяет фактическую группу.
Чужую пару той же группы нельзя получить через личный API или изменить.
PUT защищён CSRF, изменяет только собственную локальную запись,
проверяет version и атомарно сохраняет аудит schedule.updated.
Аудитория локальной правки нормализуется в «Ауд. <номер>»; пустое обозначение
не принимается. Отмена сохраняет только статус: одновременное изменение
времени или места запрещено с кодом cancellation_changes_not_allowed.

DemoScheduleSource → ScheduleInterpreter → ScheduleImportApplier используют
ImportPipeline, транзакцию, уникальную внешнюю идентичность и advisory lock.
Импорт не удаляет отсутствующие записи и не затрагивает локальные правки.
Демо-инициализация разрешена только при Demo:Enabled, рабочий HTTP-запуск
импорта в этот срез не входит. Моменты хранятся в UTC, учебные даты — Europe/Moscow.

Подробные контракты, общие изменения и проверка: [срез 4](../../../../docs/slices/04-schedule-server.md).
