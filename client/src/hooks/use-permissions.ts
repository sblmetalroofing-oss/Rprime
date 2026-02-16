import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { fetchCrewMembers } from "@/lib/api";
import type { CrewMember } from "@shared/schema";
import { getRoleCapabilities, normalizeRole, type CrewRole } from "@shared/roles";

export interface UserPermissions {
  role: CrewRole;
  isAdmin: boolean;
  canDelete: boolean;
  canViewAllJobs: boolean;
  canEditJobs: boolean;
  canViewFinancials: boolean;
  canAccessSettings: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
  isOrganizationOwner: boolean;
  isSuperAdmin: boolean;
  crewMember: CrewMember | null;
  isAuthorized: boolean;
  isLoading: boolean;
}

export function usePermissions(): UserPermissions {
  const { user, isLoading: authLoading } = useAuth();
  
  const { data: crewMembers = [], isLoading: crewLoading } = useQuery({
    queryKey: ["/api/crew-members"],
    queryFn: fetchCrewMembers,
    enabled: !!user,
  });

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/auth/permissions"],
    queryFn: async () => {
      const res = await fetch("/api/auth/permissions", { credentials: "include" });
      if (!res.ok) return { canManageBilling: false, isOrganizationOwner: false, isSuperAdmin: false };
      return res.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const isLoading = authLoading || crewLoading || permissionsLoading;
  const isSuperAdmin = permissionsData?.isSuperAdmin ?? false;
  const isOrganizationOwner = permissionsData?.isOrganizationOwner ?? false;

  // Default permissions for unauthenticated users
  const defaultPermissions: UserPermissions = {
    role: 'tradesperson',
    isAdmin: false,
    canDelete: false,
    canViewAllJobs: false,
    canEditJobs: false,
    canViewFinancials: false,
    canAccessSettings: false,
    canManageBilling: false,
    canManageTeam: false,
    isOrganizationOwner: false,
    isSuperAdmin: false,
    crewMember: null,
    isAuthorized: false,
    isLoading,
  };

  if (!user) {
    return defaultPermissions;
  }

  const userEmail = user.email?.toLowerCase();
  const matchedCrewMember = crewMembers.find(
    (member) => member.email?.toLowerCase() === userEmail && member.isActive === 'true'
  );

  // Organization owners get full permissions even without a crew record
  if (isOrganizationOwner) {
    const ownerCapabilities = getRoleCapabilities('owner');
    return {
      role: 'owner',
      isAdmin: true,
      canDelete: ownerCapabilities.canDelete,
      canViewAllJobs: ownerCapabilities.canViewAllJobs,
      canEditJobs: ownerCapabilities.canEditJobs,
      canViewFinancials: ownerCapabilities.canViewFinancials,
      canAccessSettings: ownerCapabilities.canAccessSettings,
      canManageBilling: ownerCapabilities.canManageBilling,
      canManageTeam: ownerCapabilities.canManageTeam,
      isOrganizationOwner: true,
      isSuperAdmin,
      crewMember: matchedCrewMember || null,
      isAuthorized: true,
      isLoading,
    };
  }

  if (!matchedCrewMember) {
    return defaultPermissions;
  }

  // Get permissions from the crew member's role (case-insensitive)
  const role = normalizeRole(matchedCrewMember.role);
  const capabilities = getRoleCapabilities(role);

  return {
    role,
    isAdmin: role === 'admin' || role === 'owner',
    canDelete: capabilities.canDelete,
    canViewAllJobs: capabilities.canViewAllJobs,
    canEditJobs: capabilities.canEditJobs,
    canViewFinancials: capabilities.canViewFinancials,
    canAccessSettings: capabilities.canAccessSettings,
    canManageBilling: capabilities.canManageBilling,
    canManageTeam: capabilities.canManageTeam,
    isOrganizationOwner: false,
    isSuperAdmin,
    crewMember: matchedCrewMember,
    isAuthorized: true,
    isLoading,
  };
}
