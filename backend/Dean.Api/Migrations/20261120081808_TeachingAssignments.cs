using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class TeachingAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeachingAssignment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeacherUserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeachingAssignment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeachingAssignment_AcademicCourse_CourseId_GroupId_Universi~",
                        columns: x => new { x.CourseId, x.GroupId, x.UniversityId },
                        principalTable: "AcademicCourse",
                        principalColumns: new[] { "Id", "GroupId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeachingAssignment_AspNetUsers_TeacherUserId_UniversityId",
                        columns: x => new { x.TeacherUserId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingAssignment_CourseId_GroupId_UniversityId",
                table: "TeachingAssignment",
                columns: new[] { "CourseId", "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingAssignment_TeacherUserId_UniversityId",
                table: "TeachingAssignment",
                columns: new[] { "TeacherUserId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_TeachingAssignment_UniversityId_CourseId_TeacherUserId",
                table: "TeachingAssignment",
                columns: new[] { "UniversityId", "CourseId", "TeacherUserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeachingAssignment");
        }
    }
}
