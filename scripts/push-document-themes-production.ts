import { db } from "../server/db";
import { organizations, documentThemes } from "../shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const SBL_ORG_NAME = "SBL Roofing Pty Ltd";
const DRY_RUN = process.argv.includes("--dry-run");

const sblThemes = [
  {
    name: "SBL Metal Roofing - Default",
    isDefault: "true",
    isArchived: "false",
    themeColor: "#1e3a5f",
    companyName: "SBL Metal Roofing Pty Ltd",
    abn: "12 345 678 901",
    licenseNumber: "BLD12345",
    email1: "info@sblmetalroofing.com.au",
    email2: "quotes@sblmetalroofing.com.au",
    phone: "1300 SBL ROOF",
    website: "https://sblmetalroofing.com.au",
    address: "123 Industrial Drive, Sydney NSW 2000",
    logoUrl: null,
    logoPosition: "left",
    termsUrl: "https://sblmetalroofing.com.au/terms",
    bankName: "Commonwealth Bank",
    bankBsb: "062-000",
    bankAccountNumber: "12345678",
    bankAccountName: "SBL Metal Roofing Pty Ltd",
    payId: "info@sblmetalroofing.com.au",
  },
  {
    name: "SBL Professional",
    isDefault: "false",
    isArchived: "false",
    themeColor: "#0891b2",
    companyName: "SBL Metal Roofing Pty Ltd",
    abn: "12 345 678 901",
    licenseNumber: "BLD12345",
    email1: "info@sblmetalroofing.com.au",
    phone: "1300 SBL ROOF",
    website: "https://sblmetalroofing.com.au",
    address: "123 Industrial Drive, Sydney NSW 2000",
    logoPosition: "center",
    bankName: "Commonwealth Bank",
    bankBsb: "062-000",
    bankAccountNumber: "12345678",
    bankAccountName: "SBL Metal Roofing Pty Ltd",
  },
  {
    name: "SBL Clean & Simple",
    isDefault: "false",
    isArchived: "false",
    themeColor: "#374151",
    companyName: "SBL Metal Roofing",
    email1: "info@sblmetalroofing.com.au",
    phone: "1300 SBL ROOF",
    logoPosition: "left",
  },
];

async function pushDocumentThemes() {
  console.log("=".repeat(60));
  console.log("Push Document Themes to Production");
  if (DRY_RUN) {
    console.log("*** DRY RUN MODE - No changes will be made ***");
  }
  console.log("=".repeat(60));
  console.log("");

  try {
    const existingOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, SBL_ORG_NAME));

    if (existingOrgs.length === 0) {
      console.error(`ERROR: Organization "${SBL_ORG_NAME}" not found!`);
      console.log("Please ensure the organization exists before running this script.");
      process.exit(1);
    }

    const sblOrgId = existingOrgs[0].id;
    console.log(`Found SBL Roofing organization: ${sblOrgId}`);
    console.log("");

    const existingThemes = await db
      .select()
      .from(documentThemes)
      .where(eq(documentThemes.organizationId, sblOrgId));

    console.log(`Existing themes in database: ${existingThemes.length}`);
    for (const theme of existingThemes) {
      console.log(`  - ${theme.name} (${theme.id}) ${theme.isDefault === 'true' ? '[DEFAULT]' : ''}`);
    }
    console.log("");

    if (DRY_RUN) {
      console.log("Themes that would be added:");
      for (const theme of sblThemes) {
        const exists = existingThemes.some(t => t.name === theme.name);
        console.log(`  - ${theme.name} ${exists ? '(SKIPPED - already exists)' : '(NEW)'}`);
      }
      console.log("");
      console.log("Run without --dry-run to apply changes.");
    } else {
      let addedCount = 0;
      let skippedCount = 0;

      for (const theme of sblThemes) {
        const exists = existingThemes.some(t => t.name === theme.name);
        
        if (exists) {
          console.log(`  Skipping "${theme.name}" - already exists`);
          skippedCount++;
        } else {
          const themeId = randomUUID();
          await db.insert(documentThemes).values({
            id: themeId,
            organizationId: sblOrgId,
            ...theme,
          });
          console.log(`  ✓ Added "${theme.name}" (${themeId})`);
          addedCount++;
        }
      }

      console.log("");
      console.log("=".repeat(60));
      console.log(`Complete! Added: ${addedCount}, Skipped: ${skippedCount}`);
      console.log("=".repeat(60));
    }

    console.log("");
    console.log("Final theme count:");
    const finalThemes = await db
      .select()
      .from(documentThemes)
      .where(eq(documentThemes.organizationId, sblOrgId));
    
    for (const theme of finalThemes) {
      console.log(`  - ${theme.name} ${theme.isDefault === 'true' ? '[DEFAULT]' : ''}`);
    }

  } catch (error) {
    console.error("Error pushing themes:", error);
    process.exit(1);
  }
}

pushDocumentThemes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
