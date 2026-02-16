import { db } from "./db";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, or, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  organizations,
  customers,
  suppliers,
  reports,
  findings,
  estimateItems,
  jobs,
  jobStatusHistory,
  jobTemplates,
  jobActivities,
  crewMembers,
  appointments,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  purchaseOrders,
  purchaseOrderItems,
  items,
  documentSettings,
  appSettings,
  documentThemes,
  leads,
  leadActivities,
  flashingOrders,
  adminAuditLogs,
  users,
} from "@shared/schema";

const SENSITIVE_FIELDS_TO_EXCLUDE = [
  'accessToken',
  'refreshToken',
  'inviteToken',
  'passwordHash',
];

function createProdConnection() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    throw new Error("PRODUCTION_DATABASE_URL secret is not configured");
  }
  const pool = new Pool({ connectionString: prodUrl });
  return drizzle(pool);
}

export async function listProductionOrganizations(): Promise<{ id: string; name: string; email: string | null; subscriptionPlan: string | null; createdAt: Date }[]> {
  const prodDb = createProdConnection();
  
  const orgs = await prodDb
    .select({
      id: organizations.id,
      name: organizations.name,
      email: organizations.email,
      subscriptionPlan: organizations.subscriptionPlan,
      createdAt: organizations.createdAt,
    })
    .from(organizations);
  
  return orgs;
}

export async function syncOrganizationToDevByName(
  adminUserId: string,
  organizationName: string
): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const prodDb = createProdConnection();
  
  const [prodOrg] = await prodDb
    .select()
    .from(organizations)
    .where(eq(organizations.name, organizationName));
  
  if (!prodOrg) {
    return { success: false, message: `Organization "${organizationName}" not found in production` };
  }
  
  return syncOrganizationToDev(adminUserId, prodOrg.id);
}

