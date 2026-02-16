import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  List,
  LayoutGrid,
  User,
  Check,
  Edit2,
  X,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  ExternalLink,
  Phone,
  Trash2,
  Send,
  MessageSquare,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { FeatureGate } from "@/components/feature-gate";
import { fetchJobs, updateJob, fetchCrewMembers, fetchCustomers, fetchJobActivities, createJobActivity, type JobActivity, fetchAppointments, createAppointment, updateAppointment, deleteAppointment } from "@/lib/api";
import type { Job, CrewMember, Customer, Appointment, InsertAppointment } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks, isToday as isDateToday, getDay } from "date-fns";
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { JobCard, jobCardClickedRecently } from "./schedule/JobCard";
import { AppointmentCard } from "./schedule/AppointmentCard";
import { ScheduleJobDialog } from "./schedule/ScheduleJobDialog";
import { EditAppointmentDialog } from "./schedule/EditAppointmentDialog";
import { AppointmentFormDialog } from "./schedule/AppointmentFormDialog";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-gray-400",
  on_hold: "bg-orange-500"
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold"
};

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

type ViewType = 'week' | 'day' | 'list';

type DayWeather = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
};

const weatherIcons: Record<number, { icon: typeof Sun; label: string }> = {
  0: { icon: Sun, label: 'Clear' },
  1: { icon: Sun, label: 'Mainly Clear' },
  2: { icon: Cloud, label: 'Partly Cloudy' },
  3: { icon: Cloud, label: 'Overcast' },
  45: { icon: CloudFog, label: 'Foggy' },
  48: { icon: CloudFog, label: 'Foggy' },
  51: { icon: CloudDrizzle, label: 'Light Drizzle' },
  53: { icon: CloudDrizzle, label: 'Drizzle' },
  55: { icon: CloudDrizzle, label: 'Heavy Drizzle' },
  61: { icon: CloudRain, label: 'Light Rain' },
  63: { icon: CloudRain, label: 'Rain' },
  65: { icon: CloudRain, label: 'Heavy Rain' },
  71: { icon: CloudSnow, label: 'Light Snow' },
  73: { icon: CloudSnow, label: 'Snow' },
  75: { icon: CloudSnow, label: 'Heavy Snow' },
  80: { icon: CloudRain, label: 'Rain Showers' },
  81: { icon: CloudRain, label: 'Rain Showers' },
  82: { icon: CloudRain, label: 'Heavy Showers' },
  95: { icon: CloudLightning, label: 'Thunderstorm' },
  96: { icon: CloudLightning, label: 'Thunderstorm' },
  99: { icon: CloudLightning, label: 'Thunderstorm' },
};

function getWeatherIcon(code: number) {
  return weatherIcons[code] || weatherIcons[0];
}

function getCrewColor(member: CrewMember | undefined): string {
  if (member?.color) return member.color;
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  return colors[0];
}

