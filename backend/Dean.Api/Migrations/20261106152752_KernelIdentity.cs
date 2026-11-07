using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class KernelIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_StudyGroups_StudyGroupId_UniversityId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_StudyGroupId_UniversityId",
                table: "AspNetUsers");


            migrationBuilder.RenameColumn(
                name: "FullName",
                table: "AspNetUsers",
                newName: "DisplayName");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_AspNetUsers_Id_UniversityId",
                table: "AspNetUsers",
                columns: new[] { "Id", "UniversityId" });

            migrationBuilder.CreateTable(
                name: "AuditEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorId = table.Column<string>(type: "text", nullable: false),
                    Operation = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TraceId = table.Column<string>(type: "text", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditEntries_AspNetUsers_ActorId_UniversityId",
                        columns: x => new { x.ActorId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StaffGrants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permission = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffGrants", x => x.Id);
                    table.CheckConstraint("CK_StaffGrant_Scope", "(\"Permission\" IN ('announcements.publish','sources.manage') AND \"GroupId\" IS NULL) OR (\"Permission\" IN ('requests.manage','schedule.write','grades.write') AND \"GroupId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_StaffGrants_AspNetUsers_UserId_UniversityId",
                        columns: x => new { x.UserId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffGrants_StudyGroups_GroupId_UniversityId",
                        columns: x => new { x.GroupId, x.UniversityId },
                        principalTable: "StudyGroups",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StudentProfiles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudyGroupId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentProfiles", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_StudentProfiles_AspNetUsers_UserId_UniversityId",
                        columns: x => new { x.UserId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StudentProfiles_StudyGroups_StudyGroupId_UniversityId",
                        columns: x => new { x.StudyGroupId, x.UniversityId },
                        principalTable: "StudyGroups",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("""
                INSERT INTO "StudentProfiles" ("UserId", "UniversityId", "StudyGroupId")
                SELECT "Id", "UniversityId", "StudyGroupId" FROM "AspNetUsers";
                INSERT INTO "AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
                VALUES ('kernel-student-role', 'Student', 'STUDENT', 'kernel-student-role')
                ON CONFLICT ("NormalizedName") DO NOTHING;
                INSERT INTO "AspNetUserRoles" ("UserId", "RoleId")
                SELECT p."UserId", r."Id" FROM "StudentProfiles" p CROSS JOIN "AspNetRoles" r
                WHERE r."NormalizedName" = 'STUDENT' ON CONFLICT DO NOTHING;
                """);
            migrationBuilder.DropColumn(name: "StudyGroupId", table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_UniversityId",
                table: "AspNetUsers",
                column: "UniversityId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntries_ActorId_UniversityId",
                table: "AuditEntries",
                columns: new[] { "ActorId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffGrants_GroupId_UniversityId",
                table: "StaffGrants",
                columns: new[] { "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffGrants_UserId_UniversityId",
                table: "StaffGrants",
                columns: new[] { "UserId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentProfiles_StudyGroupId_UniversityId",
                table: "StudentProfiles",
                columns: new[] { "StudyGroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentProfiles_UserId_UniversityId",
                table: "StudentProfiles",
                columns: new[] { "UserId", "UniversityId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Universities_UniversityId",
                table: "AspNetUsers",
                column: "UniversityId",
                principalTable: "Universities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Kernel account split cannot be downgraded safely with staff accounts. Restore the pre-upgrade backup.");
        }
    }
}