export async function syncOrganizationToDev(
  adminUserId: string,
  organizationId: string
): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  console.log(`[Sync] Starting sync for organization ${organizationId}...`);
  
  const prodDb = createProdConnection();
  const startTime = Date.now();
  const syncDetails: Record<string, number> = {};
  let ownerLoginInfo: { email: string; password: string } | null = null;
  
  try {
    const [prodOrg] = await prodDb
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    
    if (!prodOrg) {
      return { success: false, message: "Organization not found in production database" };
    }
    
    console.log(`[Sync] Found organization: ${prodOrg.name}`);

    await deleteOrgDataFromDev(organizationId);

    // Sync the owner user first if the organization has an owner
    if (prodOrg.ownerId) {
      console.log(`[Sync] Syncing organization owner user: ${prodOrg.ownerId}`);
      const [prodOwner] = await prodDb.select().from(users).where(eq(users.id, prodOrg.ownerId));
      if (prodOwner) {
        // Clear any organization ownerId references before deleting the user to avoid FK constraint violations
        await db.update(organizations).set({ ownerId: null }).where(eq(organizations.ownerId, prodOwner.id));
        if (prodOwner.email) {
          // Also clear references for any user with the same email (in case of ID mismatch)
          const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, prodOwner.email));
          if (existingUserByEmail) {
            await db.update(organizations).set({ ownerId: null }).where(eq(organizations.ownerId, existingUserByEmail.id));
          }
        }
        // Delete existing user with this ID OR email to avoid uniqueness conflicts
        await db.delete(users).where(
          or(
            eq(users.id, prodOwner.id),
            prodOwner.email ? eq(users.email, prodOwner.email) : eq(users.id, prodOwner.id)
          )
        );
        // Set a known temporary password so admin can log in as this user
        const tempPassword = "TempPass123!";
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const sanitizedOwner = { 
          ...prodOwner, 
          passwordHash: tempPasswordHash,
        };
        await db.insert(users).values(sanitizedOwner);
        console.log(`[Sync] Owner user synced with temporary password (not shown for security)`);
        if (prodOwner.email) {
          ownerLoginInfo = { email: prodOwner.email, password: tempPassword };
        }
        syncDetails.ownerUser = 1;
      }
    } else {
      // No owner - find an admin crew member with a linked user account
      console.log(`[Sync] No owner found, looking for admin crew member...`);
      const prodCrewForLogin = await prodDb.select().from(crewMembers)
        .where(and(
          eq(crewMembers.organizationId, organizationId),
          eq(crewMembers.isAdmin, 'true')
        ));
      
      // Find first crew member with a linked userId
      const adminCrewWithUser = prodCrewForLogin.find(c => c.userId);
      if (adminCrewWithUser && adminCrewWithUser.userId) {
        console.log(`[Sync] Found admin crew member: ${adminCrewWithUser.email}`);
        const [crewUser] = await prodDb.select().from(users).where(eq(users.id, adminCrewWithUser.userId));
        if (crewUser) {
          // Clear any organization ownerId references before deleting the user to avoid FK constraint violations
          await db.update(organizations).set({ ownerId: null }).where(eq(organizations.ownerId, crewUser.id));
          if (crewUser.email) {
            // Also clear references for any user with the same email (in case of ID mismatch)
            const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, crewUser.email));
            if (existingUserByEmail) {
              await db.update(organizations).set({ ownerId: null }).where(eq(organizations.ownerId, existingUserByEmail.id));
            }
          }
          // Delete existing user with this ID OR email to avoid uniqueness conflicts
          await db.delete(users).where(
            or(
              eq(users.id, crewUser.id),
              crewUser.email ? eq(users.email, crewUser.email) : eq(users.id, crewUser.id)
            )
          );
          // Set a known temporary password
          const tempPassword = "TempPass123!";
          const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
          const sanitizedUser = { 
            ...crewUser, 
            passwordHash: tempPasswordHash,
          };
          await db.insert(users).values(sanitizedUser);
          console.log(`[Sync] Admin crew user synced with temp password`);
          if (crewUser.email) {
            ownerLoginInfo = { email: crewUser.email, password: tempPassword };
          }
          syncDetails.adminCrewUser = 1;
        }
      } else {
        console.log(`[Sync] No admin crew member with user account found`);
      }
    }

    console.log(`[Sync] Copying organization record...`);
    await db.insert(organizations).values(prodOrg);
    syncDetails.organization = 1;

    console.log(`[Sync] Copying customers...`);
    const prodCustomers = await prodDb.select().from(customers).where(eq(customers.organizationId, organizationId));
    if (prodCustomers.length > 0) {
      await db.insert(customers).values(prodCustomers);
    }
    syncDetails.customers = prodCustomers.length;

    console.log(`[Sync] Copying suppliers...`);
    const prodSuppliers = await prodDb.select().from(suppliers).where(eq(suppliers.organizationId, organizationId));
    if (prodSuppliers.length > 0) {
      await db.insert(suppliers).values(prodSuppliers);
    }
    syncDetails.suppliers = prodSuppliers.length;

    console.log(`[Sync] Copying crew members...`);
    const prodCrew = await prodDb.select().from(crewMembers).where(eq(crewMembers.organizationId, organizationId));
    const sanitizedCrew = prodCrew.map(c => ({ ...c, inviteToken: null }));
    if (sanitizedCrew.length > 0) {
      await db.insert(crewMembers).values(sanitizedCrew);
    }
    syncDetails.crewMembers = sanitizedCrew.length;

    console.log(`[Sync] Copying jobs...`);
    const prodJobs = await prodDb.select().from(jobs).where(eq(jobs.organizationId, organizationId));
    if (prodJobs.length > 0) {
      await db.insert(jobs).values(prodJobs);
    }
    syncDetails.jobs = prodJobs.length;

    const jobIds = prodJobs.map(j => j.id);
    if (jobIds.length > 0) {
      console.log(`[Sync] Copying job activities...`);
      for (const jobId of jobIds) {
        const activities = await prodDb.select().from(jobActivities).where(eq(jobActivities.jobId, jobId));
        if (activities.length > 0) {
          await db.insert(jobActivities).values(activities);
        }
        syncDetails.jobActivities = (syncDetails.jobActivities || 0) + activities.length;
        
        const statusHistory = await prodDb.select().from(jobStatusHistory).where(eq(jobStatusHistory.jobId, jobId));
        if (statusHistory.length > 0) {
          await db.insert(jobStatusHistory).values(statusHistory);
        }
        syncDetails.jobStatusHistory = (syncDetails.jobStatusHistory || 0) + statusHistory.length;
      }
    }

    console.log(`[Sync] Copying job templates...`);
    const prodTemplates = await prodDb.select().from(jobTemplates).where(eq(jobTemplates.organizationId, organizationId));
    if (prodTemplates.length > 0) {
      const templateIds = prodTemplates.map(t => t.id);
      await db.delete(jobTemplates).where(inArray(jobTemplates.id, templateIds));
      await db.insert(jobTemplates).values(prodTemplates);
    }
    syncDetails.jobTemplates = prodTemplates.length;

    console.log(`[Sync] Copying items catalog...`);
    const prodItems = await prodDb.select().from(items).where(eq(items.organizationId, organizationId));
    if (prodItems.length > 0) {
      const itemIds = prodItems.map(i => i.id);
      await db.delete(items).where(inArray(items.id, itemIds));
      await db.insert(items).values(prodItems);
    }
    syncDetails.items = prodItems.length;

    console.log(`[Sync] Copying reports...`);
    const prodReports = await prodDb.select().from(reports).where(eq(reports.organizationId, organizationId));
    if (prodReports.length > 0) {
      await db.insert(reports).values(prodReports);
    }
    syncDetails.reports = prodReports.length;

    const reportIds = prodReports.map(r => r.id);
    if (reportIds.length > 0) {
      console.log(`[Sync] Copying findings and estimates...`);
      for (const reportId of reportIds) {
        const reportFindings = await prodDb.select().from(findings).where(eq(findings.reportId, reportId));
        if (reportFindings.length > 0) {
          await db.insert(findings).values(reportFindings);
        }
        syncDetails.findings = (syncDetails.findings || 0) + reportFindings.length;
        
        const estimates = await prodDb.select().from(estimateItems).where(eq(estimateItems.reportId, reportId));
        if (estimates.length > 0) {
          await db.insert(estimateItems).values(estimates);
        }
        syncDetails.estimateItems = (syncDetails.estimateItems || 0) + estimates.length;
      }
    }

    console.log(`[Sync] Copying quotes...`);
    const prodQuotes = await prodDb.select().from(quotes).where(eq(quotes.organizationId, organizationId));
    if (prodQuotes.length > 0) {
      await db.insert(quotes).values(prodQuotes);
    }
    syncDetails.quotes = prodQuotes.length;

    const quoteIds = prodQuotes.map(q => q.id);
    if (quoteIds.length > 0) {
      console.log(`[Sync] Copying quote items...`);
      for (const quoteId of quoteIds) {
        const qItems = await prodDb.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
        if (qItems.length > 0) {
          await db.insert(quoteItems).values(qItems);
        }
        syncDetails.quoteItems = (syncDetails.quoteItems || 0) + qItems.length;
      }
    }

    console.log(`[Sync] Copying invoices...`);
    const prodInvoices = await prodDb.select().from(invoices).where(eq(invoices.organizationId, organizationId));
    if (prodInvoices.length > 0) {
      await db.insert(invoices).values(prodInvoices);
    }
    syncDetails.invoices = prodInvoices.length;

    const invoiceIds = prodInvoices.map(i => i.id);
    if (invoiceIds.length > 0) {
      console.log(`[Sync] Copying invoice items...`);
      for (const invoiceId of invoiceIds) {
        const invItems = await prodDb.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
        if (invItems.length > 0) {
          await db.insert(invoiceItems).values(invItems);
        }
        syncDetails.invoiceItems = (syncDetails.invoiceItems || 0) + invItems.length;
      }
    }

    console.log(`[Sync] Copying purchase orders...`);
    const prodPOs = await prodDb.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
    if (prodPOs.length > 0) {
      await db.insert(purchaseOrders).values(prodPOs);
    }
    syncDetails.purchaseOrders = prodPOs.length;

    const poIds = prodPOs.map(p => p.id);
    if (poIds.length > 0) {
      console.log(`[Sync] Copying PO items...`);
      for (const poId of poIds) {
        const poItems = await prodDb.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
        if (poItems.length > 0) {
          await db.insert(purchaseOrderItems).values(poItems);
        }
        syncDetails.purchaseOrderItems = (syncDetails.purchaseOrderItems || 0) + poItems.length;
      }
    }

    console.log(`[Sync] Copying leads...`);
    const prodLeads = await prodDb.select().from(leads).where(eq(leads.organizationId, organizationId));
    if (prodLeads.length > 0) {
      await db.insert(leads).values(prodLeads);
    }
    syncDetails.leads = prodLeads.length;

    const leadIds = prodLeads.map(l => l.id);
    if (leadIds.length > 0) {
      console.log(`[Sync] Copying lead activities...`);
      for (const leadId of leadIds) {
        const activities = await prodDb.select().from(leadActivities).where(eq(leadActivities.leadId, leadId));
        if (activities.length > 0) {
          await db.insert(leadActivities).values(activities);
        }
        syncDetails.leadActivities = (syncDetails.leadActivities || 0) + activities.length;
      }
    }

    console.log(`[Sync] Copying appointments...`);
    const prodAppointments = await prodDb.select().from(appointments).where(eq(appointments.organizationId, organizationId));
    if (prodAppointments.length > 0) {
      await db.insert(appointments).values(prodAppointments);
    }
    syncDetails.appointments = prodAppointments.length;

    console.log(`[Sync] Copying document settings...`);
    const prodDocSettings = await prodDb.select().from(documentSettings).where(eq(documentSettings.organizationId, organizationId));
    if (prodDocSettings.length > 0) {
      await db.insert(documentSettings).values(prodDocSettings);
    }
    syncDetails.documentSettings = prodDocSettings.length;

    console.log(`[Sync] Copying app settings...`);
    const prodAppSettings = await prodDb.select().from(appSettings).where(eq(appSettings.organizationId, organizationId));
    if (prodAppSettings.length > 0) {
      await db.insert(appSettings).values(prodAppSettings);
    }
    syncDetails.appSettings = prodAppSettings.length;

    console.log(`[Sync] Copying document themes...`);
    const prodThemes = await prodDb.select().from(documentThemes).where(eq(documentThemes.organizationId, organizationId));
    if (prodThemes.length > 0) {
      await db.insert(documentThemes).values(prodThemes);
    }
    syncDetails.documentThemes = prodThemes.length;

    if (jobIds.length > 0) {
      console.log(`[Sync] Copying flashing orders...`);
      for (const jobId of jobIds) {
        const orders = await prodDb.select().from(flashingOrders).where(eq(flashingOrders.jobId, jobId));
        if (orders.length > 0) {
          await db.insert(flashingOrders).values(orders);
        }
        syncDetails.flashingOrders = (syncDetails.flashingOrders || 0) + orders.length;
      }
    }

    // Add the super admin as a crew member of the synced organization so they can view the data
    console.log(`[Sync] Adding super admin as crew member of synced org...`);
    const [adminUser] = await db.select().from(users).where(eq(users.id, adminUserId));
    if (adminUser) {
      // Check if already a crew member (avoid duplicates)
      const [existingCrew] = await db.select().from(crewMembers)
        .where(and(
          eq(crewMembers.organizationId, organizationId),
          eq(crewMembers.email, adminUser.email || '')
        ));
      
      if (!existingCrew) {
        const syncCrewId = `sync-admin-${adminUserId}-${organizationId}`;
        await db.delete(crewMembers).where(eq(crewMembers.id, syncCrewId)); // Clean up if exists
        await db.insert(crewMembers).values({
          id: syncCrewId,
          organizationId: organizationId,
          name: `${adminUser.firstName || 'Super'} ${adminUser.lastName || 'Admin'} (Sync Access)`,
          email: adminUser.email,
          role: 'manager',
          isAdmin: 'true',
          canViewAllJobs: 'true',
          canEditJobs: 'true',
          canViewFinancials: 'true',
          canAccessSettings: 'true',
          inviteStatus: 'accepted',
          userId: adminUserId,
        });
        syncDetails.syncAdminCrewMember = 1;
      }
    }

    await db.insert(adminAuditLogs).values({
      id: randomUUID(),
      adminUserId,
      action: "sync_org_from_production",
      targetOrganizationId: organizationId,
      targetOrganizationName: prodOrg.name,
      details: syncDetails,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalRecords = Object.values(syncDetails).reduce((a, b) => a + b, 0);
    
    console.log(`[Sync] Completed! ${totalRecords} records synced in ${duration}s`);
    
    let message = `Successfully synced "${prodOrg.name}" - ${totalRecords} records copied in ${duration}s`;
    if (ownerLoginInfo) {
      message += `. Login as: ${ownerLoginInfo.email} / ${ownerLoginInfo.password}`;
    }
    
    return { 
      success: true, 
      message,
      details: { ...syncDetails, ownerLogin: ownerLoginInfo }
    };
    
  } catch (error: unknown) {
    console.error("[Sync] Error during sync:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Sync failed: ${message}` };
  }
}

async function deleteOrgDataFromDev(organizationId: string) {
  console.log(`[Sync] Cleaning up existing dev data for org ${organizationId}...`);

  const orgJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.organizationId, organizationId));
  for (const job of orgJobs) {
    await db.delete(jobActivities).where(eq(jobActivities.jobId, job.id));
    await db.delete(jobStatusHistory).where(eq(jobStatusHistory.jobId, job.id));
  }

  const orgReports = await db.select({ id: reports.id }).from(reports).where(eq(reports.organizationId, organizationId));
  for (const report of orgReports) {
    await db.delete(findings).where(eq(findings.reportId, report.id));
    await db.delete(estimateItems).where(eq(estimateItems.reportId, report.id));
  }

  const orgQuotes = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.organizationId, organizationId));
  for (const quote of orgQuotes) {
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, quote.id));
  }

  const orgInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.organizationId, organizationId));
  for (const invoice of orgInvoices) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  }

  const orgPOs = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
  for (const po of orgPOs) {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
  }

  const orgLeads = await db.select({ id: leads.id }).from(leads).where(eq(leads.organizationId, organizationId));
  for (const lead of orgLeads) {
    await db.delete(leadActivities).where(eq(leadActivities.leadId, lead.id));
  }

  for (const job of orgJobs) {
    await db.delete(flashingOrders).where(eq(flashingOrders.jobId, job.id));
  }
  await db.delete(documentThemes).where(eq(documentThemes.organizationId, organizationId));
  await db.delete(appSettings).where(eq(appSettings.organizationId, organizationId));
  await db.delete(documentSettings).where(eq(documentSettings.organizationId, organizationId));
  await db.delete(items).where(eq(items.organizationId, organizationId));
  await db.delete(appointments).where(eq(appointments.organizationId, organizationId));
  await db.delete(leads).where(eq(leads.organizationId, organizationId));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
  await db.delete(invoices).where(eq(invoices.organizationId, organizationId));
  await db.delete(quotes).where(eq(quotes.organizationId, organizationId));
  await db.delete(reports).where(eq(reports.organizationId, organizationId));
  await db.delete(jobTemplates).where(eq(jobTemplates.organizationId, organizationId));
  await db.delete(jobs).where(eq(jobs.organizationId, organizationId));
  await db.delete(crewMembers).where(eq(crewMembers.organizationId, organizationId));
  await db.delete(suppliers).where(eq(suppliers.organizationId, organizationId));
  await db.delete(customers).where(eq(customers.organizationId, organizationId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

export async function unsyncOrganization(
  adminUserId: string,
  organizationId: string
): Promise<{ success: boolean; message: string }> {
  console.log(`[Unsync] Starting unsync for organization ${organizationId}...`);
  
  try {
    // Get org name for logging
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    const orgName = org?.name || organizationId;

    // Remove the sync admin crew member
    const syncCrewId = `sync-admin-${adminUserId}-${organizationId}`;
    await db.delete(crewMembers).where(eq(crewMembers.id, syncCrewId));
    console.log(`[Unsync] Removed sync admin crew member`);

    // Delete all org data
    await deleteOrgDataFromDev(organizationId);
    console.log(`[Unsync] Deleted org data`);

    // Log the unsync action
    await db.insert(adminAuditLogs).values({
      id: randomUUID(),
      adminUserId,
      action: "unsync_org_from_dev",
      targetOrganizationId: organizationId,
      targetOrganizationName: orgName,
      details: { unsynced: true },
    });

    return { 
      success: true, 
      message: `Successfully unsynced "${orgName}" - all data removed from development`
    };
  } catch (error: unknown) {
    console.error("[Unsync] Error during unsync:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Unsync failed: ${message}` };
  }
}
