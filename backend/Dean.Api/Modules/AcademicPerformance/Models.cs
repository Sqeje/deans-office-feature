using System.Text.Json.Serialization;

namespace Dean.Api.Modules.AcademicPerformance;

public sealed class AcademicSemester
{
    public string Id { get; set; } = "";
    public Guid UniversityId { get; set; }
    public string Label { get; set; } = "";
    public DateOnly StartsOn { get; set; }
    public bool IsDefault { get; set; }
}

public sealed class AcademicCourse
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public Guid GroupId { get; set; }
    public string SemesterId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Teacher { get; set; }
    public AssessmentKind Assessment { get; set; }
    public DateOnly? AssessmentDate { get; set; }
    public bool IsArchived { get; set; }
}

public sealed class AcademicResult
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public Guid GroupId { get; set; }
    public string StudentId { get; set; } = "";
    public Guid CourseId { get; set; }
    public FinalKind Kind { get; set; }
    public int? Value { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long Version { get; set; }
    // This slice writes local results only. A future importer must preserve ownership.
    public string? SourceId { get; set; }
    public List<AcademicGrade> Grades { get; set; } = [];
}

public sealed class AcademicGrade
{
    public Guid Id { get; set; }
    public Guid ResultId { get; set; }
    public Guid UniversityId { get; set; }
    public DateOnly Date { get; set; }
    public string Activity { get; set; } = "";
    public int Value { get; set; }
}

public sealed class CoursePointPlan
{
    public Guid CourseId { get; set; }
    public Guid UniversityId { get; set; }
    public long Version { get; set; }
    public List<CoursePointComponent> Components { get; set; } = [];
}

public sealed class CoursePointComponent
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public Guid UniversityId { get; set; }
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "assessment";
    public decimal Maximum { get; set; }
    public bool IsAttendance { get; set; }
}

public sealed class StudentPointScore
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public Guid GroupId { get; set; }
    public Guid CourseId { get; set; }
    public Guid ComponentId { get; set; }
    public string StudentId { get; set; } = "";
    public decimal? Points { get; set; }
    public long Version { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AssessmentKind>))]
public enum AssessmentKind { [JsonStringEnumMemberName("exam")] Exam, [JsonStringEnumMemberName("credit")] Credit }
[JsonConverter(typeof(JsonStringEnumConverter<FinalKind>))]
public enum FinalKind
{
    [JsonStringEnumMemberName("pending")] Pending,
    [JsonStringEnumMemberName("grade")] Grade,
    [JsonStringEnumMemberName("credit")] Credit,
    [JsonStringEnumMemberName("failed-credit")] FailedCredit
}
[JsonConverter(typeof(JsonStringEnumConverter<ResultStatus>))]
public enum ResultStatus
{
    [JsonStringEnumMemberName("pending")] Pending,
    [JsonStringEnumMemberName("passed")] Passed,
    [JsonStringEnumMemberName("debt")] Debt
}

public sealed record SemesterDto(string Id, string Label);
public sealed record SemestersResponse(SemesterDto[] Semesters, string? DefaultSemesterId);
public sealed record CurrentGradeDto(Guid Id, DateOnly Date, string Activity, int Value);
public sealed record FinalDto(FinalKind Kind, int? Value);
public sealed record DisciplineDto(Guid Id, string Name, string? Teacher, AssessmentKind Assessment,
    DateOnly? AssessmentDate, CurrentGradeDto[] Grades, FinalDto? Final, ResultStatus Status, string? DebtReason, bool IsLocal, long Version = 0);
public sealed record NextExamDto(Guid CourseId, string Name, DateOnly Date);
public sealed record PerformanceSummary(int Total, int Passed, int Debts, decimal? Average, int Credits, NextExamDto? NextExam);
public sealed record PerformanceResponse(string SemesterId, DisciplineDto[] Disciplines, PerformanceSummary Summary);
public sealed record SaveResultRequest(FinalKind Kind, int? Value, long Version = 0, string? Reason = null);
public sealed record PointComponentInput(Guid? Id, string Name, string Kind, decimal Maximum, bool IsAttendance = false);
public sealed record SavePointPlanRequest(long Version, PointComponentInput[] Components);
public sealed record CoursePointPlanDto(Guid CourseId, long Version, PointComponentDto[] Components);
public sealed record PointComponentDto(Guid Id, string Name, string Kind, decimal Maximum, bool IsAttendance);
public sealed record SavePointScoreRequest(decimal? Points, long Version);
public sealed record StudentPointScoreDto(Guid ComponentId, decimal? Points, long Version);
