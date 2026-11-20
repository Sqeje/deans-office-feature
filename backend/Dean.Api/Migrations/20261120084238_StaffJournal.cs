using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class StaffJournal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_StaffGrant_Scope",
                table: "StaffGrants");

            migrationBuilder.AddColumn<Guid>(
                name: "CourseId",
                table: "ScheduleEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Version",
                table: "AcademicResult",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "FinalResultHistory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResultId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    PreviousKind = table.Column<int>(type: "integer", nullable: false),
                    PreviousValue = table.Column<int>(type: "integer", nullable: true),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: true),
                    ActorId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinalResultHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FinalResultHistory_AcademicResult_ResultId_UniversityId",
                        columns: x => new { x.ResultId, x.UniversityId },
                        principalTable: "AcademicResult",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LessonJournal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonJournal", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LessonJournal_AcademicCourse_CourseId",
                        column: x => x.CourseId,
                        principalTable: "AcademicCourse",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LessonJournalEntry",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Grade = table.Column<int>(type: "integer", nullable: true),
                    Attendance = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonJournalEntry", x => x.Id);
                    table.CheckConstraint("CK_Journal_Attendance", "\"Attendance\" IN (0,1,2)");
                    table.CheckConstraint("CK_Journal_Grade", "\"Grade\" IS NULL OR \"Grade\" BETWEEN 2 AND 5");
                    table.ForeignKey(
                        name: "FK_LessonJournalEntry_LessonJournal_JournalId",
                        column: x => x.JournalId,
                        principalTable: "LessonJournal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_StaffGrant_Scope",
                table: "StaffGrants",
                sql: "(\"Permission\" IN ('announcements.publish','sources.manage') AND \"GroupId\" IS NULL) OR (\"Permission\" IN ('requests.manage','schedule.write','grades.write','grades.read','journal.write','grades.correct') AND \"GroupId\" IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_CourseId_GroupId_UniversityId",
                table: "ScheduleEntries",
                columns: new[] { "CourseId", "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_FinalResultHistory_ResultId_UniversityId",
                table: "FinalResultHistory",
                columns: new[] { "ResultId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_FinalResultHistory_ResultId_Version",
                table: "FinalResultHistory",
                columns: new[] { "ResultId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonJournal_CourseId",
                table: "LessonJournal",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonJournalEntry_JournalId_StudentId",
                table: "LessonJournalEntry",
                columns: new[] { "JournalId", "StudentId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduleEntries_AcademicCourse_CourseId_GroupId_UniversityId",
                table: "ScheduleEntries",
                columns: new[] { "CourseId", "GroupId", "UniversityId" },
                principalTable: "AcademicCourse",
                principalColumns: new[] { "Id", "GroupId", "UniversityId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ScheduleEntries_AcademicCourse_CourseId_GroupId_UniversityId",
                table: "ScheduleEntries");

            migrationBuilder.DropTable(
                name: "FinalResultHistory");

            migrationBuilder.DropTable(
                name: "LessonJournalEntry");

            migrationBuilder.DropTable(
                name: "LessonJournal");

            migrationBuilder.DropCheckConstraint(
                name: "CK_StaffGrant_Scope",
                table: "StaffGrants");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleEntries_CourseId_GroupId_UniversityId",
                table: "ScheduleEntries");

            migrationBuilder.DropColumn(
                name: "CourseId",
                table: "ScheduleEntries");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "AcademicResult");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StaffGrant_Scope",
                table: "StaffGrants",
                sql: "(\"Permission\" IN ('announcements.publish','sources.manage') AND \"GroupId\" IS NULL) OR (\"Permission\" IN ('requests.manage','schedule.write','grades.write') AND \"GroupId\" IS NOT NULL)");
        }
    }
}
