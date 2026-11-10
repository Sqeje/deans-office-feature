namespace Dean.Api.Modules.AcademicPerformance;

public static class PerformanceSummaryCalculator
{
    public static PerformanceSummary Calculate(IReadOnlyCollection<DisciplineDto> disciplines, DateOnly today)
    {
        var numbers = disciplines.Where(x => x.Final?.Kind == FinalKind.Grade)
            .Select(x => (decimal)x.Final!.Value!.Value).ToArray();
        var next = disciplines.Where(x => x.Assessment == AssessmentKind.Exam && x.Status == ResultStatus.Pending
                && x.AssessmentDate.HasValue && x.AssessmentDate.Value >= today)
            .OrderBy(x => x.AssessmentDate).ThenBy(x => x.Name, StringComparer.Ordinal).ThenBy(x => x.Id)
            .FirstOrDefault();
        return new(disciplines.Count,
            disciplines.Count(x => x.Status == ResultStatus.Passed),
            disciplines.Count(x => x.Status == ResultStatus.Debt),
            numbers.Length == 0 ? null : numbers.Average(),
            disciplines.Count(x => x.Final?.Kind == FinalKind.Credit),
            next is null ? null : new(next.Id, next.Name, next.AssessmentDate!.Value));
    }
}
