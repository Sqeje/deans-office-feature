using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScheduleEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Kind = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Room = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Building = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Floor = table.Column<int>(type: "integer", nullable: false),
                    Teacher = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PreviousStartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PreviousEndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PreviousRoom = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PreviousTeacher = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    PreviousAddress = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    PreviousBuilding = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PreviousFloor = table.Column<int>(type: "integer", nullable: true),
                    SourceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ExternalId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ImportedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsDemo = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleEntries", x => x.Id);
                    table.CheckConstraint("CK_Schedule_Interval", "\"EndsAt\" > \"StartsAt\"");
                    table.CheckConstraint("CK_Schedule_Previous", "\"Status\" <> 1 OR (\"PreviousStartsAt\" IS NOT NULL AND \"PreviousEndsAt\" IS NOT NULL AND \"PreviousEndsAt\" > \"PreviousStartsAt\" AND \"PreviousRoom\" IS NOT NULL AND \"PreviousTeacher\" IS NOT NULL AND \"PreviousAddress\" IS NOT NULL AND \"PreviousBuilding\" IS NOT NULL AND \"PreviousFloor\" IS NOT NULL)");
                    table.CheckConstraint("CK_Schedule_Source", "(\"SourceId\" IS NULL AND \"ExternalId\" IS NULL AND \"ImportedAt\" IS NULL) OR (\"SourceId\" IS NOT NULL AND \"ExternalId\" IS NOT NULL AND \"ImportedAt\" IS NOT NULL)");
                    table.CheckConstraint("CK_Schedule_Status", "\"Status\" IN (0,1,2) AND \"Category\" IN (0,1)");
                    table.ForeignKey(
                        name: "FK_ScheduleEntries_StudyGroups_GroupId_UniversityId",
                        columns: x => new { x.GroupId, x.UniversityId },
                        principalTable: "StudyGroups",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_GroupId_UniversityId",
                table: "ScheduleEntries",
                columns: new[] { "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_UniversityId_GroupId_Category_StartsAt",
                table: "ScheduleEntries",
                columns: new[] { "UniversityId", "GroupId", "Category", "StartsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleEntries_UniversityId_SourceId_ExternalId",
                table: "ScheduleEntries",
                columns: new[] { "UniversityId", "SourceId", "ExternalId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScheduleEntries");
        }
    }
}
