using System.Text.Json.Serialization;
using Dean.Api.Kernel.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Dean.Api.Modules.AcademicPerformance;
[JsonConverter(typeof(JsonStringEnumConverter<AttendanceMark>))]
public enum AttendanceMark { [JsonStringEnumMemberName("unmarked")] Unmarked, [JsonStringEnumMemberName("present")] Present, [JsonStringEnumMemberName("absent")] Absent }
public sealed class LessonJournal
{
 public Guid Id {get;set;}
 public Guid UniversityId {get;set;}
 public Guid CourseId {get;set;}
 public long Version {get;set;}
 public DateOnly Date {get;set;}
 public string Subject {get;set;} = "";
 public List<LessonJournalEntry> Entries {get;set;} = [];
}
public sealed class LessonJournalEntry
{
 public Guid Id {get;set;}
 public Guid JournalId {get;set;}
 public string StudentId {get;set;} = "";
 public int? Grade {get;set;}
 public AttendanceMark Attendance {get;set;}
}
public sealed class LessonJournalConfiguration : IEntityTypeConfiguration<LessonJournal>
{
 public void Configure(EntityTypeBuilder<LessonJournal> b) {
 b.HasKey(x=>x.Id); b.Property(x=>x.Version).IsConcurrencyToken();
 b.HasOne<AcademicCourse>().WithMany().HasForeignKey(x=>x.CourseId).OnDelete(DeleteBehavior.Restrict);
 b.HasMany(x=>x.Entries).WithOne().HasForeignKey(x=>x.JournalId).OnDelete(DeleteBehavior.Cascade);
 }
}
public sealed class LessonJournalEntryConfiguration : IEntityTypeConfiguration<LessonJournalEntry>
{
 public void Configure(EntityTypeBuilder<LessonJournalEntry> b) {
 b.HasKey(x=>x.Id); b.Property(x=>x.StudentId).HasMaxLength(450);
 b.HasIndex(x=>new{x.JournalId,x.StudentId}).IsUnique();
 b.ToTable(t=> { t.HasCheckConstraint("CK_Journal_Grade", "\"Grade\" IS NULL OR \"Grade\" BETWEEN 2 AND 5"); t.HasCheckConstraint("CK_Journal_Attendance", "\"Attendance\" IN (0,1,2)"); });
 }
}
public sealed record JournalRowInput(string StudentId,int? Grade,AttendanceMark Attendance);
public sealed record SaveJournalRequest(long Version,JournalRowInput[] Rows);
public sealed record JournalRowDto(string StudentId,string FullName,int? Grade,AttendanceMark Attendance);
public sealed record JournalLessonDto(Guid LessonId,DateTimeOffset StartsAt,string Subject,bool IsCancelled,bool CanEdit,string? ReadOnlyReason,long Version,JournalRowDto[] Rows);
public sealed record JournalResponse(Guid CourseId,string CourseName,Guid GroupId,string SemesterId,JournalLessonDto[] Lessons);
public static class JournalRules {
 public static void Validate(JournalRowInput[] rows) {
 if(rows.Length>500 || rows.Select(x=>x.StudentId).Distinct().Count()!=rows.Length || rows.Any(x=>string.IsNullOrWhiteSpace(x.StudentId)|| x.Grade is <2 or >5 || !Enum.IsDefined(x.Attendance)))
 throw new InputValidationException(new Dictionary<string,string[]> { ["rows"]=["Проверьте студентов, оценки от 2 до 5 и посещаемость."] });
 }
}
public sealed class FinalResultHistory {
 public Guid Id {get;set;} public Guid UniversityId {get;set;} public Guid ResultId {get;set;} public long Version {get;set;}
 public FinalKind PreviousKind {get;set;} public int? PreviousValue {get;set;} public FinalKind Kind {get;set;} public int? Value {get;set;}
 public string ActorId {get;set;}=""; public string? Reason {get;set;} public DateTimeOffset ChangedAt {get;set;}
}
public sealed class FinalResultHistoryConfiguration : IEntityTypeConfiguration<FinalResultHistory> {
 public void Configure(EntityTypeBuilder<FinalResultHistory> b) { b.HasKey(x=>x.Id); b.Property(x=>x.ActorId).HasMaxLength(450); b.Property(x=>x.Reason).HasMaxLength(1000); b.HasIndex(x=>new{x.ResultId,x.Version}).IsUnique(); b.HasOne<AcademicResult>().WithMany().HasForeignKey(x=>new{x.ResultId,x.UniversityId}).HasPrincipalKey(x=>new{x.Id,x.UniversityId}).OnDelete(DeleteBehavior.Restrict); }
}
