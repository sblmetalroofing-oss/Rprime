import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Check,
  ExternalLink,
  Trash2
} from "lucide-react";
import type { Job, CrewMember, Customer, Appointment, InsertAppointment } from "@shared/schema";

export interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  selectedDate: string;
  selectedCrewId: string;
  crewMembers: CrewMember[];
  jobs: Job[];
  customers: Customer[];
  onSave: (data: Partial<InsertAppointment>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  selectedDate,
  selectedCrewId,
  crewMembers,
  jobs,
  customers,
  onSave,
  onDelete
}: AppointmentFormDialogProps) {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const linkedJob = appointment?.jobId ? jobs.find(j => j.id === appointment.jobId) : null;
  const linkedCustomer = linkedJob?.customerId ? customers.find(c => c.id === linkedJob.customerId) : null;
  const jobNumber = linkedJob ? (linkedJob.referenceNumber || `#${linkedJob.id.slice(-8).toUpperCase()}`) : null;

  useEffect(() => {
    if (open) {
      if (appointment) {
        setTitle(appointment.title);
        setDescription(appointment.description || '');
        setLocationInput(appointment.location || '');
        setScheduledDate(appointment.scheduledDate || '');
        setScheduledTime(appointment.scheduledTime || '');
        setEndTime(appointment.endTime || '');
        setAssignedTo(appointment.assignedTo || []);
      } else {
        setTitle('');
        setDescription('');
        setLocationInput('');
        setScheduledDate(selectedDate);
        setScheduledTime('');
        setEndTime('');
        setAssignedTo(selectedCrewId ? [selectedCrewId] : []);
      }
    }
  }, [open, appointment, selectedDate, selectedCrewId]);

  const toggleCrewMember = (crewId: string) => {
    setAssignedTo(prev => 
      prev.includes(crewId) 
        ? prev.filter(id => id !== crewId)
        : [...prev, crewId]
    );
  };

  const handleSubmit = async () => {
    if (!linkedJob && !title.trim()) return;
    if (!scheduledDate) return;
    setIsSubmitting(true);
    try {
      await onSave({
        title: linkedJob ? (linkedJob.title || 'Job') : title.trim(),
        description: description.trim() || null,
        location: locationInput.trim() || null,
        scheduledDate,
        scheduledTime: scheduledTime || null,
        endTime: endTime || null,
        assignedTo
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg pt-8 sm:pt-6" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{linkedJob ? 'Edit Job Schedule' : (appointment ? 'Edit Appointment' : 'New Appointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {linkedJob ? (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300">{jobNumber} • {linkedCustomer?.name || linkedJob.title}</p>
                  {linkedJob.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {linkedJob.address}
                    </p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    setLocation(`/jobs/${linkedJob.id}`);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Job
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting, Site Visit, etc."
                className="h-11 text-base"
                data-testid="input-appointment-title"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Date & Time</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="pl-10 h-11 text-base"
                  data-testid="input-appointment-date"
                />
              </div>
              <div className="relative sm:w-28">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="pl-10 h-11 text-base"
                  placeholder="Start"
                  data-testid="input-appointment-start-time"
                />
              </div>
              <div className="relative sm:w-28">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-10 h-11 text-base"
                  placeholder="End"
                  data-testid="input-appointment-end-time"
                />
              </div>
            </div>
          </div>

          {!linkedJob && (
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Address or meeting location"
                  className="pl-10 h-11 text-base"
                  data-testid="input-appointment-location"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or details..."
              className="h-11 text-base"
              data-testid="input-appointment-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <div className="flex flex-wrap gap-2">
              {crewMembers.filter(m => m.isActive === 'true').map(member => {
                const isSelected = assignedTo.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleCrewMember(member.id)}
                    className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-md text-sm transition-all border ${
                      isSelected
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-muted bg-muted/50 hover:bg-muted'
                    }`}
                    data-testid={`appt-crew-${member.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: member.color || '#3b82f6' }}
                    />
                    <span>{member.name}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 w-full sm:w-auto">
            Cancel
          </Button>
          {appointment && onDelete && (
            <Button 
              variant="outline"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="text-red-600 border-red-300 hover:bg-red-50 h-11 w-full sm:w-auto"
              data-testid="button-delete-appt"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={(!linkedJob && !title.trim()) || !scheduledDate || isSubmitting}
            className="h-11 w-full sm:w-auto"
            data-testid="button-save-appointment"
          >
            {isSubmitting ? 'Saving...' : (appointment ? 'Update' : 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
