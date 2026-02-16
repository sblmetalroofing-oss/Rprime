import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { MobileNav } from "./mobile-nav";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  backHref?: string;
}

export function MobileLayout({ children, title, showNav = true, backHref }: MobileLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background">
      {title && (
        <header className="sticky top-0 z-40 bg-background border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center h-14 px-4 relative">
            {backHref && (
              <Link href={backHref} className="absolute left-2 flex items-center text-primary text-sm font-medium min-w-[44px] min-h-[44px] justify-center" data-testid="button-mobile-back">
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Link>
            )}
            <h1 className="text-lg font-semibold flex-1 text-center">{title}</h1>
          </div>
        </header>
      )}
      
      <main className={showNav ? "pb-[calc(64px+env(safe-area-inset-bottom))]" : ""}>
        {children}
      </main>
      
      {showNav && <MobileNav />}
    </div>
  );
}
