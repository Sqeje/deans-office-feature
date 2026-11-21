using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class StudentAcademicProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CourseNumber",
                table: "StudentProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Faculty",
                table: "StudentProfiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Program",
                table: "StudentProfiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SemesterNumber",
                table: "StudentProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StudyDurationYears",
                table: "StudentProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_StudentProfiles_AcademicProgress",
                table: "StudentProfiles",
                sql: "(\"CourseNumber\" IS NULL OR \"CourseNumber\" BETWEEN 1 AND 10) AND (\"SemesterNumber\" IS NULL OR \"SemesterNumber\" BETWEEN 1 AND 20) AND (\"StudyDurationYears\" IS NULL OR \"StudyDurationYears\" BETWEEN 1 AND 10)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_StudentProfiles_AcademicProgress",
                table: "StudentProfiles");

            migrationBuilder.DropColumn(
                name: "CourseNumber",
                table: "StudentProfiles");

            migrationBuilder.DropColumn(
                name: "Faculty",
                table: "StudentProfiles");

            migrationBuilder.DropColumn(
                name: "Program",
                table: "StudentProfiles");

            migrationBuilder.DropColumn(
                name: "SemesterNumber",
                table: "StudentProfiles");

            migrationBuilder.DropColumn(
                name: "StudyDurationYears",
                table: "StudentProfiles");
        }
    }
}
