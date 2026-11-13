using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class RequestsPersistence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudentRequest",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    OperationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Place = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Copies = table.Column<int>(type: "integer", nullable: true),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Start = table.Column<DateOnly>(type: "date", nullable: true),
                    End = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentRequest", x => x.Id);
                    table.UniqueConstraint("AK_StudentRequest_Id_UniversityId", x => new { x.Id, x.UniversityId });
                    table.CheckConstraint("CK_Request_Input", "(\"Kind\" = 'certificate' AND \"Place\" IS NOT NULL AND length(trim(\"Place\")) > 0 AND \"Copies\" BETWEEN 1 AND 5 AND \"Copies\" IS NOT NULL AND \"Reason\" IS NULL AND \"Start\" IS NULL AND \"End\" IS NULL) OR (\"Kind\" = 'statement' AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NOT NULL AND \"End\" IS NOT NULL AND \"End\" >= \"Start\" AND \"Place\" IS NULL AND \"Copies\" IS NULL)");
                    table.CheckConstraint("CK_Request_Status", "\"Status\" IN ('submitted','in_review','ready','rejected')");
                    table.ForeignKey(
                        name: "FK_StudentRequest_AspNetUsers_StudentId_UniversityId",
                        columns: x => new { x.StudentId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentRequest_StudyGroups_GroupId_UniversityId",
                        columns: x => new { x.GroupId, x.UniversityId },
                        principalTable: "StudyGroups",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RequestHistory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorId = table.Column<string>(type: "text", nullable: false),
                    IsStaff = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RejectionReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestHistory", x => x.Id);
                    table.CheckConstraint("CK_RequestHistory_Reason", "(\"Status\" = 'rejected' AND \"RejectionReason\" IS NOT NULL AND length(trim(\"RejectionReason\")) > 0) OR (\"Status\" <> 'rejected' AND \"RejectionReason\" IS NULL)");
                    table.CheckConstraint("CK_RequestHistory_Status", "\"Status\" IN ('submitted','in_review','ready','rejected')");
                    table.ForeignKey(
                        name: "FK_RequestHistory_AspNetUsers_ActorId_UniversityId",
                        columns: x => new { x.ActorId, x.UniversityId },
                        principalTable: "AspNetUsers",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RequestHistory_StudentRequest_RequestId_UniversityId",
                        columns: x => new { x.RequestId, x.UniversityId },
                        principalTable: "StudentRequest",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RequestHistory_ActorId_UniversityId",
                table: "RequestHistory",
                columns: new[] { "ActorId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestHistory_RequestId_UniversityId",
                table: "RequestHistory",
                columns: new[] { "RequestId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestHistory_RequestId_Version",
                table: "RequestHistory",
                columns: new[] { "RequestId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentRequest_GroupId_UniversityId",
                table: "StudentRequest",
                columns: new[] { "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentRequest_Number",
                table: "StudentRequest",
                column: "Number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentRequest_StudentId_UniversityId",
                table: "StudentRequest",
                columns: new[] { "StudentId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentRequest_UniversityId_GroupId_SubmittedAt",
                table: "StudentRequest",
                columns: new[] { "UniversityId", "GroupId", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentRequest_UniversityId_StudentId_OperationId",
                table: "StudentRequest",
                columns: new[] { "UniversityId", "StudentId", "OperationId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RequestHistory");

            migrationBuilder.DropTable(
                name: "StudentRequest");
        }
    }
}
