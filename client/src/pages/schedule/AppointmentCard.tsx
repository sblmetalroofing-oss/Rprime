import { useRef, useEffect } from "react";
import { Clock, MapPin } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Job, CrewMember, Customer, Appointment } from "@shared/schema";
import { jobCardClickedRecently, setJobCardClickedRecently } from "./JobCard";

export function AppointmentCard({ 
  appointment, 
  crewMembers,
  jobs = [],
  customers = [],
  onClick,
  compact = false
}: { 
  appointment: Appointment; 
  crewMembers: CrewMember[];
  jobs?: Job[];
  customers?: Customer[];
  onClick: () => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `appt-${appointment.id}`,
    data: { appointment }
  });
  
  const wasDraggingRef = useRef(false);
  
  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
    }
  }, [isDragging]);
  
  const linkedJob = appointment.jobId ? jobs.find(j => j.id === appointment.jobId) : null;
  const linkedCustomer = linkedJob?.customerId ? customers.find(c => c.id === linkedJob.customerId) : null;
  
  const assignedToIds = appointment.assignedTo?.length ? appointment.assignedTo : (linkedJob?.assignedTo || []);
  const assignedCrewColors = assignedToIds
    .map(id => crewMembers.find(m => m.id === id || m.name === id)?.color)
    .filter(Boolean) as string[];
  
  const primaryColor = assignedCrewColors.length > 0 ? assignedCrewColors[0] : '#9ca3af';
  
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'none',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    setJobCardClickedRecently(true);
    setTimeout(() => { setJobCardClickedRecently(false); }, 300);
    onClick();
  };

  const jobNumber = linkedJob ? (linkedJob.referenceNumber || `#${linkedJob.id.slice(-8).toUpperCase()}`) : null;
  const displayName = linkedJob 
    ? (linkedCustomer?.name || linkedJob.title || 'No Customer')
    : appointment.title;
  const address = linkedJob?.address || appointment.location;
  
  if (compact) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="group relative flex rounded text-xs cursor-grab bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow min-h-[36px] overflow-hidden"
        onClick={handleClick}
        data-testid={`appointment-card-${appointment.id}`}
      >
        <div className="flex flex-col w-1 shrink-0">
          {assignedCrewColors.length > 0 ? (
            assignedCrewColors.map((color, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: color }} />
            ))
          ) : (
            <div className="flex-1" style={{ backgroundColor: primaryColor }} />
          )}
        </div>
        <div className="px-3 py-2 flex-1 truncate">
          {linkedJob ? (
            <>
              <span className="font-mono font-medium text-muted-foreground">{jobNumber}</span>
              <span className="mx-1.5">·</span>
              <span className="font-medium">{displayName}</span>
            </>
          ) : (
            <span className="font-medium">{displayName}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative flex rounded bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow cursor-grab min-h-[48px] overflow-hidden"
      onClick={handleClick}
      data-testid={`appointment-card-${appointment.id}`}
    >
      <div className="flex flex-col w-1 shrink-0">
        {assignedCrewColors.length > 0 ? (
          assignedCrewColors.map((color, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: color }} />
          ))
        ) : (
          <div className="flex-1" style={{ backgroundColor: primaryColor }} />
        )}
      </div>
      <div className="p-3 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {linkedJob ? (
                <>
                  <span className="font-mono text-muted-foreground">{jobNumber}</span>
                  <span className="mx-1">·</span>
                  {displayName}
                </>
              ) : (
                displayName
              )}
            </p>
            {appointment.scheduledTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                <span>{appointment.scheduledTime}{appointment.endTime && ` - ${appointment.endTime}`}</span>
              </div>
            )}
            {address && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {address}
              </p>
            )}
            {appointment.description && (
              <p className="text-xs text-muted-foreground truncate italic mt-0.5">
                {appointment.description}
              </p>
            )}
          </div>
          <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: primaryColor }} />
        </div>
      </div>
    </div>
  );
}
