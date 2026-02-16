import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme, ACCENT_COLORS } from "@/components/theme-provider";

export function ThemeToggle() {
  const { accentColor, setAccentColor } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-lg"
          data-testid="button-theme-settings"
        >
          <Palette className="h-5 w-5" />
          <span className="sr-only">Accent color</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Accent Color</DropdownMenuLabel>
        
        {ACCENT_COLORS.map((color) => (
          <DropdownMenuItem
            key={color.value}
            onClick={() => setAccentColor(color.value)}
            className="flex items-center gap-2 cursor-pointer min-h-[44px]"
            data-testid={`accent-color-${color.value}`}
          >
            <div 
              className="h-5 w-5 rounded-full border"
              style={{ backgroundColor: color.color }}
            />
            <span className="flex-1">{color.label}</span>
            {accentColor === color.value && (
              <Check className="h-5 w-5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
