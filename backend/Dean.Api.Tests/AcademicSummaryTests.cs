using Dean.Api.Modules.AcademicPerformance;
using Xunit;

public sealed class AcademicSummaryTests
{
    [Fact]
    public void CreditsAreCountedSeparatelyAndNeverBecomeNumericGrades()
    {
        var summary = PerformanceSummaryCalculator.Calculate([
            Discipline("Exam", AssessmentKind.Exam, new(FinalKind.Grade, 5), ResultStatus.Passed),
            Discipline("Failed exam", AssessmentKind.Exam, new(FinalKind.Grade, 2), ResultStatus.Debt),
            Discipline("Credit", AssessmentKind.Credit, new(FinalKind.Credit, null), ResultStatus.Passed),
            Discipline("Failed credit", AssessmentKind.Credit, new(FinalKind.FailedCredit, null), ResultStatus.Debt),
            Discipline("Pending credit", AssessmentKind.Credit, null, ResultStatus.Pending)
        ], new(2026, 11, 10));
        Assert.Equal(1, summary.Credits);
        Assert.Equal(2, summary.Passed);
        Assert.Equal(2, summary.Debts);
        Assert.Equal(3.5m, summary.Average);
        Assert.Null(summary.NextExam);
    }

    [Theory]
    [InlineData("2027-01-19", "First exam")]
    [InlineData("2027-01-20", "First exam")]
    [InlineData("2027-01-21", "Second exam")]
    [InlineData("2027-01-22", "Second exam")]
    [InlineData("2027-01-23", null)]
    public void NextExamIncludesTodayAndExcludesPastCompletedCreditsAndUndated(string today, string? expectedName)
    {
        var summary = PerformanceSummaryCalculator.Calculate([
            Discipline("First exam", AssessmentKind.Exam, null, ResultStatus.Pending, new(2027, 1, 20)),
            Discipline("Second exam", AssessmentKind.Exam, null, ResultStatus.Pending, new(2027, 1, 22)),
            Discipline("Past exam", AssessmentKind.Exam, null, ResultStatus.Pending, new(2027, 1, 18)),
            Discipline("Credit", AssessmentKind.Credit, null, ResultStatus.Pending, new(2027, 1, 19)),
            Discipline("Completed exam", AssessmentKind.Exam, new(FinalKind.Grade, 5), ResultStatus.Passed, new(2027, 1, 19)),
            Discipline("Debt", AssessmentKind.Exam, new(FinalKind.Grade, 2), ResultStatus.Debt, new(2027, 1, 19)),
            Discipline("Undated", AssessmentKind.Exam, null, ResultStatus.Pending)
        ], DateOnly.Parse(today));
        Assert.Equal(expectedName, summary.NextExam?.Name);
    }

    [Fact]
    public void EmptySemesterHasNoAverageCreditsOrNextExam()
    {
        var summary = PerformanceSummaryCalculator.Calculate([], new(2026, 11, 10));
        Assert.Equal(0, summary.Total);
        Assert.Equal(0, summary.Credits);
        Assert.Null(summary.Average);
        Assert.Null(summary.NextExam);
    }

    private static DisciplineDto Discipline(string name, AssessmentKind assessment, FinalDto? final, ResultStatus status, DateOnly? date = null) =>
        new(Guid.NewGuid(), name, null, assessment, date, [], final, status, null, true);
}
