using Dean.Api.Modules.AcademicPerformance;
using Dean.Api.Modules.Requests;
using Xunit;

public sealed class WorkplaceDemoContentTests
{
    [Fact]
    public void EveryStudentHasAllFinalStatesAndCurrentGradeRange()
    {
        for (var student = 0; student < 30; student++)
        {
            var finals = Enumerable.Range(0, 3).Select(c => WorkplaceAcademicDemoSeed.ExampleFinal(student, c)).ToArray();
            Assert.Single(finals, f => f.Kind == FinalKind.Pending && f.Value == null);
            Assert.Single(finals, f => f.Kind == FinalKind.Grade && f.Value >= 3);
            Assert.Single(finals, f => f.Kind == FinalKind.Grade && f.Value == 2);
            var marks = Enumerable.Range(0, 12).Select(l => WorkplaceAcademicDemoSeed.ExampleMark(student, l)).ToArray();
            Assert.Contains(marks, m => m.Attendance == AttendanceMark.Absent && m.Grade == null);
            Assert.Contains(marks, m => m.Attendance == AttendanceMark.Unmarked && m.Grade == null);
            foreach (var grade in new[] { 2, 3, 4, 5 }) Assert.Contains(marks, m => m.Attendance == AttendanceMark.Present && m.Grade == grade);
        }
    }

    [Fact]
    public void RequestExamplesHaveValidOrderedHistoryAndInputs()
    {
        var now = DateTimeOffset.Parse("2026-11-20T10:00:00Z");
        var examples = Enumerable.Range(0, 4).Select(i => WorkplaceRequestsDemoSeed.Example(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "student", "dean", i, now)).ToArray();
        Assert.Equal(new[] { "submitted", "in_review", "ready", "rejected" }, examples.Select(x => x.Status));
        foreach (var row in examples)
        {
            Assert.Equal(row.Status, row.History[^1].Status);
            Assert.Equal(row.Version, row.History.Count);
            Assert.Equal(row.UpdatedAt, row.History[^1].OccurredAt);
            Assert.Equal(Enumerable.Range(1, row.Version), row.History.Select(h => h.Version));
            Assert.All(row.History, h => { Assert.Equal(row.Id, h.RequestId); Assert.Equal(row.UniversityId, h.UniversityId); Assert.True(h.OccurredAt <= now); Assert.Equal(h.Version > 1, h.IsStaff); Assert.Equal(h.IsStaff ? "dean" : "student", h.ActorId); Assert.Equal(h.Status == "rejected", !string.IsNullOrWhiteSpace(h.RejectionReason)); });
            if (row.Kind == "certificate") { Assert.NotNull(row.Place); Assert.InRange(row.Copies!.Value, 1, 5); Assert.Null(row.Reason); Assert.Null(row.Start); }
            else { Assert.NotNull(row.Reason); Assert.True(row.End >= row.Start); Assert.Null(row.Copies); Assert.Null(row.Place); }
        }
    }
}
