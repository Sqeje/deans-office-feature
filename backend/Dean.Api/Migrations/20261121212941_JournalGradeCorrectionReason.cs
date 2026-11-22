using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class JournalGradeCorrectionReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CorrectionReason",
                table: "LessonJournalEntry",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CorrectionReason",
                table: "LessonJournalEntry");
        }
    }
}
