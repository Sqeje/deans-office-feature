using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleTeacherOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TeacherUserId",
                table: "ScheduleEntries",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_TeacherUserId_UniversityId",
                table: "ScheduleEntries",
                columns: new[] { "TeacherUserId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_UniversityId_TeacherUserId_StartsAt",
                table: "ScheduleEntries",
                columns: new[] { "UniversityId", "TeacherUserId", "StartsAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduleEntries_AspNetUsers_TeacherUserId_UniversityId",
                table: "ScheduleEntries",
                columns: new[] { "TeacherUserId", "UniversityId" },
                principalTable: "AspNetUsers",
                principalColumns: new[] { "Id", "UniversityId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ScheduleEntries_AspNetUsers_TeacherUserId_UniversityId",
                table: "ScheduleEntries");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleEntries_TeacherUserId_UniversityId",
                table: "ScheduleEntries");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleEntries_UniversityId_TeacherUserId_StartsAt",
                table: "ScheduleEntries");

            migrationBuilder.DropColumn(
                name: "TeacherUserId",
                table: "ScheduleEntries");
        }
    }
}
