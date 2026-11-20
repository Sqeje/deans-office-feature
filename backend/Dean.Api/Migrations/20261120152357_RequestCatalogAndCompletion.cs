using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dean.Api.Migrations
{
    /// <inheritdoc />
    public partial class RequestCatalogAndCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Request_Input",
                table: "StudentRequest");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Request_Status",
                table: "StudentRequest");

            migrationBuilder.DropCheckConstraint(
                name: "CK_RequestHistory_Status",
                table: "RequestHistory");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Request_Input",
                table: "StudentRequest",
                sql: "(\"Kind\" IN ('certificate','scholarship_certificate','study_period_certificate') AND \"Place\" IS NOT NULL AND length(trim(\"Place\")) > 0 AND \"Copies\" BETWEEN 1 AND 5 AND \"Copies\" IS NOT NULL AND \"Start\" IS NULL AND \"End\" IS NULL) OR (\"Kind\" IN ('statement','academic_leave','event') AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NOT NULL AND \"End\" IS NOT NULL AND \"End\" >= \"Start\" AND \"Place\" IS NULL AND \"Copies\" IS NULL) OR (\"Kind\" IN ('academic_return','bank_card','passport_change','named_scholarship','military_training','tuition_payment','withdrawal','dormitory','arrival','social_payment') AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NULL AND \"End\" IS NULL AND \"Place\" IS NULL AND \"Copies\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Request_Status",
                table: "StudentRequest",
                sql: "\"Status\" IN ('submitted','in_review','ready','rejected','completed')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RequestHistory_Status",
                table: "RequestHistory",
                sql: "\"Status\" IN ('submitted','in_review','ready','rejected','completed')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Request_Input",
                table: "StudentRequest");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Request_Status",
                table: "StudentRequest");

            migrationBuilder.DropCheckConstraint(
                name: "CK_RequestHistory_Status",
                table: "RequestHistory");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Request_Input",
                table: "StudentRequest",
                sql: "(\"Kind\" = 'certificate' AND \"Place\" IS NOT NULL AND length(trim(\"Place\")) > 0 AND \"Copies\" BETWEEN 1 AND 5 AND \"Copies\" IS NOT NULL AND \"Reason\" IS NULL AND \"Start\" IS NULL AND \"End\" IS NULL) OR (\"Kind\" = 'statement' AND \"Reason\" IS NOT NULL AND length(trim(\"Reason\")) > 0 AND \"Start\" IS NOT NULL AND \"End\" IS NOT NULL AND \"End\" >= \"Start\" AND \"Place\" IS NULL AND \"Copies\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Request_Status",
                table: "StudentRequest",
                sql: "\"Status\" IN ('submitted','in_review','ready','rejected')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RequestHistory_Status",
                table: "RequestHistory",
                sql: "\"Status\" IN ('submitted','in_review','ready','rejected')");
        }
    }
}
