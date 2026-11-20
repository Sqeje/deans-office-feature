namespace Dean.Api.Modules.Requests;

public static class RequestCatalog
{
    public sealed record Entry(string Kind, string Title, string Form);
    public static readonly Entry[] Entries = [
        new("certificate", "Справка об обучении", "certificate"),
        new("scholarship_certificate", "Справка о стипендии", "certificate"),
        new("study_period_certificate", "Справка о периоде обучения", "certificate"),
        new("statement", "Заявление на индивидуальный график", "period"),
        new("academic_leave", "Предоставление академического отпуска", "period"),
        new("academic_return", "Выход из академического отпуска", "comment"),
        new("bank_card", "Оформление или замена банковской карты", "comment"),
        new("event", "Участие во внеучебном мероприятии", "period"),
        new("passport_change", "Изменение паспортных данных", "comment"),
        new("named_scholarship", "Заявка на именную стипендию", "comment"),
        new("military_training", "Обращение по военной подготовке", "comment"),
        new("tuition_payment", "Обращение по оплате обучения", "comment"),
        new("withdrawal", "Отчисление по собственному желанию", "comment"),
        new("dormitory", "Обращение по поселению в общежитие", "comment"),
        new("arrival", "Подтверждение прибытия на поселение", "comment"),
        new("social_payment", "Заявка на социальную выплату", "comment")
    ];
    public static Entry? Find(string kind) => Entries.SingleOrDefault(x => x.Kind == kind);
    public const string CertificateKinds = "'certificate','scholarship_certificate','study_period_certificate'";
    public const string PeriodKinds = "'statement','academic_leave','event'";
    public const string CommentKinds = "'academic_return','bank_card','passport_change','named_scholarship','military_training','tuition_payment','withdrawal','dormitory','arrival','social_payment'";
    public const string InputConstraint = "(\"Kind\" IN (" + CertificateKinds + ") AND \"Place\" IS NOT NULL AND length(trim(\"Place\")) > 0 AND \"Copies\" BETWEEN 1 AND 5 AND \"Copies\" IS NOT NULL AND \"Start\" IS NULL AND \"End\" IS NULL) OR (\"Kind\" IN (" + PeriodKinds + ") AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NOT NULL AND \"End\" IS NOT NULL AND \"End\" >= \"Start\" AND \"Place\" IS NULL AND \"Copies\" IS NULL) OR (\"Kind\" IN (" + CommentKinds + ") AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NULL AND \"End\" IS NULL AND \"Place\" IS NULL AND \"Copies\" IS NULL)";
}
