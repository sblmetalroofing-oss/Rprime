import { createContext, useContext, useEffect, useState } from "react";

type AccentColor = "slate" | "pink" | "purple" | "blue" | "green" | "orange" | "teal";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultAccent?: AccentColor;
  storageKey?: string;
};

type ThemeProviderState = {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
};

const initialState: ThemeProviderState = {
  accentColor: "slate",
  setAccentColor: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Accent color definitions (HSL values for primary color)
const accentColors: Record<AccentColor, { primary: string; ring: string }> = {
  slate: { primary: "215 25% 27%", ring: "215 25% 27%" },
  pink: { primary: "330 80% 60%", ring: "330 80% 60%" },
  purple: { primary: "270 70% 55%", ring: "270 70% 55%" },
  blue: { primary: "217 91% 60%", ring: "217 91% 60%" },
  green: { primary: "142 70% 45%", ring: "142 70% 45%" },
  orange: { primary: "25 95% 53%", ring: "25 95% 53%" },
  teal: { primary: "173 80% 40%", ring: "173 80% 40%" },
};

export function ThemeProvider({
  children,
  defaultAccent = "slate",
  storageKey = "rprime-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(`${storageKey}-accent`) as AccentColor) || defaultAccent;
    }
    return defaultAccent;
  });

  // Force dark mode always
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
  }, []);

  // Apply accent color
  useEffect(() => {
    const root = window.document.documentElement;
    const colors = accentColors[accentColor];
    
    // Remove all accent classes
    Object.keys(accentColors).forEach(color => {
      root.classList.remove(`accent-${color}`);
    });
    
    // Add current accent class
    root.classList.add(`accent-${accentColor}`);
    
    // Set CSS custom properties for the accent
    root.style.setProperty("--accent-primary", colors.primary);
    root.style.setProperty("--accent-ring", colors.ring);
  }, [accentColor]);

  const setAccentColor = (color: AccentColor) => {
    localStorage.setItem(`${storageKey}-accent`, color);
    setAccentColorState(color);
  };

  const value = {
    accentColor,
    setAccentColor,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

// Export accent colors for use in UI
export const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: "slate", label: "Slate", color: "#3e4f61" },
  { value: "pink", label: "Pink", color: "#ec4899" },
  { value: "purple", label: "Purple", color: "#8b5cf6" },
  { value: "blue", label: "Blue", color: "#3b82f6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "orange", label: "Orange", color: "#f97316" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
];
