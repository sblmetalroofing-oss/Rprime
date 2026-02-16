import { useRef, useEffect } from "react";
import { Clock, MapPin } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Job, CrewMember, Customer } from "@shared/schema";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-gray-400",
  on_hold: "bg-orange-500"
};

export let jobCardClickedRecently = false;

export function setJobCardClickedRecently(value: boolean) {
  jobCardClickedRecently = value;
}

export function JobCard({ 
  job, 
  onClick, 
  customer,
  crewMembers = [],
  compact = false
}: { 
  job: Job; 
  onClick: () => void; 
  customer?: Customer;
  crewMembers?: CrewMember[];
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job }
  });
  
  const wasDraggingRef = useRef(false);
  
  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
    }
  }, [isDragging]);
  
  const assignedCrewColors = (job.assignedTo || [])
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

  const jobNumber = job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;
  const displayName = customer?.name || job.title || 'No Customer';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    jobCardClickedRecently = true;
    setTimeout(() => { jobCardClickedRecently = false; }, 300);
    onClick();
  };

  if (compact) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group relative flex rounded text-xs cursor-grab bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow min-h-[36px] overflow-hidden`}
        onClick={handleClick}
        data-testid={`job-card-${job.id}`}
      >
        <div className="flex flex-col w-1 shrink-0">
          {assignedCrewColors.length > 0 ? (
            assignedCrewColors.map((color, i) => (
              <div 
                key={i} 
                className="flex-1" 
                style={{ backgroundColor: color }}
              />
            ))
          ) : (
            <div className="flex-1" style={{ backgroundColor: primaryColor }} />
          )}
        </div>
        <div className="px-3 py-2 flex-1 truncate">
          <span className="font-mono font-medium text-muted-foreground">{jobNumber}</span>
          <span className="mx-1.5">·</span>
          <span className="font-medium">{displayName}</span>
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
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex flex-col w-1 shrink-0">
        {assignedCrewColors.length > 0 ? (
          assignedCrewColors.map((color, i) => (
            <div 
              key={i} 
              className="flex-1" 
              style={{ backgroundColor: color }}
            />
          ))
        ) : (
          <div className="flex-1" style={{ backgroundColor: primaryColor }} />
        )}
      </div>
      <div className="p-3 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              <span className="font-mono text-muted-foreground">{jobNumber}</span>
              <span className="mx-1">·</span>
              {displayName}
            </p>
            {job.scheduledTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                <span>{job.scheduledTime}</span>
              </div>
            )}
            {job.address && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {job.address}
              </p>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full mt-1 ${statusColors[job.status]}`} />
        </div>
      </div>
    </div>
  );
}
