import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface MultiDatePickerProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiDatePicker({
  selectedDates,
  onDatesChange,
  placeholder = "Select dates",
  disabled = false,
  className,
}: MultiDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (dates: Date[] | undefined) => {
    onDatesChange(dates || []);
  };

  const removeDate = (dateToRemove: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    onDatesChange(selectedDates.filter(d => d.getTime() !== dateToRemove.getTime()));
  };

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal min-h-[40px] h-auto",
            !selectedDates.length && "text-muted-foreground",
            className
          )}
          data-testid="multi-date-picker-trigger"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {selectedDates.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {sortedDates.map((date, i) => (
                <Badge
                  key={date.getTime()}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 flex items-center gap-1"
                >
                  {format(date, "MMM d")}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => removeDate(date, e)}
                    data-testid={`remove-date-${i}`}
                  />
                </Badge>
              ))}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="multiple"
          selected={selectedDates}
          onSelect={handleSelect}
          disabled={{ before: new Date() }}
          className="p-3"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100 inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground"
            ),
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
        />
        <div className="p-3 pt-0 flex justify-between items-center border-t">
          <span className="text-sm text-muted-foreground">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
          </span>
          <Button size="sm" onClick={() => setOpen(false)} data-testid="done-selecting-dates">
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
