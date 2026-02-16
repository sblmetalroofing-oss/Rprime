import { storage } from "./storage";
import type { InsertSettingsMigration } from "@shared/schema";

const TRACKED_TABLES = [
  'organizations',
  'document_settings',
  'document_themes',
  'document_theme_settings',
  'app_settings'
] as const;

type TrackedTable = typeof TRACKED_TABLES[number];

function isTrackedTable(table: string): table is TrackedTable {
  return TRACKED_TABLES.includes(table as TrackedTable);
}

export async function trackSettingsChange(
  tableName: string,
  recordId: string,
  operation: 'insert' | 'update' | 'delete',
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null,
  organizationId?: string
): Promise<void> {
  if (!isTrackedTable(tableName)) {
    return;
  }
  
  const migration: InsertSettingsMigration = {
    tableName,
    recordId,
    organizationId: organizationId || null,
    operation,
    oldValue,
    newValue,
    status: 'pending'
  };
  
  await storage.createSettingsMigration(migration);
}

export async function getPendingMigrations() {
  return storage.getPendingSettingsMigrations();
}

export async function getAllMigrations() {
  return storage.getAllSettingsMigrations();
}

export async function markMigrationApplied(id: string, appliedBy: string) {
  await storage.updateSettingsMigrationStatus(id, 'applied', appliedBy);
}

export async function markMigrationSkipped(id: string) {
  await storage.updateSettingsMigrationStatus(id, 'skipped');
}

export async function clearMigrations() {
  await storage.clearAllSettingsMigrations();
}
