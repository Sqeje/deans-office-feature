using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class AcademicPointPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoursePointPlan",
                columns: table => new
                {
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoursePointPlan", x => new { x.CourseId, x.UniversityId });
                    table.ForeignKey(
                        name: "FK_CoursePointPlan_AcademicCourse_CourseId",
                        column: x => x.CourseId,
                        principalTable: "AcademicCourse",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CoursePointComponent",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Maximum = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    IsAttendance = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoursePointComponent", x => x.Id);
                    table.UniqueConstraint("AK_CoursePointComponent_Id_UniversityId", x => new { x.Id, x.UniversityId });
                    table.CheckConstraint("CK_CoursePointComponent_Maximum", "\"Maximum\" > 0");
                    table.ForeignKey(
                        name: "FK_CoursePointComponent_CoursePointPlan_CourseId_UniversityId",
                        columns: x => new { x.CourseId, x.UniversityId },
                        principalTable: "CoursePointPlan",
                        principalColumns: new[] { "CourseId", "UniversityId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudentPointScore",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<string>(type: "text", nullable: false),
                    Points = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentPointScore", x => x.Id);
                    table.CheckConstraint("CK_StudentPointScore_Points", "\"Points\" IS NULL OR \"Points\" >= 0");
                    table.ForeignKey(
                        name: "FK_StudentPointScore_AcademicCourse_CourseId_GroupId_Universit~",
                        columns: x => new { x.CourseId, x.GroupId, x.UniversityId },
                        principalTable: "AcademicCourse",
                        principalColumns: new[] { "Id", "GroupId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentPointScore_CoursePointComponent_ComponentId_Universi~",
                        columns: x => new { x.ComponentId, x.UniversityId },
                        principalTable: "CoursePointComponent",
                        principalColumns: new[] { "Id", "UniversityId" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StudentPointScore_StudentProfiles_StudentId_GroupId_Univers~",
                        columns: x => new { x.StudentId, x.GroupId, x.UniversityId },
                        principalTable: "StudentProfiles",
                        principalColumns: new[] { "UserId", "StudyGroupId", "UniversityId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoursePointComponent_CourseId_UniversityId",
                table: "CoursePointComponent",
                columns: new[] { "CourseId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_CoursePointPlan_CourseId",
                table: "CoursePointPlan",
                column: "CourseId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentPointScore_ComponentId_UniversityId",
                table: "StudentPointScore",
                columns: new[] { "ComponentId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPointScore_CourseId_GroupId_UniversityId",
                table: "StudentPointScore",
                columns: new[] { "CourseId", "GroupId", "UniversityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentPointScore_StudentId_ComponentId_UniversityId",
                table: "StudentPointScore",
                columns: new[] { "StudentId", "ComponentId", "UniversityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentPointScore_StudentId_GroupId_UniversityId",
                table: "StudentPointScore",
                columns: new[] { "StudentId", "GroupId", "UniversityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentPointScore");

            migrationBuilder.DropTable(
                name: "CoursePointComponent");

            migrationBuilder.DropTable(
                name: "CoursePointPlan");
        }
    }
}