function DraggableJob({ 
  job, 
  children,
  className = "",
  style: extraStyle = {}
}: { 
  job: Job; 
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job }
  });
  
  const style: React.CSSProperties = {
    ...extraStyle,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'none',
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// Draggable Day Appointment Component for Day Timeline View
function DraggableDayAppointment({
  appointment,
  topOffset,
  height,
  crewColors,
  primaryColor,
  isJobLinked,
  jobNumber,
  displayName,
  linkedJob,
  onClick,
  width = 100,
  left = 0
}: {
  appointment: Appointment;
  topOffset: number;
  height: number;
  crewColors: string[];
  primaryColor: string;
  isJobLinked: boolean;
  jobNumber: string | null;
  displayName: string;
  linkedJob: Job | null | undefined;
  onClick: () => void;
  width?: number;
  left?: number;
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    onClick();
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    top: topOffset + 2,
    height,
    left: `calc(${left}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    zIndex: isDragging ? 100 : 5,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.7 : 1,
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="pointer-events-auto cursor-grab rounded-md overflow-hidden shadow-sm bg-white dark:bg-slate-800 flex select-none"
      style={style}
      onClick={handleClick}
      data-testid={`day-appointment-${appointment.id}`}
    >
      <div className="flex flex-col w-1 shrink-0">
        {crewColors.length > 0 ? (
          crewColors.map((color, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: color }} />
          ))
        ) : (
          <div className="flex-1" style={{ backgroundColor: primaryColor }} />
        )}
      </div>
      <div className="p-2 h-full flex flex-col flex-1 min-w-0">
        <div className="font-medium text-xs truncate">
          {isJobLinked ? (
            <>
              <span className="font-mono text-muted-foreground">{jobNumber}</span>
              <span className="mx-1">·</span>
              {displayName}
            </>
          ) : (
            displayName
          )}
        </div>
        {height > 40 && (linkedJob?.address || appointment.location) && (
          <div className="text-[10px] text-muted-foreground truncate">{linkedJob?.address || appointment.location}</div>
        )}
        {height > 50 && appointment.description && (
          <div className="text-[10px] text-muted-foreground truncate italic">{appointment.description}</div>
        )}
        {height > 70 && (
          <div className="text-[10px] text-muted-foreground mt-auto">
            {appointment.scheduledTime}{appointment.endTime ? ` - ${appointment.endTime}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableCell({ 
  id, 
  children, 
  onClick,
  isToday = false,
  className = ""
}: { 
  id: string; 
  children: React.ReactNode; 
  onClick?: () => void;
  isToday?: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleClick = (e: React.MouseEvent) => {
    // Check if click was on a job card
    const target = e.target as HTMLElement;
    const isJobCard = target.closest('[data-testid^="job-card-"]');
    if (isJobCard) {
      return;
    }
    
    // Add delay to let job card clicks register first
    setTimeout(() => {
      if (!jobCardClickedRecently) {
        onClick?.();
      }
    }, 150);
  };

  return (
    <div 
      ref={setNodeRef}
      onClick={handleClick}
      data-testid={`schedule-cell-${id}`}
      className={`min-h-[80px] p-1 border-r border-b transition-colors bg-white dark:bg-slate-900 ${
        isOver ? 'bg-blue-100 dark:bg-blue-900/50' : ''
      } ${
        onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

function StaffPill({ 
  member, 
  isActive, 
  onClick 
}: { 
  member: CrewMember; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        isActive 
          ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md' 
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
      data-testid={`staff-filter-${member.id}`}
    >
      <div 
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: member.color || '#3b82f6' }}
      />
      <span>{member.name.split(' ')[0]}</span>
      {isActive && <Check className="h-3 w-3" />}
    </button>
  );
}

function StaffTimelineView({ 
  weekStart,
  jobs, 
  crewMembers, 
  customers,
  activeStaff,
  onJobClick,
  onCellClick,
  onEditJob,
  showWeekends,
  appointments = [],
  onAppointmentClick,
  scheduleType = 'all'
}: { 
  weekStart: Date;
  jobs: Job[];
  crewMembers: CrewMember[];
  customers: Customer[];
  activeStaff: string[];
  onJobClick: (id: string) => void;
  onCellClick: (date: string, crewId: string) => void;
  onEditJob: (job: Job) => void;
  showWeekends: boolean;
  appointments?: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  scheduleType?: 'jobs' | 'appointments' | 'all';
}) {
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = showWeekends 
    ? allDays 
    : allDays.filter(d => {
        const dow = getDay(d);
        return dow !== 0 && dow !== 6;
      });

  const displayedCrew = crewMembers.filter(m => activeStaff.includes(m.id));
  const unassignedRow = { id: 'unassigned', name: 'Unassigned', color: '#9ca3af' };

  const getJobsForCell = (crewId: string, date: Date) => {
    if (scheduleType === 'appointments') return []; // Only show appointments
    return jobs.filter(job => {
      if (!job.scheduledDate) return false;
      try {
        const jobDate = parseISO(job.scheduledDate);
        if (!isSameDay(jobDate, date)) return false;
        
        if (crewId === 'unassigned') {
          return !job.assignedTo || job.assignedTo.length === 0;
        }
        return job.assignedTo?.includes(crewId);
      } catch {
        return false;
      }
    });
  };

  const getAppointmentsForCell = (crewId: string, date: Date) => {
    if (scheduleType === 'jobs') return []; // Only show jobs
    return appointments.filter(appt => {
      if (!appt.scheduledDate) return false;
      try {
        const apptDate = parseISO(appt.scheduledDate);
        if (!isSameDay(apptDate, date)) return false;
        
        if (crewId === 'unassigned') {
          return !appt.assignedTo || appt.assignedTo.length === 0;
        }
        return appt.assignedTo?.includes(crewId);
      } catch {
        return false;
      }
    });
  };

  const getCustomer = (customerId?: string | null) => {
    if (!customerId) return undefined;
    return customers.find(c => c.id === customerId);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${days.length * 150 + 150}px` }}>
          <div className="flex border-b bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
            <div className="w-[150px] shrink-0 p-3 font-medium border-r flex items-center gap-2">
              <Users className="h-4 w-4" />
              Staff
            </div>
            {days.map((day, i) => {
              const isToday = isDateToday(day);
              return (
                <div 
                  key={i} 
                  className={`flex-1 min-w-[150px] p-3 text-center border-r ${
                    isToday ? 'bg-blue-100 dark:bg-blue-900/50 font-bold text-blue-700 dark:text-blue-300' : ''
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                </div>
              );
            })}
          </div>

          {displayedCrew.map(member => (
            <div key={member.id} className="flex border-b last:border-b-0">
              <div 
                className="w-[150px] shrink-0 p-3 border-r flex items-center gap-2 bg-slate-50 dark:bg-slate-800"
              >
                <div 
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: member.color || '#3b82f6' }}
                />
                <span className="font-medium text-sm truncate">{member.name}</span>
              </div>
              {days.map((day, i) => {
                const cellJobs = getJobsForCell(member.id, day);
                const cellAppointments = getAppointmentsForCell(member.id, day);
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = isDateToday(day);
                
                return (
                  <DroppableCell 
                    key={i} 
                    id={`${member.id}::${dateStr}`}
                    isToday={isToday}
                    onClick={() => onCellClick(dateStr, member.id)}
                    className="flex-1 min-w-[150px]"
                  >
                    <div className="space-y-1">
                      {cellJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          customer={getCustomer(job.customerId)}
                          crewMembers={crewMembers}
                          onClick={() => onEditJob(job)}
                          compact
                        />
                      ))}
                      {cellAppointments.map(appt => (
                        <AppointmentCard
                          key={appt.id}
                          appointment={appt}
                          crewMembers={crewMembers}
                          jobs={jobs}
                          customers={customers}
                          onClick={() => onAppointmentClick?.(appt)}
                          compact
                        />
                      ))}
                    </div>
                  </DroppableCell>
                );
              })}
            </div>
          ))}

          <div className="flex border-b last:border-b-0">
            <div 
              className="w-[150px] shrink-0 p-3 border-r flex items-center gap-2 bg-slate-50 dark:bg-slate-800"
            >
              <div className="w-3 h-3 rounded-full shrink-0 bg-gray-400" />
              <span className="font-medium text-sm text-muted-foreground">Unassigned</span>
            </div>
            {days.map((day, i) => {
              const cellJobs = getJobsForCell('unassigned', day);
              const cellAppointments = getAppointmentsForCell('unassigned', day);
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = isDateToday(day);
              
              return (
                <DroppableCell 
                  key={i} 
                  id={`unassigned::${dateStr}`}
                  isToday={isToday}
                  onClick={() => onCellClick(dateStr, '')}
                  className="flex-1 min-w-[150px]"
                >
                  <div className="space-y-1">
                    {cellJobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        customer={getCustomer(job.customerId)}
                        onClick={() => onEditJob(job)}
                        compact
                      />
                    ))}
                    {cellAppointments.map(appt => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        crewMembers={crewMembers}
                        jobs={jobs}
                        customers={customers}
                        onClick={() => onAppointmentClick?.(appt)}
                        compact
                      />
                    ))}
                  </div>
                </DroppableCell>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekGridView({ 
  weekStart,
  jobs, 
  crewMembers,
  customers,
  onCellClick,
  onEditJob,
  showWeekends,
  getWeatherForDate,
  appointments = [],
  onAppointmentClick,
  scheduleType = 'all'
}: { 
  weekStart: Date;
  jobs: Job[];
  crewMembers: CrewMember[];
  customers: Customer[];
  onCellClick: (date: string) => void;
  onEditJob: (job: Job) => void;
  showWeekends: boolean;
  getWeatherForDate: (date: Date) => DayWeather | undefined;
  appointments?: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  scheduleType?: 'jobs' | 'appointments' | 'all';
}) {
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = showWeekends 
    ? allDays 
    : allDays.filter(d => {
        const dow = getDay(d);
        return dow !== 0 && dow !== 6;
      });

  const getJobsForDate = (date: Date) => {
    if (scheduleType === 'appointments') return []; // Only show appointments
    return jobs.filter(job => {
      if (!job.scheduledDate) return false;
      try {
        return isSameDay(parseISO(job.scheduledDate), date);
      } catch {
        return false;
      }
    });
  };

  const getAppointmentsForDate = (date: Date) => {
    if (scheduleType === 'jobs') return []; // Only show jobs
    return appointments.filter(appt => {
      if (!appt.scheduledDate) return false;
      try {
        return isSameDay(parseISO(appt.scheduledDate), date);
      } catch {
        return false;
      }
    });
  };

  const getCustomer = (customerId?: string | null) => {
    if (!customerId) return undefined;
    return customers.find(c => c.id === customerId);
  };

  const getCrewMember = (job: Job) => {
    if (!job.assignedTo || job.assignedTo.length === 0) return undefined;
    const assigned = job.assignedTo[0];
    return crewMembers.find(m => m.id === assigned || m.name === assigned);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
        {days.map((day, i) => {
          const isToday = isDateToday(day);
          const weather = getWeatherForDate(day);
          const weatherInfo = weather ? getWeatherIcon(weather.weatherCode) : null;
          const WeatherIcon = weatherInfo?.icon;
          return (
            <div 
              key={i} 
              className={`p-2 text-center border-b border-r last:border-r-0 ${
                isToday ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-50 dark:bg-slate-800'
              }`}
            >
              <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
              <div className={`text-xl ${isToday ? 'text-blue-700 dark:text-blue-300 font-bold' : ''}`}>
                {format(day, 'd')}
              </div>
              {weather && WeatherIcon && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <WeatherIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{weather.tempMax}°</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} min-h-[400px]`}>
        {days.map((day, i) => {
          const dayJobs = getJobsForDate(day);
          const dayAppointments = getAppointmentsForDate(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = isDateToday(day);
          
          return (
            <DroppableCell 
              key={i} 
              id={dateStr}
              isToday={isToday}
              onClick={() => onCellClick(dateStr)}
              className="border-r last:border-r-0"
            >
              <div className="space-y-1">
                {dayJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    customer={getCustomer(job.customerId)}
                    crewMembers={crewMembers}
                    onClick={() => onEditJob(job)}
                  />
                ))}
                {dayAppointments.map(appt => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    crewMembers={crewMembers}
                    jobs={jobs}
                    customers={customers}
                    onClick={() => onAppointmentClick?.(appt)}
                  />
                ))}
              </div>
            </DroppableCell>
          );
        })}
      </div>
    </div>
  );
}

function DayTimelineView({ 
  selectedDate,
  jobs, 
  crewMembers,
  customers,
  onEditJob,
  onCellClick,
  appointments = [],
  onAppointmentClick,
  scheduleType = 'all'
}: { 
  selectedDate: Date;
  jobs: Job[];
  crewMembers: CrewMember[];
  customers: Customer[];
  onEditJob: (job: Job) => void;
  onCellClick: (date: string, time?: string) => void;
  appointments?: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  scheduleType?: 'jobs' | 'appointments' | 'all';
}) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 6);
  const now = new Date();
  const isToday = isDateToday(selectedDate);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const HOUR_HEIGHT = 60; // pixels per hour

  const getCustomer = (customerId?: string | null) => {
    if (!customerId) return undefined;
    return customers.find(c => c.id === customerId);
  };
  
  // Filter appointments for the selected date
  const dayAppointments = scheduleType === 'jobs' ? [] : appointments.filter(appt => {
    if (!appt.scheduledDate) return false;
    try {
      return isSameDay(parseISO(appt.scheduledDate), selectedDate);
    } catch {
      return false;
    }
  });

  const getCrewColors = (job: Job) => {
    if (!job.assignedTo || job.assignedTo.length === 0) return ['#3b82f6'];
    const colors = job.assignedTo.map(assigned => {
      const member = crewMembers.find(m => m.id === assigned || m.name === assigned);
      return member?.color || '#3b82f6';
    }).filter(Boolean);
    return colors.length > 0 ? colors : ['#3b82f6'];
  };

  const dayJobs = scheduleType === 'appointments' ? [] : jobs.filter(job => {
    if (!job.scheduledDate) return false;
    try {
      return isSameDay(parseISO(job.scheduledDate), selectedDate);
    } catch {
      return false;
    }
  });

  const untimedJobs = dayJobs.filter(j => !j.scheduledTime);
  const timedJobs = dayJobs.filter(j => j.scheduledTime);
  const untimedAppointments = dayAppointments.filter(a => !a.scheduledTime);
  const timedAppointments = dayAppointments.filter(a => a.scheduledTime);

  const getJobTimeRange = (job: Job) => {
    if (!job.scheduledTime) return null;
    const [hourStr, minStr] = job.scheduledTime.split(':');
    const startHour = parseInt(hourStr, 10);
    const startMinute = parseInt(minStr || '0', 10);
    const duration = job.estimatedDuration || 1;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = startMinutes + duration * 60;
    return { startMinutes, endMinutes };
  };

  // Calculate overlap columns for each job using sweep-line algorithm
  const getJobColumns = (jobs: Job[]) => {
    const jobRanges = jobs.map(job => ({
      job,
      range: getJobTimeRange(job)
    })).filter(j => j.range !== null) as { job: Job; range: { startMinutes: number; endMinutes: number } }[];

    const columns: Map<string, { columnIndex: number; totalColumns: number }> = new Map();

    if (jobRanges.length === 0) return columns;

    // Sort by start time
    jobRanges.sort((a, b) => a.range.startMinutes - b.range.startMinutes);

    // Assign columns using greedy algorithm - reuse columns when jobs don't overlap
    const columnEndTimes: number[] = []; // Track when each column becomes free
    const jobColumnAssignments: Map<string, number> = new Map();

    for (const jr of jobRanges) {
      // Find the first available column (one that's free by this job's start time)
      let assignedColumn = -1;
      for (let col = 0; col < columnEndTimes.length; col++) {
        if (columnEndTimes[col] <= jr.range.startMinutes) {
          assignedColumn = col;
          columnEndTimes[col] = jr.range.endMinutes;
          break;
        }
      }
      
      // If no column available, create a new one
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(jr.range.endMinutes);
      }
      
      jobColumnAssignments.set(jr.job.id, assignedColumn);
    }

    // Now find overlapping groups and calculate max concurrent for each group
    // Use half-open intervals [start, end) - jobs touching at boundaries don't overlap
    const groups: typeof jobRanges[] = [];
    
    for (const jr of jobRanges) {
      let addedToGroup = false;
      
      for (const group of groups) {
        // Half-open interval overlap: a.start < b.end && b.start < a.end
        const overlaps = group.some(existing => 
          existing.range.startMinutes < jr.range.endMinutes && 
          jr.range.startMinutes < existing.range.endMinutes
        );
        
        if (overlaps) {
          group.push(jr);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([jr]);
      }
    }

    // Merge overlapping groups
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const hasOverlap = groups[i].some(a => 
            groups[j].some(b => 
              a.range.startMinutes < b.range.endMinutes && 
              b.range.startMinutes < a.range.endMinutes
            )
          );
          
          if (hasOverlap) {
            groups[i] = [...groups[i], ...groups[j]];
            groups.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }

    // For each group, calculate max concurrent overlaps per job using sweep line
    for (const group of groups) {
      // Create events for sweep line
      const events: { time: number; type: 'start' | 'end'; jobId: string }[] = [];
      for (const jr of group) {
        events.push({ time: jr.range.startMinutes, type: 'start', jobId: jr.job.id });
        events.push({ time: jr.range.endMinutes, type: 'end', jobId: jr.job.id });
      }
      
      // Sort: by time, ends before starts at same time (half-open intervals [start, end))
      events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.type === 'end' ? -1 : 1;
      });
      
      // Track max concurrent for each active job individually
      const jobMaxConcurrent: Map<string, number> = new Map();
      const activeJobs: Set<string> = new Set();
      
      for (const event of events) {
        if (event.type === 'start') {
          activeJobs.add(event.jobId);
          // Update max for all currently active jobs
          const currentCount = activeJobs.size;
          for (const activeJobId of activeJobs) {
            const prev = jobMaxConcurrent.get(activeJobId) || 1;
            jobMaxConcurrent.set(activeJobId, Math.max(prev, currentCount));
          }
        } else {
          activeJobs.delete(event.jobId);
        }
      }
      
      // Assign to all jobs in group with their individual max concurrent
      for (const jr of group) {
        const columnIndex = jobColumnAssignments.get(jr.job.id) || 0;
        const totalColumns = jobMaxConcurrent.get(jr.job.id) || 1;
        columns.set(jr.job.id, { columnIndex, totalColumns });
      }
    }

    return columns;
  };

  const jobColumns = getJobColumns(timedJobs);

  // Calculate overlap columns for appointments using same algorithm
  const getAppointmentColumns = (appointments: Appointment[]) => {
    const getApptTimeRange = (appt: Appointment) => {
      if (!appt.scheduledTime) return null;
      const [hourStr, minStr] = appt.scheduledTime.split(':');
      const startHour = parseInt(hourStr, 10);
      const startMinute = parseInt(minStr || '0', 10);
      
      let endHour = startHour + 1;
      let endMinute = startMinute;
      if (appt.endTime) {
        const [endHourStr, endMinStr] = appt.endTime.split(':');
        endHour = parseInt(endHourStr, 10);
        endMinute = parseInt(endMinStr || '0', 10);
      }
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      return { startMinutes, endMinutes };
    };

    const apptRanges = appointments.map(appt => ({
      appt,
      range: getApptTimeRange(appt)
    })).filter(a => a.range !== null) as { appt: Appointment; range: { startMinutes: number; endMinutes: number } }[];

    const columns: Map<string, { columnIndex: number; totalColumns: number }> = new Map();

    if (apptRanges.length === 0) return columns;

    apptRanges.sort((a, b) => a.range.startMinutes - b.range.startMinutes);

    const columnEndTimes: number[] = [];
    const apptColumnAssignments: Map<string, number> = new Map();

    for (const ar of apptRanges) {
      let assignedColumn = -1;
      for (let col = 0; col < columnEndTimes.length; col++) {
        if (columnEndTimes[col] <= ar.range.startMinutes) {
          assignedColumn = col;
          columnEndTimes[col] = ar.range.endMinutes;
          break;
        }
      }
      
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(ar.range.endMinutes);
      }
      
      apptColumnAssignments.set(ar.appt.id, assignedColumn);
    }

    const groups: typeof apptRanges[] = [];
    
    for (const ar of apptRanges) {
      let addedToGroup = false;
      
      for (const group of groups) {
        const overlaps = group.some(existing => 
          existing.range.startMinutes < ar.range.endMinutes && 
          ar.range.startMinutes < existing.range.endMinutes
        );
        
        if (overlaps) {
          group.push(ar);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([ar]);
      }
    }

    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const hasOverlap = groups[i].some(a => 
            groups[j].some(b => 
              a.range.startMinutes < b.range.endMinutes && 
              b.range.startMinutes < a.range.endMinutes
            )
          );
          
          if (hasOverlap) {
            groups[i] = [...groups[i], ...groups[j]];
            groups.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }

    for (const group of groups) {
      const events: { time: number; type: 'start' | 'end'; apptId: string }[] = [];
      for (const ar of group) {
        events.push({ time: ar.range.startMinutes, type: 'start', apptId: ar.appt.id });
        events.push({ time: ar.range.endMinutes, type: 'end', apptId: ar.appt.id });
      }
      
      events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.type === 'end' ? -1 : 1;
      });
      
      const apptMaxConcurrent: Map<string, number> = new Map();
      const activeAppts: Set<string> = new Set();
      
      for (const event of events) {
        if (event.type === 'start') {
          activeAppts.add(event.apptId);
          const currentCount = activeAppts.size;
          for (const activeApptId of activeAppts) {
            const prev = apptMaxConcurrent.get(activeApptId) || 1;
            apptMaxConcurrent.set(activeApptId, Math.max(prev, currentCount));
          }
        } else {
          activeAppts.delete(event.apptId);
        }
      }
      
      for (const ar of group) {
        const columnIndex = apptColumnAssignments.get(ar.appt.id) || 0;
        const totalColumns = apptMaxConcurrent.get(ar.appt.id) || 1;
        columns.set(ar.appt.id, { columnIndex, totalColumns });
      }
    }

    return columns;
  };

  const appointmentColumns = getAppointmentColumns(timedAppointments);

  const getJobPosition = (job: Job) => {
    if (!job.scheduledTime) return null;
    const [hourStr, minStr] = job.scheduledTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr || '0', 10);
    const duration = job.estimatedDuration || 1; // default 1 hour
    
    const topOffset = (hour - 6) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
    const height = Math.max(duration * HOUR_HEIGHT - 4, 30); // min 30px, -4 for gap
    
    const columnInfo = jobColumns.get(job.id) || { columnIndex: 0, totalColumns: 1 };
    const width = 100 / columnInfo.totalColumns;
    const left = columnInfo.columnIndex * width;
    
    return { top: topOffset, height, width, left };
  };

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
      {(untimedJobs.length > 0 || untimedAppointments.length > 0) && (
        <div className="p-3 border-b bg-slate-50 dark:bg-slate-800">
          <div className="text-xs font-medium text-muted-foreground mb-2">All Day / No Time Set</div>
          <div className="flex flex-wrap gap-2">
            {untimedJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                customer={getCustomer(job.customerId)}
                crewMembers={crewMembers}
                onClick={() => onEditJob(job)}
                compact
              />
            ))}
            {untimedAppointments.map(appt => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                crewMembers={crewMembers}
                jobs={jobs}
                customers={customers}
                onClick={() => onAppointmentClick?.(appt)}
                compact
              />
            ))}
          </div>
        </div>
      )}
      
      <div className="relative flex">
        {/* Time labels column */}
        <div className="w-12 sm:w-16 shrink-0 bg-slate-50 dark:bg-slate-800 border-r">
          {hours.map(hour => (
            <div key={hour} className="h-[60px] text-[10px] sm:text-xs text-muted-foreground py-2 px-1 sm:px-3 text-right border-b last:border-b-0">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>
          ))}
        </div>
        
        {/* Timeline area with drop zones and jobs */}
        <div className="flex-1 relative" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Current time indicator */}
          {isToday && currentHour >= 6 && currentHour < 18 && (
            <div 
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ top: (currentHour - 6) * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT }}
            >
              <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
            </div>
          )}
          
          {/* Hour slots (drop zones) */}
          {hours.map(hour => {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            const dropId = `${dateStr}::${timeStr}`;
            
            return (
              <div 
                key={hour} 
                className="absolute left-0 right-0 border-b"
                style={{ top: (hour - 6) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <DroppableCell
                  id={dropId}
                  isToday={isToday}
                  onClick={() => onCellClick(dateStr, timeStr)}
                  className="h-full w-full"
                >
                  <span />
                </DroppableCell>
              </div>
            );
          })}
          
          {/* Positioned job cards */}
          <div className="absolute inset-0 pointer-events-none">
            {timedJobs.map(job => {
              const pos = getJobPosition(job);
              if (!pos) return null;
              const colors = getCrewColors(job);
              const jobNumber = job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;
              const stripeWidth = Math.max(4, Math.floor(16 / colors.length));
              
              return (
                <DraggableJob 
                  key={job.id} 
                  job={job}
                  className="absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-md overflow-hidden shadow-sm border bg-slate-800 flex"
                  style={{
                    top: pos.top + 2,
                    height: pos.height,
                    left: `calc(${pos.left}% + 4px)`,
                    width: `calc(${pos.width}% - 8px)`,
                  }}
                >
                  <div
                    className="flex h-full w-full"
                    onClick={() => onEditJob(job)}
                    data-testid={`day-job-${job.id}`}
                  >
                    {/* Color stripes on left */}
                    <div className="flex shrink-0">
                      {colors.map((color, i) => (
                        <div 
                          key={i}
                          className="h-full"
                          style={{ backgroundColor: color, width: stripeWidth }}
                        />
                      ))}
                    </div>
                    {/* Content */}
                    <div className="p-2 text-white h-full flex flex-col flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{jobNumber} • {job.title || 'Untitled'}</div>
                      {pos.height > 40 && (
                        <div className="text-[10px] opacity-90 truncate">{job.address}</div>
                      )}
                      {pos.height > 60 && job.scheduledTime && (
                        <div className="text-[10px] opacity-75 mt-auto">
                          {job.scheduledTime}{job.estimatedDuration ? ` (${job.estimatedDuration}h)` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </DraggableJob>
              );
            })}
            {/* Positioned appointment cards */}
            {timedAppointments.map(appt => {
              if (!appt.scheduledTime) return null;
              const [hourStr, minStr] = appt.scheduledTime.split(':');
              const startHour = parseInt(hourStr, 10);
              const startMinute = parseInt(minStr || '0', 10);
              
              let endHour = startHour + 1;
              let endMinute = startMinute;
              if (appt.endTime) {
                const [endHourStr, endMinStr] = appt.endTime.split(':');
                endHour = parseInt(endHourStr, 10);
                endMinute = parseInt(endMinStr || '0', 10);
              }
              
              const duration = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
              const topOffset = (startHour - 6) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
              const height = Math.max(duration * HOUR_HEIGHT - 4, 30);
              
              // Find linked job for job-linked appointments
              const linkedJob = appt.jobId ? jobs.find(j => j.id === appt.jobId) : null;
              const linkedCustomer = linkedJob?.customerId ? customers.find(c => c.id === linkedJob.customerId) : null;
              const isJobLinked = !!linkedJob;
              
              // Get crew colors for the color bar - use appointment's assignedTo or fall back to job's
              const assignedToIds = appt.assignedTo?.length ? appt.assignedTo : (linkedJob?.assignedTo || []);
              const crewColors = assignedToIds
                .map(id => crewMembers.find(m => m.id === id || m.name === id)?.color)
                .filter(Boolean) as string[];
              const primaryColor = crewColors.length > 0 ? crewColors[0] : '#9ca3af'; // gray for unassigned
              
              // Format job number like JobCard
              const jobNumber = linkedJob ? (linkedJob.referenceNumber || `#${linkedJob.id.slice(-8).toUpperCase()}`) : null;
              const displayName = linkedJob 
                ? (linkedCustomer?.name || linkedJob.title || 'No Customer')
                : appt.title;
              
              // Get column info for width distribution
              const columnInfo = appointmentColumns.get(appt.id) || { columnIndex: 0, totalColumns: 1 };
              const colWidth = 100 / columnInfo.totalColumns;
              const colLeft = columnInfo.columnIndex * colWidth;
              
              return (
                <DraggableDayAppointment
                  key={appt.id}
                  appointment={appt}
                  topOffset={topOffset}
                  height={height}
                  crewColors={crewColors}
                  primaryColor={primaryColor}
                  isJobLinked={isJobLinked}
                  jobNumber={jobNumber}
                  displayName={displayName}
                  linkedJob={linkedJob}
                  onClick={() => onAppointmentClick?.(appt)}
                  width={colWidth}
                  left={colLeft}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListView({ 
  jobs, 
  crewMembers,
  customers,
  onEditJob,
  appointments = [],
  onAppointmentClick,
  scheduleType = 'all'
}: { 
  jobs: Job[];
  crewMembers: CrewMember[];
  customers: Customer[];
  onEditJob: (job: Job) => void;
  appointments?: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  scheduleType?: 'jobs' | 'appointments' | 'all';
}) {
  // Combine jobs and appointments into a unified list
  type ScheduleItem = { type: 'job'; data: Job } | { type: 'appointment'; data: Appointment };
  
  const items: ScheduleItem[] = [];
  
  // Add jobs if showing jobs or all
  if (scheduleType !== 'appointments') {
    jobs.forEach(job => items.push({ type: 'job', data: job }));
  }
  
  // Add appointments if showing appointments or all
  if (scheduleType !== 'jobs') {
    appointments.forEach(appt => items.push({ type: 'appointment', data: appt }));
  }
  
  // Sort by date and time
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.type === 'job' ? a.data.scheduledDate : a.data.scheduledDate;
    const dateB = b.type === 'job' ? b.data.scheduledDate : b.data.scheduledDate;
    const timeA = a.type === 'job' ? a.data.scheduledTime : a.data.scheduledTime;
    const timeB = b.type === 'job' ? b.data.scheduledTime : b.data.scheduledTime;
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1;
    if (!timeB) return -1;
    return timeA.localeCompare(timeB);
  });

  const getCustomer = (customerId?: string | null) => {
    if (!customerId) return undefined;
    return customers.find(c => c.id === customerId);
  };

  const getCrewMember = (assignedTo?: string[] | null) => {
    if (!assignedTo || assignedTo.length === 0) return undefined;
    const assigned = assignedTo[0];
    return crewMembers.find(m => m.id === assigned || m.name === assigned);
  };

  let currentDate = '';

  return (
    <div className="space-y-1">
      {sortedItems.map(item => {
        const itemDate = item.type === 'job' 
          ? item.data.scheduledDate || 'unscheduled'
          : item.data.scheduledDate || 'unscheduled';
        const showDateHeader = itemDate !== currentDate;
        currentDate = itemDate;
        
        if (item.type === 'job') {
          const job = item.data;
          const customer = getCustomer(job.customerId);
          const crew = getCrewMember(job.assignedTo);
          const jobNumber = job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;

          return (
            <div key={`job-${job.id}`}>
              {showDateHeader && (
                <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 py-2 px-3 font-medium text-sm border-b mt-4 first:mt-0 rounded-t">
                  {job.scheduledDate ? safeFormatDate(job.scheduledDate, 'EEEE, MMMM d, yyyy', 'Unscheduled') : 'Unscheduled'}
                </div>
              )}
              <div 
                className="p-3 bg-white dark:bg-slate-900 border-x border-b cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-4"
                onClick={() => onEditJob(job)}
                data-testid={`list-job-${job.id}`}
              >
                <div 
                  className="w-1 h-12 rounded-full shrink-0"
                  style={{ backgroundColor: crew?.color || '#9ca3af' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{jobNumber}</span>
                    {job.scheduledTime && (
                      <>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{job.scheduledTime}</span>
                      </>
                    )}
                  </div>
                  <p className="font-medium truncate">{customer?.name || job.title || 'No Customer'}</p>
                  {job.address && (
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {job.address}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {crew && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {crew.name.split(' ')[0]}
                    </div>
                  )}
                  <Badge className={`${statusColors[job.status]} text-white text-xs`}>
                    {statusLabels[job.status]}
                  </Badge>
                </div>
              </div>
            </div>
          );
        } else {
          // Appointment
          const appt = item.data;
          const crew = getCrewMember(appt.assignedTo);

          // Find linked job for job-linked appointments
          const linkedJob = appt.jobId ? jobs.find(j => j.id === appt.jobId) : null;
          const linkedCustomer = linkedJob?.customerId ? customers.find(c => c.id === linkedJob.customerId) : null;
          const isJobLinked = !!linkedJob;
          
          return (
            <div key={`appt-${appt.id}`}>
              {showDateHeader && (
                <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 py-2 px-3 font-medium text-sm border-b mt-4 first:mt-0 rounded-t">
                  {appt.scheduledDate ? safeFormatDate(appt.scheduledDate, 'EEEE, MMMM d, yyyy', 'Unscheduled') : 'Unscheduled'}
                </div>
              )}
              <div 
                className={`p-3 border-x border-b cursor-pointer transition-colors flex items-center gap-4 ${isJobLinked ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40' : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40'}`}
                onClick={() => onAppointmentClick?.(appt)}
                data-testid={`list-appointment-${appt.id}`}
              >
                <div 
                  className={`w-1 h-12 rounded-full shrink-0 ${isJobLinked ? 'bg-blue-500' : 'bg-purple-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 text-xs ${isJobLinked ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                    <Calendar className="h-3 w-3" />
                    <span>{isJobLinked ? 'Job Task' : 'Appointment'}</span>
                    {appt.scheduledTime && (
                      <>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{appt.scheduledTime}{appt.endTime ? ` - ${appt.endTime}` : ''}</span>
                      </>
                    )}
                  </div>
                  <p className={`font-medium truncate ${isJobLinked ? 'text-blue-900 dark:text-blue-100' : 'text-purple-900 dark:text-purple-100'}`}>{appt.title}</p>
                  {(linkedCustomer?.name || linkedJob?.address || appt.location) && (
                    <p className={`text-sm truncate flex items-center gap-1 ${isJobLinked ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                      <MapPin className="h-3 w-3 shrink-0" />
                      {linkedCustomer?.name || linkedJob?.address || appt.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {crew && (
                    <div className={`flex items-center gap-1 text-xs ${isJobLinked ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                      <User className="h-3 w-3" />
                      {crew.name.split(' ')[0]}
                    </div>
                  )}
                  <Badge className={`text-white text-xs ${isJobLinked ? 'bg-blue-500' : 'bg-purple-500'}`}>
                    {isJobLinked ? 'Job Task' : 'Appointment'}
                  </Badge>
                </div>
              </div>
            </div>
          );
        }
      })}
      {sortedItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No items scheduled</p>
        </div>
      )}
    </div>
  );
}

export default function Schedule() {
  const [, setLocation] = useLocation();
  const [viewType, setViewType] = useState<ViewType>(() => {
    // Default to day view on mobile, week view on desktop
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'day' : 'week';
    }
    return 'week';
  });
  const [weekStart, setWeekStart] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam) {
        try {
          return startOfWeek(parseISO(dateParam), { weekStartsOn: 1 });
        } catch {}
      }
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam) {
        try {
          return parseISO(dateParam);
        } catch {}
      }
    }
    return new Date();
  });
  const [showWeekends, setShowWeekends] = useState(false);
  const [activeStaff, setActiveStaff] = useState<string[]>([]);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [crewFilterOpen, setCrewFilterOpen] = useState(false);
  const isMobile = useIsMobile();
  const [selectedCellDate, setSelectedCellDate] = useState('');
  const [selectedCellCrew, setSelectedCellCrew] = useState('');
  const [selectedCellTime, setSelectedCellTime] = useState('');
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<DayWeather[]>([]);
  const [scheduleType, setScheduleType] = useState<'jobs' | 'appointments' | 'all'>('all');
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const queryClient = useQueryClient();

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 10,
    },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: fetchJobs
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['/api/crew-members'],
    queryFn: fetchCrewMembers
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => fetchCustomers()
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: fetchAppointments
  });

  useEffect(() => {
    if (crewMembers.length > 0 && activeStaff.length === 0) {
      setActiveStaff(crewMembers.map(m => m.id));
    }
  }, [crewMembers]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const startDate = format(weekStart, 'yyyy-MM-dd');
        const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=-33.87&longitude=151.21&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Australia%2FSydney&start_date=${startDate}&end_date=${endDate}`
        );
        const data = await response.json();
        if (data.daily) {
          const weather: DayWeather[] = data.daily.time.map((date: string, i: number) => ({
            date,
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            weatherCode: data.daily.weather_code[i]
          }));
          setWeatherData(weather);
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      }
    };
    fetchWeather();
  }, [weekStart]);

  const getWeatherForDate = (date: Date): DayWeather | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return weatherData.find(w => w.date === dateStr);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const dropId = over.id as string;
    
    // Check if this is an appointment drag (id starts with "appt-")
    if (activeId.startsWith('appt-')) {
      const appointmentId = activeId.replace('appt-', '');
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;
      
      let newDate = dropId;
      let newAssignedTo = appointment.assignedTo || [];
      let newTime = appointment.scheduledTime;

      if (dropId.includes('::')) {
        const [firstPart, secondPart] = dropId.split('::');
        const isDateFirst = firstPart.match(/^\d{4}-\d{2}-\d{2}$/);
        
        if (isDateFirst) {
          newDate = firstPart;
          newTime = secondPart;
        } else {
          if (firstPart && firstPart !== 'unassigned') {
            newAssignedTo = [firstPart];
          } else if (firstPart === 'unassigned') {
            newAssignedTo = [];
          }
          newDate = secondPart;
        }
      }

      if (appointment.scheduledDate === newDate && appointment.scheduledTime === newTime && JSON.stringify(appointment.assignedTo) === JSON.stringify(newAssignedTo)) {
        return;
      }
      
      try {
        await updateAppointment(appointmentId, { 
          scheduledDate: newDate,
          scheduledTime: newTime || null,
          assignedTo: newAssignedTo
        });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        if (appointment.jobId) {
          queryClient.invalidateQueries({ queryKey: [`/api/jobs/${appointment.jobId}/appointments`] });
        }
      } catch (error) {
        console.error('Failed to reschedule appointment:', error);
      }
      return;
    }
    
    // Handle job drag (original behavior)
    const jobId = activeId;
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) return;

    let newDate = dropId;
    let newAssignedTo = job.assignedTo;
    let newTime = job.scheduledTime;

    if (dropId.includes('::')) {
      const [firstPart, secondPart] = dropId.split('::');
      
      // Check if this is a day view drop (date::time format like "2026-01-03::09:00")
      // or a staff timeline drop (crewId::date format)
      const isDateFirst = firstPart.match(/^\d{4}-\d{2}-\d{2}$/);
      
      if (isDateFirst) {
        // Day view: firstPart is date, secondPart is time
        newDate = firstPart;
        newTime = secondPart;
      } else {
        // Staff timeline: firstPart is crewId, secondPart is date
        if (firstPart && firstPart !== 'unassigned') {
          newAssignedTo = [firstPart];
        } else if (firstPart === 'unassigned') {
          newAssignedTo = [];
        }
        newDate = secondPart;
      }
    }

    if (job.scheduledDate === newDate && job.scheduledTime === newTime && JSON.stringify(job.assignedTo) === JSON.stringify(newAssignedTo)) {
      return;
    }
    
    try {
      await updateJob(jobId, { 
        scheduledDate: newDate,
        scheduledTime: newTime,
        assignedTo: newAssignedTo
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    } catch (error) {
      console.error('Failed to reschedule job:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    // Check if dragging an appointment
    if (activeId.startsWith('appt-')) {
      // Could add visual feedback for appointment drag here if needed
      return;
    }
    const job = jobs.find(j => j.id === activeId);
    if (job) setActiveJob(job);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setEditDialogOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    // Always open the edit dialog, even for job-linked appointments
    setEditingAppointment(appointment);
    setAppointmentDialogOpen(true);
  };

  const handleNewAppointment = (date?: string, crewId?: string) => {
    setEditingAppointment(null);
    setSelectedCellDate(date || format(new Date(), 'yyyy-MM-dd'));
    setSelectedCellCrew(crewId || '');
    setAppointmentDialogOpen(true);
  };

  const handleSaveAppointment = async (jobId: string, updates: { scheduledDate: string | null; scheduledTime?: string | null; estimatedDuration?: number | null; assignedTo: string[]; notes?: string }) => {
    await updateJob(jobId, updates);
    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
  };

  const handleCellClick = (date: string, crewId?: string) => {
    setSelectedCellDate(date);
    setSelectedCellCrew(crewId || '');
    setSelectedCellTime('');
    setNewAppointmentOpen(true);
  };

  const handleDayCellClick = (date: string, time?: string) => {
    setSelectedCellDate(date);
    setSelectedCellCrew('');
    setSelectedCellTime(time || '');
    setNewAppointmentOpen(true);
  };

  const handleScheduleJob = async (jobId: string, updates: { scheduledDate: string; scheduledTime?: string; assignedTo: string[] }) => {
    try {
      const job = jobs.find(j => j.id === jobId);
      const title = job?.title || 'Scheduled Work';
      await createAppointment({
        title,
        jobId,
        scheduledDate: updates.scheduledDate,
        scheduledTime: updates.scheduledTime || null,
        assignedTo: updates.assignedTo.length > 0 ? updates.assignedTo : null,
        location: null
      } as InsertAppointment);
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/appointments`] });
    } catch (error) {
      console.error('Failed to schedule job:', error);
    }
  };

  const toggleStaff = (memberId: string) => {
    setActiveStaff(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAllStaff = () => {
    setActiveStaff(crewMembers.map(m => m.id));
  };


  return (
    <Layout fullWidth>
      <FeatureGate feature="scheduling">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-primary" data-testid="text-schedule-title">
            Schedule
          </h1>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <Button 
                variant={viewType === 'week' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewType('week')}
                data-testid="button-view-week"
                className="gap-1 min-h-[44px] md:min-h-0 h-9 md:h-9 px-3 sm:px-3"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Week</span>
              </Button>
              <Button 
                variant={viewType === 'day' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewType('day')}
                data-testid="button-view-day"
                className="gap-1 min-h-[44px] md:min-h-0 h-9 md:h-9 px-3 sm:px-3"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Day</span>
              </Button>
              <Button 
                variant={viewType === 'list' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewType('list')}
                data-testid="button-view-list"
                className="gap-1 min-h-[44px] md:min-h-0 h-9 md:h-9 px-3 sm:px-3"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Schedule Type Toggle */}
          <Tabs value={scheduleType} onValueChange={(v) => setScheduleType(v as 'jobs' | 'appointments' | 'all')}>
            <TabsList className="h-10">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
              <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* New Appointment Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 gap-2"
            onClick={() => handleNewAppointment()}
            data-testid="button-new-appointment"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Appointment</span>
          </Button>

          {/* Crew Filter - Sheet for mobile, Popover for desktop */}
          {isMobile ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2"
                onClick={() => setCrewFilterOpen(true)}
                data-testid="button-crew-filter"
              >
                <Users className="h-4 w-4" />
                <span>Crew</span>
                {activeStaff.length < crewMembers.length && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {activeStaff.length}
                  </Badge>
                )}
              </Button>
              <Sheet open={crewFilterOpen} onOpenChange={setCrewFilterOpen}>
                <SheetContent side="bottom" className="h-auto max-h-[70vh]">
                  <SheetHeader>
                    <SheetTitle>Filter by Crew</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-2 mt-4 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllStaff}
                      className="w-full justify-start text-sm h-11"
                      data-testid="button-select-all-staff"
                    >
                      <Check className={`h-4 w-4 mr-2 ${activeStaff.length === crewMembers.length ? 'opacity-100' : 'opacity-0'}`} />
                      Select All
                    </Button>
                    <div className="h-px bg-border my-2" />
                    {crewMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => toggleStaff(member.id)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors text-left min-h-[44px]"
                        data-testid={`crew-filter-${member.id}`}
                      >
                        <Checkbox 
                          checked={activeStaff.includes(member.id)}
                          className="pointer-events-none h-5 w-5"
                        />
                        <div 
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: member.color || '#3b82f6' }}
                        />
                        <span className="text-base truncate">{member.name}</span>
                      </button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2"
                  data-testid="button-crew-filter"
                >
                  <Users className="h-4 w-4" />
                  <span>Crew</span>
                  {activeStaff.length < crewMembers.length && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {activeStaff.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllStaff}
                    className="w-full justify-start text-sm h-9"
                    data-testid="button-select-all-staff"
                  >
                    <Check className={`h-4 w-4 mr-2 ${activeStaff.length === crewMembers.length ? 'opacity-100' : 'opacity-0'}`} />
                    Select All
                  </Button>
                  <div className="h-px bg-border my-1" />
                  {crewMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => toggleStaff(member.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
                      data-testid={`crew-filter-${member.id}`}
                    >
                      <Checkbox 
                        checked={activeStaff.includes(member.id)}
                        className="pointer-events-none"
                      />
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: member.color || '#3b82f6' }}
                      />
                      <span className="text-sm truncate">{member.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <Button 
                variant={!showWeekends ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setShowWeekends(false)}
                className="min-h-[44px] md:min-h-0 h-8 md:h-8 text-xs sm:text-sm"
                data-testid="button-weekdays-only"
              >
                Mon-Fri
              </Button>
              <Button 
                variant={showWeekends ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setShowWeekends(true)}
                className="min-h-[44px] md:min-h-0 h-8 md:h-8 text-xs sm:text-sm"
                data-testid="button-all-days"
              >
                All Week
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => {
                    if (viewType === 'day') {
                      setSelectedDate(addDays(selectedDate, -1));
                    } else {
                      setWeekStart(subWeeks(weekStart, 1));
                    }
                  }}
                  data-testid="button-prev"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-11 px-4"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
                  }}
                  data-testid="button-today"
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => {
                    if (viewType === 'day') {
                      setSelectedDate(addDays(selectedDate, 1));
                    } else {
                      setWeekStart(addWeeks(weekStart, 1));
                    }
                  }}
                  data-testid="button-next"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              
              <h2 className="text-base sm:text-lg font-semibold text-center sm:text-right">
                {viewType === 'day' 
                  ? format(selectedDate, 'EEE, MMM d, yyyy')
                  : `Week of ${format(weekStart, 'MMM d, yyyy')}`
                }
              </h2>
            </div>

            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to load schedule</h3>
                <p className="text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "Something went wrong. Please try again."}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>
            ) : (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {viewType === 'week' && (
                  <WeekGridView
                    weekStart={weekStart}
                    jobs={jobs}
                    crewMembers={crewMembers}
                    customers={customers}
                    onCellClick={handleCellClick}
                    onEditJob={handleEditJob}
                    showWeekends={showWeekends}
                    getWeatherForDate={getWeatherForDate}
                    appointments={appointments}
                    onAppointmentClick={handleEditAppointment}
                    scheduleType={scheduleType}
                  />
                )}

                {viewType === 'day' && (
                  <DayTimelineView
                    selectedDate={selectedDate}
                    jobs={jobs}
                    crewMembers={crewMembers}
                    customers={customers}
                    onEditJob={handleEditJob}
                    onCellClick={handleDayCellClick}
                    appointments={appointments}
                    onAppointmentClick={handleEditAppointment}
                    scheduleType={scheduleType}
                  />
                )}

                {viewType === 'list' && (
                  <ListView
                    jobs={jobs}
                    crewMembers={crewMembers}
                    customers={customers}
                    onEditJob={handleEditJob}
                    appointments={appointments}
                    onAppointmentClick={handleEditAppointment}
                    scheduleType={scheduleType}
                  />
                )}

                <DragOverlay>
                  {activeJob ? (
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border shadow-lg text-sm">
                      {activeJob.title}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </CardContent>
        </Card>

        <ScheduleJobDialog
          open={newAppointmentOpen}
          onOpenChange={setNewAppointmentOpen}
          selectedDate={selectedCellDate}
          selectedCrewId={selectedCellCrew}
          selectedTime={selectedCellTime}
          jobs={jobs}
          crewMembers={crewMembers}
          customers={customers}
          onSchedule={handleScheduleJob}
        />

        <EditAppointmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          job={editingJob}
          crewMembers={crewMembers}
          customer={customers.find(c => c.id === editingJob?.customerId)}
          onSave={handleSaveAppointment}
        />

        <AppointmentFormDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          appointment={editingAppointment}
          selectedDate={selectedCellDate}
          selectedCrewId={selectedCellCrew}
          crewMembers={crewMembers}
          jobs={jobs}
          customers={customers}
          onSave={async (data) => {
            if (editingAppointment) {
              await updateAppointment(editingAppointment.id, data);
              // Also invalidate job-specific appointments cache for sync
              if (editingAppointment.jobId) {
                queryClient.invalidateQueries({ queryKey: [`/api/jobs/${editingAppointment.jobId}/appointments`] });
              }
            } else {
              await createAppointment(data as InsertAppointment);
            }
            queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
            setEditingAppointment(null);
          }}
          onDelete={editingAppointment ? async () => {
            await deleteAppointment(editingAppointment.id);
            queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
            // Also invalidate job-specific appointments cache for sync
            if (editingAppointment.jobId) {
              queryClient.invalidateQueries({ queryKey: [`/api/jobs/${editingAppointment.jobId}/appointments`] });
            }
            setEditingAppointment(null);
          } : undefined}
        />
      </div>
      </FeatureGate>
    </Layout>
  );
}
