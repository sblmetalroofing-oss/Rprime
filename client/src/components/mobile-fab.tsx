import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Plus, X, Briefcase, FileText, Receipt, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabItem {
  href: string;
  label: string;
  icon: ReactNode;
  color: string;
}

export function MobileFab() {
  const [isOpen, setIsOpen] = useState(false);

  const items: FabItem[] = [
    { 
      href: "/job/new", 
      label: "New Job", 
      icon: <Briefcase className="h-5 w-5" />,
      color: "bg-blue-500 hover:bg-blue-600"
    },
    { 
      href: "/quote/new", 
      label: "New Quote", 
      icon: <ClipboardList className="h-5 w-5" />,
      color: "bg-green-500 hover:bg-green-600"
    },
    { 
      href: "/invoice/new", 
      label: "New Invoice", 
      icon: <Receipt className="h-5 w-5" />,
      color: "bg-purple-500 hover:bg-purple-600"
    },
    { 
      href: "/report/new", 
      label: "New Report", 
      icon: <FileText className="h-5 w-5" />,
      color: "bg-amber-500 hover:bg-amber-600"
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
          data-testid="fab-backdrop"
        />
      )}

      {/* FAB Container */}
      <div className="fixed right-4 bottom-20 z-50 flex flex-col-reverse items-end gap-3 pb-[env(safe-area-inset-bottom)]">
        {/* Action Items */}
        {isOpen && items.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200",
              { "animation-delay-75": index === 1 },
              { "animation-delay-150": index === 2 },
              { "animation-delay-225": index === 3 }
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            data-testid={`fab-item-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <span className="bg-background text-foreground text-sm font-medium px-3 py-2 rounded-lg shadow-lg">
              {item.label}
            </span>
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform",
              item.color
            )}>
              {item.icon}
            </div>
          </Link>
        ))}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95",
            isOpen 
              ? "bg-gray-600 hover:bg-gray-700 rotate-45" 
              : "bg-primary hover:bg-primary/90"
          )}
          data-testid="fab-main"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
