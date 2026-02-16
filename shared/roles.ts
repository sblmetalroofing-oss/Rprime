export type CrewRole = 'owner' | 'admin' | 'manager' | 'tradesperson';

export interface RoleCapabilities {
  canDelete: boolean;
  canViewAllJobs: boolean;
  canEditJobs: boolean;
  canViewFinancials: boolean;
  canAccessSettings: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
}

export const ROLE_CAPABILITIES: Record<CrewRole, RoleCapabilities> = {
  owner: {
    canDelete: true,
    canViewAllJobs: true,
    canEditJobs: true,
    canViewFinancials: true,
    canAccessSettings: true,
    canManageBilling: true,
    canManageTeam: true,
  },
  admin: {
    canDelete: true,
    canViewAllJobs: true,
    canEditJobs: true,
    canViewFinancials: true,
    canAccessSettings: true,
    canManageBilling: true,
    canManageTeam: true,
  },
  manager: {
    canDelete: true,
    canViewAllJobs: true,
    canEditJobs: true,
    canViewFinancials: true,
    canAccessSettings: false,
    canManageBilling: true,
    canManageTeam: false,
  },
  tradesperson: {
    canDelete: false,
    canViewAllJobs: true,
    canEditJobs: true,
    canViewFinancials: false,
    canAccessSettings: false,
    canManageBilling: false,
    canManageTeam: false,
  },
};

export function normalizeRole(role: string | null | undefined): CrewRole {
  if (!role) return 'tradesperson';
  const normalized = role.toLowerCase().trim();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'manager') return 'manager';
  return 'tradesperson';
}

export function getRoleCapabilities(role: string | null | undefined): RoleCapabilities {
  return ROLE_CAPABILITIES[normalizeRole(role)];
}

export function canRoleDelete(role: string | null | undefined): boolean {
  return getRoleCapabilities(role).canDelete;
}

export const ROLE_DISPLAY_NAMES: Record<CrewRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  tradesperson: 'Tradesperson',
};

export const ASSIGNABLE_ROLES: CrewRole[] = ['admin', 'manager', 'tradesperson'];
