import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Building2, Ban, RotateCcw, Trash2, MoreHorizontal, Database, RefreshCw, GitBranch, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/date-utils";

interface Organization {
  id: string;
  name: string;
  email: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  billingOverride: string | null;
  planOverride: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  status: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  owner: { name: string | null; email: string | null } | null;
}

interface SettingsMigration {
  id: string;
  tableName: string;
  recordId: string;
  organizationId: string | null;
  operation: string;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  status: string;
  createdAt: string;
  appliedAt: string | null;
  appliedBy: string | null;
}

export default function AdminOrganizations() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [suspendDialog, setSuspendDialog] = useState<{ org: Organization | null; reason: string }>({ org: null, reason: "" });
  const [deleteDialog, setDeleteDialog] = useState<Organization | null>(null);
  const [selectedProdOrg, setSelectedProdOrg] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message?: string }>({ loading: false });
  const [lastSyncedOrgId, setLastSyncedOrgId] = useState<string | null>(null);
  const [unsyncStatus, setUnsyncStatus] = useState<{ loading: boolean }>({ loading: false });
  const [expandedMigration, setExpandedMigration] = useState<string | null>(null);
  const [jobMigrationStatus, setJobMigrationStatus] = useState<{ loading: boolean; message?: string; details?: { totalJobs?: number; migratedCount?: number; skippedCount?: number } }>({ loading: false });

  useEffect(() => {
    if (!authLoading && (!user || !user.isSuperAdmin)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const { data: orgsData, isLoading } = useQuery({
    queryKey: ["/api/admin/organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("Super admin access required");
        throw new Error("Failed to fetch organizations");
      }
      return res.json();
    },
    enabled: !!user?.isSuperAdmin,
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ 
      organizationId, 
      billingOverride, 
      planOverride 
    }: { 
      organizationId: string; 
      billingOverride?: string;
      planOverride?: string | null;
    }) => {
      const res = await fetch(`/api/admin/organizations/${organizationId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingOverride, planOverride }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update override");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Override updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update override", variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ organizationId, reason }: { organizationId: string; reason?: string }) => {
      const res = await fetch(`/api/admin/organizations/${organizationId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to suspend organization");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization suspended" });
      setSuspendDialog({ org: null, reason: "" });
    },
    onError: () => {
      toast({ title: "Failed to suspend organization", variant: "destructive" });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await fetch(`/api/admin/organizations/${organizationId}/unsuspend`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unsuspend organization");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization unsuspended" });
    },
    onError: () => {
      toast({ title: "Failed to unsuspend organization", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await fetch(`/api/admin/organizations/${organizationId}/delete`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete organization");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization deleted" });
      setDeleteDialog(null);
    },
    onError: () => {
      toast({ title: "Failed to delete organization", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await fetch(`/api/admin/organizations/${organizationId}/restore`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to restore organization");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore organization", variant: "destructive" });
    },
  });

  const { data: prodOrgsData, isLoading: prodOrgsLoading } = useQuery({
    queryKey: ["/api/admin/prod-orgs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/prod-orgs", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch production organizations");
      }
      return res.json();
    },
    enabled: !!user?.isSuperAdmin,
    retry: false,
  });

  const prodOrganizations: { id: string; name: string; email: string | null; subscriptionPlan: string | null }[] = prodOrgsData?.organizations || [];

  const { data: migrationsData, refetch: refetchMigrations } = useQuery({
    queryKey: ["/api/admin/settings-migrations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings-migrations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch migrations");
      return res.json();
    },
    enabled: !!user?.isSuperAdmin,
    retry: false,
  });

  const migrations: SettingsMigration[] = migrationsData?.migrations || [];
  const pendingMigrations = migrations.filter(m => m.status === 'pending');

  const applyMigrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/settings-migrations/${id}/apply`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to apply migration");
      return res.json();
    },
    onSuccess: () => {
      refetchMigrations();
      toast({ title: "Migration marked as applied" });
    },
    onError: () => {
      toast({ title: "Failed to apply migration", variant: "destructive" });
    },
  });

  const skipMigrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/settings-migrations/${id}/skip`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to skip migration");
      return res.json();
    },
    onSuccess: () => {
      refetchMigrations();
      toast({ title: "Migration skipped" });
    },
    onError: () => {
      toast({ title: "Failed to skip migration", variant: "destructive" });
    },
  });

  const clearMigrationsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings-migrations/clear-pending", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear migrations");
      return res.json();
    },
    onSuccess: () => {
      refetchMigrations();
      toast({ title: "All pending migrations cleared" });
    },
    onError: () => {
      toast({ title: "Failed to clear migrations", variant: "destructive" });
    },
  });

  const handleSyncOrg = async () => {
    if (!selectedProdOrg) return;
    
    setSyncStatus({ loading: true, message: "Syncing organization data..." });
    try {
      const res = await fetch("/api/admin/sync-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: selectedProdOrg }),
        credentials: "include",
      });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: "Sync Complete", description: data.message });
        setSyncStatus({ loading: false, message: data.message });
        setLastSyncedOrgId(selectedProdOrg);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      } else {
        toast({ title: "Sync Failed", description: data.message, variant: "destructive" });
        setSyncStatus({ loading: false, message: data.message });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Sync Failed", description: message, variant: "destructive" });
      setSyncStatus({ loading: false, message });
    }
  };

  const handleUnsyncOrg = async () => {
    if (!lastSyncedOrgId) return;
    
    setUnsyncStatus({ loading: true });
    try {
      const res = await fetch("/api/admin/unsync-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: lastSyncedOrgId }),
        credentials: "include",
      });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: "Unsync Complete", description: data.message });
        setLastSyncedOrgId(null);
        setSyncStatus({ loading: false, message: undefined });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      } else {
        toast({ title: "Unsync Failed", description: data.message, variant: "destructive" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Unsync Failed", description: message, variant: "destructive" });
    } finally {
      setUnsyncStatus({ loading: false });
    }
  };

  const handleMigrateJobs = async () => {
    const orgId = lastSyncedOrgId || selectedProdOrg;
    if (!orgId) return;
    
    setJobMigrationStatus({ loading: true, message: "Migrating jobs to appointments..." });
    try {
      const res = await fetch("/api/admin/migrate-jobs-to-appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
        credentials: "include",
      });
      const data = await res.json();
      
      if (data.success) {
        toast({ title: "Migration Complete", description: data.message });
        setJobMigrationStatus({ loading: false, message: data.message, details: data.details });
      } else {
        toast({ title: "Migration Failed", description: data.error || data.message, variant: "destructive" });
        setJobMigrationStatus({ loading: false, message: data.error || data.message });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Migration Failed", description: message, variant: "destructive" });
      setJobMigrationStatus({ loading: false, message });
    }
  };

  const organizations: Organization[] = orgsData?.organizations || [];

  const getSubscriptionStatusBadge = (status?: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "canceled":
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getAccountStatusBadge = (org: Organization) => {
    switch (org.status) {
      case "suspended":
        return <Badge variant="destructive" className="bg-red-600">Suspended</Badge>;
      case "deleted":
        return <Badge variant="secondary" className="bg-gray-600">Deleted</Badge>;
      default:
        return <Badge className="bg-green-500">Active</Badge>;
    }
  };

  const getPlanBadge = (plan?: string | null) => {
    switch (plan) {
      case "starter":
        return <Badge variant="outline">Starter</Badge>;
      case "professional":
        return <Badge className="bg-purple-500">Professional</Badge>;
      case "business":
        return <Badge className="bg-amber-500">Business</Badge>;
      default:
        return <Badge variant="outline">{plan || "None"}</Badge>;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return formatDateShort(dateStr);
  };

  if (authLoading || (!user?.isSuperAdmin && !authLoading)) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading organizations...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-muted-foreground">Manage organizations, billing overrides, and sync data</p>
          </div>
        </div>

        {/* Sync from Production */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync from Production
            </CardTitle>
            <CardDescription>Copy organization data from production to development for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {prodOrgsLoading ? (
              <div className="text-muted-foreground">Loading production organizations...</div>
            ) : prodOrganizations.length === 0 ? (
              <div className="text-muted-foreground">
                No production organizations found. Make sure PRODUCTION_DATABASE_URL is configured.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Select Organization to Sync</Label>
                    <Select value={selectedProdOrg} onValueChange={setSelectedProdOrg}>
                      <SelectTrigger data-testid="select-prod-org">
                        <SelectValue placeholder="Choose an organization..." />
                      </SelectTrigger>
                      <SelectContent>
                        {prodOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} {org.email ? `(${org.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleSyncOrg} 
                    disabled={!selectedProdOrg || syncStatus.loading}
                    className="min-w-[140px]"
                    data-testid="button-sync"
                  >
                    {syncStatus.loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync to Dev
                      </>
                    )}
                  </Button>
                  {lastSyncedOrgId && (
                    <Button 
                      onClick={handleUnsyncOrg} 
                      disabled={unsyncStatus.loading}
                      variant="destructive"
                      className="min-w-[120px]"
                      data-testid="button-unsync"
                    >
                      {unsyncStatus.loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Unsync
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {syncStatus.message && (
                  <div className={`text-sm p-3 rounded-lg ${syncStatus.loading ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                    {syncStatus.message}
                  </div>
                )}
                
                {(lastSyncedOrgId || selectedProdOrg) && (
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">Migrate Jobs to Appointments</h4>
                        <p className="text-xs text-muted-foreground">Convert old single-date job scheduling to multi-date appointments</p>
                      </div>
                      <Button
                        onClick={handleMigrateJobs}
                        disabled={jobMigrationStatus.loading}
                        variant="outline"
                        size="sm"
                        data-testid="button-migrate-jobs"
                      >
                        {jobMigrationStatus.loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Migrating...
                          </>
                        ) : (
                          <>
                            <GitBranch className="h-4 w-4 mr-2" />
                            Migrate Jobs
                          </>
                        )}
                      </Button>
                    </div>
                    {jobMigrationStatus.message && (
                      <div className={`text-sm p-3 rounded-lg ${jobMigrationStatus.loading ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : jobMigrationStatus.details ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {jobMigrationStatus.message}
                        {jobMigrationStatus.details && (
                          <div className="mt-1 text-xs opacity-80">
                            Total jobs: {jobMigrationStatus.details.totalJobs}, 
                            Migrated: {jobMigrationStatus.details.migratedCount}, 
                            Already done: {jobMigrationStatus.details.skippedCount}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  This will copy all data (customers, jobs, quotes, invoices, etc.) from the selected production organization to your development database.
                  Existing development data for that organization will be replaced.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Migrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Settings Migrations
                  {pendingMigrations.length > 0 && (
                    <Badge className="bg-yellow-500">{pendingMigrations.length} pending</Badge>
                  )}
                </CardTitle>
                <CardDescription>Track and apply settings changes to production</CardDescription>
              </div>
              {pendingMigrations.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => clearMigrationsMutation.mutate()}
                  disabled={clearMigrationsMutation.isPending}
                  data-testid="button-clear-migrations"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All Pending
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {migrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No settings migrations recorded yet. Changes to document settings, themes, and app settings will be tracked here.
              </div>
            ) : (
              <div className="space-y-3">
                {migrations.slice(0, 20).map((migration) => (
                  <div 
                    key={migration.id} 
                    className={`border rounded-lg p-4 ${migration.status === 'pending' ? 'border-yellow-300 bg-yellow-50' : migration.status === 'applied' ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                    data-testid={`migration-${migration.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={migration.operation === 'insert' ? 'default' : migration.operation === 'delete' ? 'destructive' : 'secondary'}>
                          {migration.operation}
                        </Badge>
                        <div>
                          <div className="font-medium">{migration.tableName}</div>
                          <div className="text-sm text-muted-foreground">
                            Record: {migration.recordId.length > 40 ? migration.recordId.slice(0, 40) + '...' : migration.recordId}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={migration.status === 'pending' ? 'outline' : migration.status === 'applied' ? 'default' : 'secondary'}>
                          {migration.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedMigration(expandedMigration === migration.id ? null : migration.id)}
                          data-testid={`button-expand-${migration.id}`}
                        >
                          {expandedMigration === migration.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {migration.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyMigrationMutation.mutate(migration.id)}
                              disabled={applyMigrationMutation.isPending}
                              data-testid={`button-apply-${migration.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Mark Applied
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => skipMigrationMutation.mutate(migration.id)}
                              disabled={skipMigrationMutation.isPending}
                              data-testid={`button-skip-${migration.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Skip
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {expandedMigration === migration.id && (
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(migration.createdAt).toLocaleString()}
                          {migration.appliedAt && ` | Applied: ${new Date(migration.appliedAt).toLocaleString()}`}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium mb-1 text-red-600">Old Value</div>
                            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                              {migration.oldValue ? JSON.stringify(migration.oldValue, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div>
                            <div className="font-medium mb-1 text-green-600">New Value</div>
                            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                              {migration.newValue ? JSON.stringify(migration.newValue, null, 2) : 'null'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {migrations.length > 20 && (
                  <div className="text-center text-sm text-muted-foreground">
                    Showing 20 of {migrations.length} migrations
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>All registered organizations with override controls</CardDescription>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No organizations registered yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization Name</TableHead>
                      <TableHead>Owner Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Free Access</TableHead>
                      <TableHead>Plan Override</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id} data-testid={`row-org-${org.id}`} className={org.status === 'deleted' ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="font-medium">{org.name}</div>
                          {org.email && (
                            <div className="text-sm text-muted-foreground">{org.email}</div>
                          )}
                        </TableCell>
                        <TableCell>{org.owner?.email || "-"}</TableCell>
                        <TableCell>{getPlanBadge(org.subscriptionPlan)}</TableCell>
                        <TableCell>{getSubscriptionStatusBadge(org.subscriptionStatus)}</TableCell>
                        <TableCell>{getAccountStatusBadge(org)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={org.billingOverride === "free"}
                            onCheckedChange={(checked) => {
                              overrideMutation.mutate({
                                organizationId: org.id,
                                billingOverride: checked ? "free" : "none",
                              });
                            }}
                            disabled={overrideMutation.isPending || org.status === 'deleted'}
                            data-testid={`switch-free-access-${org.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={org.planOverride || "none"}
                            onValueChange={(value) => {
                              overrideMutation.mutate({
                                organizationId: org.id,
                                planOverride: value === "none" ? null : value,
                              });
                            }}
                            disabled={overrideMutation.isPending || org.status === 'deleted'}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-plan-override-${org.id}`}>
                              <SelectValue placeholder="No override" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Override</SelectItem>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{formatDate(org.createdAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${org.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {org.status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() => setSuspendDialog({ org, reason: "" })}
                                  className="text-orange-600"
                                  data-testid={`menu-suspend-${org.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              {org.status === 'suspended' && (
                                <DropdownMenuItem
                                  onClick={() => unsuspendMutation.mutate(org.id)}
                                  className="text-green-600"
                                  data-testid={`menu-unsuspend-${org.id}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Unsuspend
                                </DropdownMenuItem>
                              )}
                              {org.status === 'deleted' && (
                                <DropdownMenuItem
                                  onClick={() => restoreMutation.mutate(org.id)}
                                  className="text-green-600"
                                  data-testid={`menu-restore-${org.id}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              )}
                              {org.status !== 'deleted' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteDialog(org)}
                                    className="text-red-600"
                                    data-testid={`menu-delete-${org.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendDialog.org} onOpenChange={(open) => !open && setSuspendDialog({ org: null, reason: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Organization</DialogTitle>
            <DialogDescription>
              This will prevent all users in "{suspendDialog.org?.name}" from accessing the application.
              They will see a "suspended" message when trying to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="suspend-reason">Reason (optional)</Label>
              <Textarea
                id="suspend-reason"
                placeholder="Enter a reason for suspension..."
                value={suspendDialog.reason}
                onChange={(e) => setSuspendDialog({ ...suspendDialog, reason: e.target.value })}
                data-testid="input-suspend-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ org: null, reason: "" })} data-testid="button-cancel-suspend">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (suspendDialog.org) {
                  suspendMutation.mutate({
                    organizationId: suspendDialog.org.id,
                    reason: suspendDialog.reason || undefined,
                  });
                }
              }}
              disabled={suspendMutation.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog?.name}"? 
              This is a soft delete - the organization can be restored later.
              Users will no longer be able to access the application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialog) {
                  deleteMutation.mutate(deleteDialog.id);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
