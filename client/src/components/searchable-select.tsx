import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchableSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: { value: string; label: string; sublabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  "data-testid"?: string;
  minSearchLength?: number;
  maxResults?: number;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Type to search...",
  emptyText = "No results found.",
  className,
  "data-testid": testId,
  minSearchLength = 2,
  maxResults = 50,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useIsMobile();

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    if (searchTerm.length < minSearchLength) {
      return [];
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    const matches = options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(lowerSearch);
      const sublabelMatch = option.sublabel?.toLowerCase().includes(lowerSearch);
      return labelMatch || sublabelMatch;
    });
    
    return matches.slice(0, maxResults);
  }, [options, searchTerm, minSearchLength, maxResults]);

  const handleSelect = (selectedValue: string | null) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearchTerm("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchTerm("");
    }
  };

  const showInitialMessage = searchTerm.length < minSearchLength;
  const showNoResults = !showInitialMessage && filteredOptions.length === 0;
  const showResults = !showInitialMessage && filteredOptions.length > 0;

  const SelectContent = (
    <div className="flex flex-col">
      <div className="flex items-center border-b px-3 py-2">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8 px-0"
          autoFocus
        />
      </div>
      
      <ScrollArea className={isMobile ? "h-[50vh]" : "h-[300px]"}>
        <div className="p-1">
          <div
            className={cn(
              "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
              value === null && "bg-accent"
            )}
            onClick={() => handleSelect(null)}
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4",
                value === null ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="text-muted-foreground">Clear selection</span>
          </div>
          
          {showInitialMessage && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least {minSearchLength} characters to search
              <div className="text-xs mt-1">({options.length} items available)</div>
            </div>
          )}
          
          {showNoResults && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}
          
          {showResults && (
            <>
              {filteredOptions.length === maxResults && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Showing top {maxResults} results. Type more to narrow down.
                </div>
              )}
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent",
                    isMobile && "py-3"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">{option.sublabel}</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const TriggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn("w-full justify-between font-normal", className)}
      data-testid={testId}
    >
      <span className="truncate">
        {selectedOption ? selectedOption.label : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          {TriggerButton}
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-3">
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="p-2">
            {SelectContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {SelectContent}
      </PopoverContent>
    </Popover>
  );
}
