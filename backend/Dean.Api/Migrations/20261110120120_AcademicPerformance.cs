using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class AcademicPerformance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_StudentProfiles_UserId_StudyGroupId_UniversityId",
                table: "StudentProfiles",
                columns: new[] { "UserId", "StudyGroupId", "UniversityId" });

            migrationBuilder.CreateTable(
                name: "AcademicSemester",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcademicSemester", x => new { x.Id, x.UniversityId });
                    table.ForeignKey(
                        name: "FK_AcademicSemester_Universities_UniversityId",
                        column: x => x.UniversityId,
                        principalTable: "Universities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AcademicCourse",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SemesterId = table.Column<string>(type: "character varying(60)", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Teacher = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Assessment = table.Column<int>(type: "integer", nullable: false),
                    AssessmentDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcademicCourse", x => x.Id);
                    table.UniqueConstraint("AK_AcademicCourse_Id_GroupId_UniversityId", x => new { x.Id, x.GroupId, x.UniversityId });
                    table.CheckConstraint("CK_AcademicCourse_Assessment", "\"Assessment\" IN (0, 1)");
                    table.ForeignKey(
                        name: "FK_AcademicCourse_AcademicSemester_SemesterId_UniversityId",
                        columns: x => new { x.SemesterId, x.UniversityId },
                        principalTable: "AcademicSemester",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AcademicCourse_StudyGroups_GroupId_UniversityId",
                        columns: x => new { x.GroupId, x.UniversityId },
                        principalTable: "StudyGroups",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AcademicResult",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SourceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcademicResult", x => x.Id);
                    table.UniqueConstraint("AK_AcademicResult_Id_UniversityId", x => new { x.Id, x.UniversityId });
                    table.CheckConstraint("CK_AcademicResult_Value", "(\"Kind\" = 1 AND \"Value\" IS NOT NULL AND \"Value\" BETWEEN 2 AND 5) OR (\"Kind\" IN (0, 2, 3) AND \"Value\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_AcademicResult_AcademicCourse_CourseId_GroupId_UniversityId",
                        columns: x => new { x.CourseId, x.GroupId, x.UniversityId },
                        principalTable: "AcademicCourse",
                        principalColumns: new[] { "Id", "GroupId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AcademicResult_StudentProfiles_StudentId_GroupId_University~",
                        columns: x => new { x.StudentId, x.GroupId, x.UniversityId },
                        principalTable: "StudentProfiles",
                        principalColumns: new[] { "UserId", "StudyGroupId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AcademicGrade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResultId = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Activity = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcademicGrade", x => x.Id);
                    table.CheckConstraint("CK_AcademicGrade_Value", "\"Value\" BETWEEN 2 AND 5");
                    table.ForeignKey(
                        name: "FK_AcademicGrade_AcademicResult_ResultId_UniversityId",
                        columns: x => new { x.ResultId, x.UniversityId },
                        principalTable: "AcademicResult",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicCourse_GroupId_UniversityId",
                table: "AcademicCourse",
                columns: new[] { "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicCourse_SemesterId_UniversityId",
                table: "AcademicCourse",
                columns: new[] { "SemesterId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicGrade_ResultId_UniversityId",
                table: "AcademicGrade",
                columns: new[] { "ResultId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicResult_CourseId_GroupId_UniversityId",
                table: "AcademicResult",
                columns: new[] { "CourseId", "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicResult_CourseId_StudentId_UniversityId",
                table: "AcademicResult",
                columns: new[] { "CourseId", "StudentId", "UniversityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AcademicResult_StudentId_GroupId_UniversityId",
                table: "AcademicResult",
                columns: new[] { "StudentId", "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AcademicSemester_UniversityId",
                table: "AcademicSemester",
                column: "UniversityId",
                unique: true,
                filter: "\"IsDefault\" = TRUE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AcademicGrade");

            migrationBuilder.DropTable(
                name: "AcademicResult");

            migrationBuilder.DropTable(
                name: "AcademicCourse");

            migrationBuilder.DropTable(
                name: "AcademicSemester");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_StudentProfiles_UserId_StudyGroupId_UniversityId",
                table: "StudentProfiles");
        }
    }
}
