using Dean.Api.Modules.Schedule;
using Xunit;
public sealed class WorkplaceCalendarTests {
 [Fact] public void LegacyUpgradePreservesEditedAndLinkedLessons() {
 var expected=DemoScheduleSource.Generate(DateTimeOffset.Parse("2026-11-20T10:00:00Z")).First(x=>x.Value.Category==EventCategory.Lesson).Value;
 var e=new ScheduleEntry { IsDemo=true,Version=1,GroupId=expected.GroupId,Title=expected.Title,Kind=expected.Kind,Category=expected.Category,StartsAt=expected.StartsAt,EndsAt=expected.EndsAt,Room=expected.Room,Teacher=expected.Teacher,Address=expected.Location.Address,Building=expected.Location.Building,Floor=expected.Location.Floor,Status=expected.Status };
 Assert.True(LegacyWorkplaceUpgrade.IsUntouched(e,expected));
 e.Room="Ауд. 999";Assert.False(LegacyWorkplaceUpgrade.IsUntouched(e,expected));e.Room=expected.Room;
 e.Version=2;Assert.False(LegacyWorkplaceUpgrade.IsUntouched(e,expected));e.Version=1;
 e.CourseId=Guid.NewGuid();Assert.False(LegacyWorkplaceUpgrade.IsUntouched(e,expected));
 } [Fact] public void TwoWeekPatternStaysWithinSemesterWithoutDuplicateLessons() {
 var start=new DateOnly(2026,9,1);var end=new DateOnly(2027,1,31);
 for(var teacher=0;teacher<3;teacher++) {
 var dates=WorkplaceDemo.LessonDates(start,teacher).ToArray();
 Assert.Equal(20,dates.Length);Assert.Equal(20,dates.Distinct().Count());
 Assert.All(dates,d=>Assert.InRange(d,start,end));
 Assert.Equal(dates[2].DayOfWeek,dates[4].DayOfWeek);Assert.Equal(dates[3].DayOfWeek,dates[5].DayOfWeek);Assert.NotEqual(dates[2].DayOfWeek,dates[3].DayOfWeek);
 }
 var all=Enumerable.Range(0,3).SelectMany(t=>WorkplaceDemo.LessonDates(start,t));Assert.Equal(60,all.Distinct().Count());
 }
}
