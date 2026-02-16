import { storage } from "./storage";
import { randomUUID } from "crypto";
import { db } from "./db";
import { customers, crewMembers, jobs, quotes, documentThemes, documentSettings } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

export interface SeedDataOptions {
  organizationId: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  forceReseed?: boolean;
}

async function hasAnyData(organizationId: string): Promise<{ hasData: boolean; summary: string }> {
  const checks = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customers).where(eq(customers.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` }).from(crewMembers).where(eq(crewMembers.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` }).from(documentThemes).where(eq(documentThemes.organizationId, organizationId)),
    db.select({ count: sql<number>`count(*)` }).from(documentSettings).where(eq(documentSettings.organizationId, organizationId)),
  ]);

  const counts = {
    customers: Number(checks[0][0]?.count || 0),
    crewMembers: Number(checks[1][0]?.count || 0),
    jobs: Number(checks[2][0]?.count || 0),
    quotes: Number(checks[3][0]?.count || 0),
    documentThemes: Number(checks[4][0]?.count || 0),
    documentSettings: Number(checks[5][0]?.count || 0),
  };

  const hasData = Object.values(counts).some(c => c > 0);
  const summary = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([name, c]) => `${c} ${name}`)
    .join(", ");

  return { hasData, summary };
}

export async function seedOrganizationData(options: SeedDataOptions): Promise<void> {
  const { organizationId, companyName, ownerName, ownerEmail, forceReseed = false } = options;

  if (!forceReseed) {
    const { hasData, summary } = await hasAnyData(organizationId);

    if (hasData) {
      console.log(`Skipping seed for org ${organizationId} - already has: ${summary}`);
      return;
    }
  }

  const sampleCustomers = [
    {
      id: randomUUID(),
      organizationId,
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "0412 345 678",
      address: "123 Main Street",
      suburb: "Sydney",
      postcode: "2000",
      state: "NSW",
      notes: "Sample customer - feel free to edit or delete",
    },
    {
      id: randomUUID(),
      organizationId,
      name: "Sarah Johnson",
      email: "sarah.j@example.com",
      phone: "0423 456 789",
      address: "45 Oak Avenue",
      suburb: "Melbourne",
      postcode: "3000",
      state: "VIC",
      notes: "Sample customer - feel free to edit or delete",
    },
    {
      id: randomUUID(),
      organizationId,
      name: "Mike Wilson",
      email: "mike.wilson@example.com",
      phone: "0434 567 890",
      address: "78 Park Road",
      suburb: "Brisbane",
      postcode: "4000",
      state: "QLD",
      notes: "Sample customer - feel free to edit or delete",
    },
  ];

  // Create customers in parallel
  await Promise.all(sampleCustomers.map(customer => storage.createCustomer(customer)));

  const ownerCrewMember = {
    id: randomUUID(),
    organizationId,
    name: ownerName,
    email: ownerEmail,
    role: "owner",
    hourlyRate: 85,
    color: "#0891b2",
    isActive: "true",
    isAdmin: "true",
    canViewAllJobs: "true",
    canEditJobs: "true",
    canViewFinancials: "true",
    canAccessSettings: "true",
    inviteStatus: "accepted",
  };

  await storage.createCrewMember(ownerCrewMember);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const sampleJobs = [
    {
      id: randomUUID(),
      organizationId,
      referenceNumber: "J0001",
      customerId: sampleCustomers[0].id,
      title: "Roof Inspection",
      description: "Complete roof inspection and assessment. This is a sample job - feel free to edit or delete.",
      address: sampleCustomers[0].address,
      suburb: sampleCustomers[0].suburb,
      scheduledDate: formatDate(tomorrow),
      scheduledTime: "09:00",
      estimatedDuration: 2,
      status: "scheduled",
      priority: "normal",
      assignedTo: [ownerName],
    },
    {
      id: randomUUID(),
      organizationId,
      referenceNumber: "J0002",
      customerId: sampleCustomers[1].id,
      title: "Gutter Repair",
      description: "Repair damaged gutters on the north side. This is a sample job - feel free to edit or delete.",
      address: sampleCustomers[1].address,
      suburb: sampleCustomers[1].suburb,
      scheduledDate: formatDate(nextWeek),
      scheduledTime: "10:00",
      estimatedDuration: 4,
      status: "quoted",
      priority: "high",
      assignedTo: [ownerName],
    },
  ];

  // Create jobs in parallel
  await Promise.all(sampleJobs.map(job => storage.createJob(job)));

  const quoteId = randomUUID();
  const quoteNumber = await storage.getNextQuoteNumber(organizationId);

  const sampleQuote = {
    id: quoteId,
    organizationId,
    quoteNumber,
    customerId: sampleCustomers[1].id,
    jobId: sampleJobs[1].id,
    customerName: sampleCustomers[1].name,
    customerEmail: sampleCustomers[1].email,
    customerPhone: sampleCustomers[1].phone,
    address: sampleCustomers[1].address,
    suburb: sampleCustomers[1].suburb,
    status: "draft",
    issueDate: formatDate(today),
    expiryDate: formatDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
    description: "Gutter repair quote - sample quote",
    discount: 0,
    subtotal: 850,
    gst: 85,
    total: 935,
    sortOrder: 1, // Added sortOrder based on schema
  };

  await storage.createQuote(sampleQuote);

  const quoteItems = [
    {
      id: randomUUID(),
      quoteId,
      description: "Labour - Gutter repair and replacement",
      qty: 4,
      unitCost: 85,
      costPrice: 50,
      total: 340,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      quoteId,
      description: "Materials - Colorbond guttering 6m lengths",
      qty: 3,
      unitCost: 120,
      costPrice: 80,
      total: 360,
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      quoteId,
      description: "Materials - Brackets and fasteners",
      qty: 1,
      unitCost: 150,
      costPrice: 100,
      total: 150,
      sortOrder: 3,
    },
  ];

  // Create quote items in parallel
  await Promise.all(quoteItems.map(item => storage.createQuoteItem(item)));

  const defaultTheme = {
    id: randomUUID(),
    organizationId,
    name: "Default Theme",
    isDefault: "true",
    isArchived: "false",
    themeColor: "#0891b2",
    companyName: companyName,
    email1: ownerEmail,
  };

  await storage.createDocumentTheme(defaultTheme);

  // Update settings in parallel
  await Promise.all([
    storage.upsertDocumentSettings(organizationId, {
      id: randomUUID(),
      organizationId,
      type: "quote",
      prefix: "Q",
      nextNumber: 2,
      defaultExpiryDays: 30,
      defaultTerms: "Payment due within 14 days of acceptance. Quote valid for 30 days.",
    }),
    storage.upsertDocumentSettings(organizationId, {
      id: randomUUID(),
      organizationId,
      type: "invoice",
      prefix: "INV",
      nextNumber: 1,
      defaultDueDays: 14,
      defaultTerms: "Payment due within 14 days. Thank you for your business.",
    })
  ]);

  console.log(`Seeded organization ${organizationId} with sample data`);
}
