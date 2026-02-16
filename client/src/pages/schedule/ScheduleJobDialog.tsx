import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Job, CrewMember, Customer } from "@shared/schema";

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

export function ScheduleJobDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedCrewId,
  selectedTime = '',
  jobs,
  crewMembers,
  customers,
  onSchedule
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  selectedCrewId: string;
  selectedTime?: string;
  jobs: Job[];
  crewMembers: CrewMember[];
  customers: Customer[];
  onSchedule: (jobId: string, updates: { scheduledDate: string; scheduledTime?: string; assignedTo: string[] }) => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCrewMembers, setSelectedCrewMembers] = useState<string[]>(selectedCrewId ? [selectedCrewId] : []);
  const [scheduledTime, setScheduledTime] = useState(selectedTime);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedJobId(null);
      setSelectedCrewMembers(selectedCrewId ? [selectedCrewId] : []);
      setScheduledTime(selectedTime);
      setSearchQuery('');
      setShowAllJobs(false);
    }
  }, [open, selectedCrewId, selectedTime]);

  const getCustomerName = useCallback((customerId?: string | null) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId)?.name;
  }, [customers]);

  const unscheduledJobs = useMemo(() => jobs.filter(j => !j.scheduledDate), [jobs]);
  const displayJobs = useMemo(() => showAllJobs ? jobs : unscheduledJobs, [showAllJobs, jobs, unscheduledJobs]);
  
  const filteredJobs = useMemo(() => displayJobs.filter(job => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const customerName = getCustomerName(job.customerId)?.toLowerCase() || '';
    return (
      job.title.toLowerCase().includes(query) ||
      job.address.toLowerCase().includes(query) ||
      customerName.includes(query)
    );
  }), [displayJobs, searchQuery, getCustomerName]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const toggleCrewMember = (memberId: string) => {
    setSelectedCrewMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedJobId) return;
    setIsSubmitting(true);
    try {
      await onSchedule(selectedJobId, {
        scheduledDate: selectedDate,
        scheduledTime: scheduledTime || undefined,
        assignedTo: selectedCrewMembers
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-lg max-h-[85vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Schedule Job</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
          <div className="text-sm text-muted-foreground">
            Schedule a job for <strong>{safeFormatDate(selectedDate, 'EEEE, MMMM d', 'selected date')}</strong>
          </div>

          <div className="space-y-2">
            <Label>Select Job</Label>
            <Input
              placeholder="Search jobs by title, address, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 text-base"
              data-testid="input-search-jobs"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`px-3 py-2 min-h-[44px] rounded-md text-sm font-medium transition-colors ${!showAllJobs ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                onClick={() => setShowAllJobs(false)}
              >
                Unscheduled ({unscheduledJobs.length})
              </button>
              <button
                type="button"
                className={`px-3 py-2 min-h-[44px] rounded-md text-sm font-medium transition-colors ${showAllJobs ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                onClick={() => setShowAllJobs(true)}
              >
                All Jobs ({jobs.length})
              </button>
            </div>
          </div>

          <div className="border rounded-md overflow-auto flex-1 min-h-[150px] max-h-[200px]">
            {filteredJobs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No jobs found
              </div>
            ) : (
              <div className="divide-y">
                {filteredJobs.map(job => {
                  const customerName = getCustomerName(job.customerId);
                  const isSelected = selectedJobId === job.id;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      className={`w-full text-left p-3 min-h-[56px] hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                      onClick={() => setSelectedJobId(job.id)}
                      data-testid={`select-job-${job.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{job.title || 'Untitled Job'}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {job.address || 'No address'}
                          </p>
                        </div>
                        {job.scheduledDate && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {safeFormatDate(job.scheduledDate, 'MMM d')}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedJob && (
            <>
              <div className="space-y-2">
                <Label>Assign Crew Members</Label>
                <div className="flex flex-wrap gap-2">
                  {crewMembers.map(member => {
                    const isSelected = selectedCrewMembers.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleCrewMember(member.id)}
                        className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full text-sm transition-all ${
                          isSelected
                            ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                        data-testid={`assign-crew-${member.id}`}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: member.color || '#3b82f6' }}
                        />
                        <span>{member.name}</span>
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Time (optional)</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-11 text-base"
                  data-testid="input-scheduled-time"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedJobId || isSubmitting}
            className="h-11 w-full sm:w-auto"
            data-testid="button-schedule-job"
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
