using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class NotificationsPersistence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StudentProfiles_UserId_UniversityId",
                table: "StudentProfiles");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_StudentProfiles_UserId_UniversityId",
                table: "StudentProfiles",
                columns: new[] { "UserId", "UniversityId" });

            migrationBuilder.CreateTable(
                name: "NotificationMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: true),
                    EventKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RelatedType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    RelatedId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationMessages", x => x.Id);
                    table.UniqueConstraint("AK_NotificationMessages_Id_UniversityId", x => new { x.Id, x.UniversityId });
                    table.ForeignKey(
                        name: "FK_NotificationMessages_StudentProfiles_StudentId_UniversityId",
                        columns: x => new { x.StudentId, x.UniversityId },
                        principalTable: "StudentProfiles",
                        principalColumns: new[] { "UserId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NotificationMessages_Universities_UniversityId",
                        column: x => x.UniversityId,
                        principalTable: "Universities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NotificationReads",
                columns: table => new
                {
                    MessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: false),
                    ReadAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationReads", x => new { x.MessageId, x.StudentId, x.UniversityId });
                    table.ForeignKey(
                        name: "FK_NotificationReads_NotificationMessages_MessageId_University~",
                        columns: x => new { x.MessageId, x.UniversityId },
                        principalTable: "NotificationMessages",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NotificationReads_StudentProfiles_StudentId_UniversityId",
                        columns: x => new { x.StudentId, x.UniversityId },
                        principalTable: "StudentProfiles",
                        principalColumns: new[] { "UserId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationMessages_StudentId_UniversityId",
                table: "NotificationMessages",
                columns: new[] { "StudentId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationMessages_UniversityId_EventKey",
                table: "NotificationMessages",
                columns: new[] { "UniversityId", "EventKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationReads_MessageId_UniversityId",
                table: "NotificationReads",
                columns: new[] { "MessageId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationReads_StudentId_UniversityId",
                table: "NotificationReads",
                columns: new[] { "StudentId", "UniversityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationReads");

            migrationBuilder.DropTable(
                name: "NotificationMessages");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_StudentProfiles_UserId_UniversityId",
                table: "StudentProfiles");

            migrationBuilder.CreateIndex(
                name: "IX_StudentProfiles_UserId_UniversityId",
                table: "StudentProfiles",
                columns: new[] { "UserId", "UniversityId" },
                unique: true);
        }
    }
}
