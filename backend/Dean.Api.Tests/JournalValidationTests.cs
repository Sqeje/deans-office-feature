using Dean.Api.Modules.AcademicPerformance;
using Dean.Api.Kernel.Http;
using Xunit;
public class JournalValidationTests
{
 [Theory] [InlineData(null, AttendanceMark.Absent)] [InlineData(5, AttendanceMark.Absent)] [InlineData(2, AttendanceMark.Unmarked)]
 public void AttendanceDoesNotDetermineGrade(int? grade, AttendanceMark attendance) => JournalRules.Validate([new("student",grade,attendance)]);
 [Theory] [InlineData(1)] [InlineData(6)]
 public void InvalidGradesRejectWholeSave(int grade) => Assert.Throws<InputValidationException>(() => JournalRules.Validate([new("student",grade,AttendanceMark.Present)]));
 [Fact] public void DuplicateStudentsRejected() => Assert.Throws<InputValidationException>(() => JournalRules.Validate([new("a",5,AttendanceMark.Present),new("a",4,AttendanceMark.Absent)]));
}
