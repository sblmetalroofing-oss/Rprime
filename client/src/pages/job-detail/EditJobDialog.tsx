import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import type { CrewMember, Customer } from "@shared/schema";

export interface EditJobFormData {
  title: string;
  description: string;
  address: string;
  suburb: string;
  scheduledDate: string;
  scheduledTime: string;
  priority: string;
  assignedTo: string[];
  customerId: string | null;
  notes: string;
}

interface EditJobDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editFormData: EditJobFormData;
  onFormDataChange: (data: EditJobFormData) => void;
  onSave: () => void;
  isSaving: boolean;
  customers: Customer[];
  crewMembers: CrewMember[];
}

export function EditJobDialog({
  isOpen,
  onOpenChange,
  editFormData,
  onFormDataChange,
  onSave,
  isSaving,
  customers,
  crewMembers,
}: EditJobDialogProps) {
  const updateField = <K extends keyof EditJobFormData>(field: K, value: EditJobFormData[K]) => {
    onFormDataChange({ ...editFormData, [field]: value });
  };

  const toggleCrewMember = (memberId: string) => {
    const current = editFormData.assignedTo;
    if (current.includes(memberId)) {
      updateField('assignedTo', current.filter(id => id !== memberId));
    } else {
      updateField('assignedTo', [...current, memberId]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Job Title *</Label>
            <Input
              value={editFormData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Job title"
              data-testid="input-edit-title"
            />
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea
              value={editFormData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Job description"
              data-testid="input-edit-description"
            />
          </div>

          <div>
            <Label>Customer</Label>
            <Select 
              value={editFormData.customerId || "none"} 
              onValueChange={(v) => updateField('customerId', v === "none" ? null : v)}
            >
              <SelectTrigger data-testid="select-edit-customer">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Address</Label>
            <AddressAutocomplete
              value={editFormData.address}
              onChange={(value) => updateField('address', value)}
              onPlaceSelect={(components) => updateField('suburb', components.suburb)}
              placeholder="Start typing an address..."
              data-testid="input-edit-address"
            />
          </div>

          <div>
            <Label>Suburb</Label>
            <Input
              value={editFormData.suburb}
              onChange={(e) => updateField('suburb', e.target.value)}
              placeholder="Suburb"
              data-testid="input-edit-suburb"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={editFormData.scheduledDate}
                onChange={(e) => updateField('scheduledDate', e.target.value)}
                data-testid="input-edit-date"
              />
            </div>
            <div>
              <Label>Scheduled Time</Label>
              <Input
                type="time"
                value={editFormData.scheduledTime}
                onChange={(e) => updateField('scheduledTime', e.target.value)}
                data-testid="input-edit-time"
              />
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={editFormData.priority} onValueChange={(v) => updateField('priority', v)}>
              <SelectTrigger data-testid="select-edit-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assigned Crew</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {crewMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No crew members available</p>
              ) : (
                crewMembers.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleCrewMember(member.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      editFormData.assignedTo.includes(member.id)
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    data-testid={`edit-assign-crew-${member.id}`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: member.color || '#3b82f6' }}
                    />
                    {member.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={editFormData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Internal notes"
              data-testid="input-edit-notes"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={onSave}
              disabled={isSaving || !editFormData.title.trim()}
              className="flex-1"
              data-testid="button-save-edit"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
