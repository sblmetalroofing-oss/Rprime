import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User,
  Check,
  Phone,
  Trash2,
  Send,
  MessageSquare
} from "lucide-react";
import { fetchJobActivities, createJobActivity, type JobActivity } from "@/lib/api";
import type { Job, CrewMember, Customer } from "@shared/schema";
import { format, parseISO } from "date-fns";

const safeFormatDate = (dateStr: string | null | undefined, formatStr: string, fallback: string = ''): string => {
  if (!dateStr || typeof dateStr !== 'string') return fallback;
  try {
    const parsed = parseISO(dateStr);
    if (isNaN(parsed.getTime())) return fallback;
    return format(parsed, formatStr);
  } catch {
    return fallback;
  }
};

export interface EditAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  crewMembers: CrewMember[];
  customer?: Customer;
  onSave: (jobId: string, updates: { scheduledDate: string | null; scheduledTime?: string | null; estimatedDuration?: number | null; assignedTo: string[]; notes?: string }) => Promise<void>;
}

export function EditAppointmentDialog({
  open,
  onOpenChange,
  job,
  crewMembers,
  customer,
  onSave
}: EditAppointmentDialogProps) {
  const { user } = useAuth();
  const [selectedCrewMembers, setSelectedCrewMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activities, setActivities] = useState<JobActivity[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingNote, setIsSendingNote] = useState(false);

  useEffect(() => {
    if (job && open) {
      const normalizedCrew = (job.assignedTo ?? []).map(idOrName => {
        const byId = crewMembers.find(m => m.id === idOrName);
        if (byId) return byId.id;
        const byName = crewMembers.find(m => m.name === idOrName);
        if (byName) return byName.id;
        return idOrName;
      });
      setSelectedCrewMembers(normalizedCrew);
      setStartDate(job.scheduledDate || '');
      setStartTime(job.scheduledTime || '');
      setDuration(job.estimatedDuration || null);
      setNewNote('');
      fetchJobActivities(job.id).then(setActivities).catch(console.error);
    }
  }, [job?.id, open, crewMembers]);

  const handleSendNote = async () => {
    if (!job || !newNote.trim()) return;
    setIsSendingNote(true);
    try {
      const crewMember = crewMembers.find(m => m.email === user?.email);
      const userName = crewMember?.name 
        || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null)
        || user?.firstName 
        || 'Crew Member';
      const activity = await createJobActivity(job.id, `[${userName}] ${newNote.trim()}`, 'note');
      setActivities(prev => [...prev, activity]);
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSendingNote(false);
    }
  };

  const toggleCrewMember = (crewId: string) => {
    setSelectedCrewMembers(prev => 
      prev.includes(crewId) 
        ? prev.filter(id => id !== crewId)
        : [...prev, crewId]
    );
  };

  const handleSubmit = async () => {
    if (!job) return;
    setIsSubmitting(true);
    try {
      await onSave(job.id, {
        scheduledDate: startDate,
        scheduledTime: startTime || undefined,
        estimatedDuration: duration,
        assignedTo: selectedCrewMembers
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!job) return;
    setIsSubmitting(true);
    try {
      await onSave(job.id, {
        scheduledDate: null,
        scheduledTime: null,
        assignedTo: []
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [, setLocation] = useLocation();

  if (!job) return null;

  const jobNumber = job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;

  const handleOpenJob = () => {
    onOpenChange(false);
    setLocation(`/jobs/${job.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-4xl p-0 gap-0 max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold">Appointment</h2>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Date <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10 h-11 text-base"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="relative sm:w-28">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="pl-10 h-11 text-base"
                    data-testid="input-start-time"
                  />
                </div>
                <select
                  value={duration ?? ''}
                  onChange={(e) => setDuration(e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-11 px-3 rounded-md border bg-background text-base sm:w-28"
                  data-testid="select-duration"
                >
                  <option value="">Duration</option>
                  <option value="0.5">30 min</option>
                  <option value="1">1 hour</option>
                  <option value="1.5">1.5 hrs</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                  <option value="4">4 hours</option>
                  <option value="6">6 hours</option>
                  <option value="8">Full day</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Staff & Connections</Label>
              <div className="flex flex-wrap gap-2">
                {crewMembers.filter(m => m.isActive === 'true').map(member => {
                  const isSelected = selectedCrewMembers.includes(member.id);
                  const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleCrewMember(member.id)}
                      className={`flex items-center gap-2 pl-1 pr-3 py-1.5 min-h-[44px] rounded-full text-sm transition-all border ${
                        isSelected
                          ? 'border-slate-400 bg-slate-100 dark:bg-slate-700'
                          : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100'
                      }`}
                      data-testid={`edit-crew-${member.id}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: member.color || '#3b82f6' }}
                      >
                        {initials}
                      </div>
                      <span>{member.name}</span>
                      {isSelected && <Check className="h-4 w-4 ml-1" />}
                    </button>
                  );
                })}
              </div>
              {selectedCrewMembers.length === 0 && (
                <p className="text-xs text-muted-foreground">Tap to assign crew members</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Add Note</Label>
              <div className="flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-11 text-base"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendNote()}
                  data-testid="input-notes"
                />
                <Button 
                  size="icon" 
                  onClick={handleSendNote}
                  disabled={!newNote.trim() || isSendingNote}
                  className="bg-cyan-600 hover:bg-cyan-700 h-11 w-11"
                  data-testid="button-send-note"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-800/50 p-4 md:p-5 space-y-4 border-t md:border-t-0 md:border-l">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Job</span>
              <button 
                onClick={handleOpenJob}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium px-3 py-2 -mr-2 min-h-[44px] flex items-center"
                data-testid="button-open-job"
              >
                Open Job
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border">
              <div className="font-mono text-sm font-medium">{jobNumber}</div>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-cyan-600">{customer?.name || job.title || 'No Customer'}</div>
                  </div>
                </div>
                
                {job.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{job.address}</span>
                  </div>
                )}

                {customer?.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <a 
                      href={`tel:${customer.phone}`} 
                      className="text-sm text-cyan-600 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                )}

                {job.title && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground mt-0.5">↳</span>
                    <span className="text-sm text-muted-foreground">{job.title}</span>
                  </div>
                )}

                {job.description && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="ml-4">{job.description}</span>
                  </div>
                )}
              </div>
            </div>

            {activities.filter(a => a.type === 'note').length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Notes ({activities.filter(a => a.type === 'note').length})</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {activities.filter(a => a.type === 'note').map(activity => {
                    const match = activity.content.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
                    const authorName = match?.[1];
                    const messageContent = match?.[2] || activity.content;
                    const authorCrew = authorName ? crewMembers.find(m => 
                      m.name === authorName || m.email === authorName || m.email?.startsWith(authorName)
                    ) : undefined;
                    return (
                      <div key={activity.id} className="p-2 bg-white dark:bg-slate-800 rounded border text-xs">
                        <p className="text-foreground whitespace-pre-wrap">
                          {authorName && (
                            <span style={{ color: authorCrew?.color || undefined }} className="font-medium">
                              [{authorName}]
                            </span>
                          )}
                          {authorName ? ` ${messageContent}` : activity.content}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 border-t bg-slate-50 dark:bg-slate-800/30">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="h-11 min-w-[100px]"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <div className="flex gap-3 shrink-0">
            <Button 
              variant="outline"
              onClick={handleDeleteAppointment}
              disabled={isSubmitting}
              className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 h-11 min-w-[100px]"
              data-testid="button-delete-appointment"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!startDate || isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 min-w-[100px] px-6"
              data-testid="button-save-appointment"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
