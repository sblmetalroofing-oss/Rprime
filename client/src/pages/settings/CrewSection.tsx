import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Trash2, Edit, Plus, Users, Mail, CheckCircle2, XCircle } from "lucide-react";
import * as api from "@/lib/api";
import type { CrewMember, InsertCrewMember } from "@shared/schema";

export function CrewSection() {
  const { toast } = useToast();
  const planLimits = usePlanLimits();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [editingCrewMember, setEditingCrewMember] = useState<CrewMember | null>(null);
  const [crewForm, setCrewForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "tradesperson",
    hourlyRate: "75",
    color: "#3e4f61",
    isActive: "true",
    isAdmin: "false",
    canViewAllJobs: "false",
    canEditJobs: "true",
    canViewFinancials: "false",
    canAccessSettings: "false"
  });

  const loadCrewMembers = async () => {
    setCrewLoading(true);
    const data = await api.fetchCrewMembers();
    setCrewMembers(data);
    setCrewLoading(false);
  };

  useEffect(() => {
    loadCrewMembers();
  }, []);

  const resetCrewForm = () => {
    setCrewForm({
      name: "",
      email: "",
      phone: "",
      role: "tradesperson",
      hourlyRate: "75",
      color: "#3e4f61",
      isActive: "true",
      isAdmin: "false",
      canViewAllJobs: "false",
      canEditJobs: "true",
      canViewFinancials: "false",
      canAccessSettings: "false"
    });
    setEditingCrewMember(null);
  };

  const handleEditCrewMember = (member: CrewMember) => {
    setEditingCrewMember(member);
    setCrewForm({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
      hourlyRate: member.hourlyRate?.toString() || "75",
      color: member.color || "#3e4f61",
      isActive: member.isActive,
      isAdmin: member.isAdmin || "false",
      canViewAllJobs: member.canViewAllJobs || "false",
      canEditJobs: member.canEditJobs || "true",
      canViewFinancials: member.canViewFinancials || "false",
      canAccessSettings: member.canAccessSettings || "false"
    });
    setCrewDialogOpen(true);
  };

  const handleSaveCrewMember = async () => {
    if (!crewForm.name) {
      toast({
        variant: "destructive",
        title: "Required Fields",
        description: "Name is required"
      });
      return;
    }

    const crewData: InsertCrewMember = {
      name: crewForm.name,
      email: crewForm.email || null,
      phone: crewForm.phone || null,
      role: crewForm.role,
      hourlyRate: crewForm.hourlyRate ? parseFloat(crewForm.hourlyRate) : 75,
      color: crewForm.color,
      isActive: crewForm.isActive,
      isAdmin: crewForm.isAdmin,
      canViewAllJobs: crewForm.canViewAllJobs,
      canEditJobs: crewForm.canEditJobs,
      canViewFinancials: crewForm.canViewFinancials,
      canAccessSettings: crewForm.canAccessSettings
    };

    try {
      if (editingCrewMember) {
        await api.updateCrewMember(editingCrewMember.id, crewData);
        toast({ title: "Crew Member Updated", description: "Crew member has been updated" });
      } else {
        await api.createCrewMember(crewData);
        toast({ title: "Crew Member Added", description: "New crew member has been added" });
      }
      setCrewDialogOpen(false);
      resetCrewForm();
      loadCrewMembers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingCrewMember ? 'update' : 'add'} crew member`
      });
    }
  };

  const handleDeleteCrewMember = async (id: string) => {
    if (!confirm("Are you sure you want to delete this crew member?")) return;
    try {
      await api.deleteCrewMember(id);
      toast({ title: "Crew Member Deleted", description: "Crew member has been deleted" });
      loadCrewMembers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete crew member"
      });
    }
  };

  const handleResendInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/crew-members/${id}/resend-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }
      
      toast({ title: "Invitation Sent", description: "An invitation email has been sent to the crew member." });
      loadCrewMembers();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation"
      });
    }
  };

  return (
    <>
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        feature="crew members"
        currentCount={planLimits.currentCrewCount}
        limit={planLimits.maxCrewMembers}
      />
      <Card id="crew" className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Crew Members
                {!planLimits.isLoading && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({planLimits.currentCrewCount}/{planLimits.maxCrewMembers === 999 ? '∞' : planLimits.maxCrewMembers})
                  </span>
                )}
              </CardTitle>
              <CardDescription>Manage your team members and their details</CardDescription>
            </div>
            <Dialog open={crewDialogOpen} onOpenChange={setCrewDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={(e) => {
                    if (!planLimits.canAddMoreCrew && !editingCrewMember) {
                      e.preventDefault();
                      setShowUpgradePrompt(true);
                      return;
                    }
                    resetCrewForm();
                  }} 
                  data-testid="button-add-crew-member"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Crew Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingCrewMember ? 'Edit Crew Member' : 'New Crew Member'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="crew-name">Name *</Label>
                    <Input
                      id="crew-name"
                      value={crewForm.name}
                      onChange={(e) => setCrewForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., John Smith"
                      data-testid="input-crew-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crew-email">Email</Label>
                      <Input
                        id="crew-email"
                        type="email"
                        value={crewForm.email}
                        onChange={(e) => setCrewForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                        data-testid="input-crew-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crew-phone">Phone</Label>
                      <Input
                        id="crew-phone"
                        value={crewForm.phone}
                        onChange={(e) => setCrewForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="0400 000 000"
                        data-testid="input-crew-phone"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crew-role">Role</Label>
                      <Select
                        value={crewForm.role}
                        onValueChange={(value) => {
                          const rolePermissions: Record<string, any> = {
                            owner: { isAdmin: 'true', canViewAllJobs: 'true', canEditJobs: 'true', canViewFinancials: 'true', canAccessSettings: 'true' },
                            admin: { isAdmin: 'true', canViewAllJobs: 'true', canEditJobs: 'true', canViewFinancials: 'true', canAccessSettings: 'true' },
                            manager: { isAdmin: 'false', canViewAllJobs: 'true', canEditJobs: 'true', canViewFinancials: 'true', canAccessSettings: 'false' },
                            tradesperson: { isAdmin: 'false', canViewAllJobs: 'true', canEditJobs: 'true', canViewFinancials: 'false', canAccessSettings: 'false' },
                          };
                          const perms = rolePermissions[value] || rolePermissions.tradesperson;
                          setCrewForm(prev => ({ ...prev, role: value, ...perms }));
                        }}
                      >
                        <SelectTrigger id="crew-role" data-testid="select-crew-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">
                            <div className="flex flex-col">
                              <span className="font-medium">Owner</span>
                              <span className="text-xs text-muted-foreground">Full access including billing</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex flex-col">
                              <span className="font-medium">Admin</span>
                              <span className="text-xs text-muted-foreground">Full access, manage team & settings</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="manager">
                            <div className="flex flex-col">
                              <span className="font-medium">Manager</span>
                              <span className="text-xs text-muted-foreground">Delete items, view financials</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="tradesperson">
                            <div className="flex flex-col">
                              <span className="font-medium">Tradesperson</span>
                              <span className="text-xs text-muted-foreground">View & edit jobs only</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crew-rate">Hourly Rate ($)</Label>
                      <Input
                        id="crew-rate"
                        type="number"
                        value={crewForm.hourlyRate}
                        onChange={(e) => setCrewForm(prev => ({ ...prev, hourlyRate: e.target.value }))}
                        placeholder="75"
                        data-testid="input-crew-rate"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crew-color">Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="crew-color"
                          type="color"
                          value={crewForm.color}
                          onChange={(e) => setCrewForm(prev => ({ ...prev, color: e.target.value }))}
                          className="h-9 w-16 p-1"
                          data-testid="input-crew-color"
                        />
                        <span className="text-sm text-muted-foreground">{crewForm.color}</span>
                      </div>
                    </div>
                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="crew-active"
                          checked={crewForm.isActive === 'true'}
                          onCheckedChange={(checked) => setCrewForm(prev => ({ ...prev, isActive: checked ? 'true' : 'false' }))}
                          data-testid="checkbox-crew-active"
                        />
                        <Label htmlFor="crew-active">Active</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-medium mb-3 block">What this role can do</Label>
                    <div className="bg-muted/50 rounded-lg p-4">
                      {crewForm.role === 'owner' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View and edit all jobs</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View quotes, invoices, and pricing</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Delete jobs, invoices, quotes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Manage company settings and crew</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Manage team members</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Manage billing and subscription</span>
                          </div>
                        </div>
                      )}
                      {crewForm.role === 'admin' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View and edit all jobs</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View quotes, invoices, and pricing</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Delete jobs, invoices, quotes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Manage company settings and crew</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Manage team members</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot manage billing</span>
                          </div>
                        </div>
                      )}
                      {crewForm.role === 'manager' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View and edit all jobs</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View quotes, invoices, and pricing</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Delete jobs, invoices, quotes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot access company settings</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot manage team members</span>
                          </div>
                        </div>
                      )}
                      {(crewForm.role === 'tradesperson' || !crewForm.role) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>View and edit all jobs</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot view quotes, invoices, or pricing</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot delete items</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 text-gray-400" />
                            <span>Cannot access settings</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCrewDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCrewMember} data-testid="button-save-crew-member">
                    {editingCrewMember ? 'Update' : 'Add'} Crew Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {crewLoading ? (
            <p className="text-sm text-muted-foreground">Loading crew members...</p>
          ) : crewMembers.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No crew members yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add crew members to assign them to jobs</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invite</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewMembers.map((member) => (
                  <TableRow key={member.id} data-testid={`row-crew-member-${member.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: member.color || '#3e4f61' }}
                        />
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    <TableCell>{member.phone || '-'}</TableCell>
                    <TableCell>${member.hourlyRate?.toFixed(2) || '75.00'}/hr</TableCell>
                    <TableCell>
                      <span className={member.isActive === 'true' ? 'text-green-600' : 'text-muted-foreground'}>
                        {member.isActive === 'true' ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {member.inviteStatus === 'accepted' ? (
                        <span className="text-green-600 text-sm flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Joined
                        </span>
                      ) : member.email ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleResendInvite(member.id)}
                          data-testid={`button-resend-invite-${member.id}`}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          {member.inviteSentAt ? 'Resend' : 'Send Invite'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditCrewMember(member)} data-testid={`button-edit-crew-${member.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCrewMember(member.id)} data-testid={`button-delete-crew-${member.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
