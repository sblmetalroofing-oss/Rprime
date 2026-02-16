import { db } from "./db";
import { organizations, documentThemes } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const SBL_ORG_NAME = "SBL Roofing Pty Ltd";

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

const genericDefaultTheme = {
  name: "Default Theme",
  isDefault: "true",
  isArchived: "false",
  themeColor: "#0891b2",
  logoPosition: "left",
};

async function createThemeIfNotExists(
  orgId: string,
  theme: typeof genericDefaultTheme | (typeof sblThemes)[0]
): Promise<boolean> {
  const existing = await db
    .select()
    .from(documentThemes)
    .where(
      and(
        eq(documentThemes.organizationId, orgId),
        eq(documentThemes.name, theme.name)
      )
    );

  if (existing.length > 0) {
    return false;
  }

  const themeId = randomUUID();
  await db.insert(documentThemes).values({
    id: themeId,
    organizationId: orgId,
    ...theme,
  });
  return true;
}

export async function seedDocumentThemes(): Promise<void> {
  try {
    console.log("[Seed Themes] Checking document themes for all organizations...");

    const allOrgs = await db.select().from(organizations);

    if (allOrgs.length === 0) {
      console.log("[Seed Themes] No organizations found, skipping theme seeding");
      return;
    }

    for (const org of allOrgs) {
      const existingThemes = await db
        .select()
        .from(documentThemes)
        .where(eq(documentThemes.organizationId, org.id));

      if (existingThemes.length > 0) {
        console.log(`[Seed Themes] Organization "${org.name}" already has ${existingThemes.length} themes`);
        continue;
      }

      console.log(`[Seed Themes] Creating themes for organization "${org.name}"...`);

      const isSblOrg = org.name === SBL_ORG_NAME;
      const themesToCreate = isSblOrg ? sblThemes : [genericDefaultTheme];

      let createdCount = 0;
      for (const theme of themesToCreate) {
        const created = await createThemeIfNotExists(org.id, theme);
        if (created) {
          console.log(`[Seed Themes]   Created "${theme.name}"`);
          createdCount++;
        }
      }

      if (createdCount > 0) {
        console.log(`[Seed Themes] Created ${createdCount} themes for "${org.name}"`);
      }
    }

    console.log("[Seed Themes] Document theme seeding complete");
  } catch (error) {
    console.error("[Seed Themes] Error seeding document themes:", error);
  }
}
