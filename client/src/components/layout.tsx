import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/trial-banner";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  LogOut, 
  LogIn,
  Menu,
  Users,
  Calendar,
  ClipboardList,
  Receipt,
  Package,
  Briefcase,
  UserPlus,
  Shield,
  Building2,
  Search,
  MessageCircle,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Bug,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect, useCallback } from "react";
import defaultLogoUrl from "@assets/rprime-header-logo.png";
import defaultLogoIconUrl from "@assets/rprime-header-logo.png";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useBehaviorTracking } from "@/hooks/use-behavior-tracking";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { useQuery } from "@tanstack/react-query";
import { fetchCrewMembers, fetchJobs, fetchCustomers, fetchQuotes, fetchInvoices, fetchSuppliers, fetchLeads, fetchPurchaseOrders } from "@/lib/api";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Layout({ 
  children,
  fullWidth = false,
  noPadding = false
}: { 
  children: React.ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { isAdmin, isOrganizationOwner, isSuperAdmin, canViewFinancials, canAccessSettings, crewMember } = usePermissions();
  const [logoUrl, setLogoUrl] = useState(defaultLogoUrl);
  const isMobile = useIsMobile();
  const { features } = usePlanLimits();
  
  useBehaviorTracking();

  useEffect(() => {
    if (!user || localStorage.getItem('timezone_detected')) return;
    (async () => {
      try {
        const res = await fetch('/api/organization/timezone');
        if (!res.ok) return;
        const data = await res.json();
        if (data.timezone === 'Australia/Brisbane') {
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (browserTz && browserTz !== 'Australia/Brisbane') {
            await fetch('/api/organization/timezone', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timezone: browserTz }),
            });
          }
        }
        localStorage.setItem('timezone_detected', 'true');
      } catch {
      }
    })();
  }, [user]);
  
  // Sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });
  
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar_collapsed', String(newValue));
      return newValue;
    });
  }, []);

  const { data: crewMembers, isLoading: crewLoading } = useQuery({
    queryKey: ["/api/crew-members"],
    queryFn: fetchCrewMembers,
    enabled: !!user,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: fetchJobs,
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchCustomers(),
    enabled: !!user,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: fetchQuotes,
    enabled: !!user && canViewFinancials,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: fetchInvoices,
    enabled: !!user && canViewFinancials,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: () => fetchSuppliers(),
    enabled: !!user,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["/api/leads"],
    queryFn: fetchLeads,
    enabled: !!user && canViewFinancials,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["/api/purchase-orders"],
    queryFn: fetchPurchaseOrders,
    enabled: !!user && canViewFinancials,
  });

  const [pendingGoto, setPendingGoto] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      
      if (isTyping) return;
      
      // Show keyboard shortcuts help with ?
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPendingGoto(true);
        toast({
          description: "Go to: d=Dashboard, j=Jobs, s=Schedule, c=Customers, q=Quotes, i=Invoices, r=Reports, p=Products, l=Leads",
          duration: 1500,
        });
        setTimeout(() => setPendingGoto(false), 1500);
        return;
      }
      
      if (pendingGoto && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setPendingGoto(false);
        const shortcuts: Record<string, string> = {
          'd': '/',
          'j': '/jobs',
          's': '/schedule',
          'c': '/customers',
          'q': '/quotes',
          'i': '/invoices',
          'r': '/reports',
          'p': '/products',
          'l': '/leads',
        };
        const route = shortcuts[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          setLocation(route);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [pendingGoto, setLocation]);

  const handleSelect = useCallback((value: string) => {
    setSearchOpen(false);
    setLocation(value);
  }, [setLocation]);

  const hasNoCrewMembers = !crewMembers || crewMembers.length === 0;
  const showAllNavItems = isAdmin || hasNoCrewMembers;
  const showFinancials = showAllNavItems || canViewFinancials;
  const showSettings = showAllNavItems || canAccessSettings;

  useEffect(() => {
    localStorage.removeItem('sbl_custom_logo');
  }, []);

  const { data: unreadData = { count: 0 } } = useQuery({
    queryKey: ["/api/chat/unread-count"],
    queryFn: async () => {
      const lastVisit = localStorage.getItem('last_chat_visit') || '0';
      const res = await fetch(`/api/chat/unread-count?lastVisit=${lastVisit}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = unreadData.count;

  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }) => {
    const isActive = href === "/" ? location === "/" : location.startsWith(href);
    const navContent = (
      <Link href={href} onClick={() => {
        if (href === '/chat') {
          localStorage.setItem('last_chat_visit', Date.now().toString());
        }
      }}>
        <div className={cn(
          "flex items-center gap-3 rounded-md transition-all cursor-pointer group relative",
          sidebarCollapsed ? "px-2 py-2 justify-center" : "px-3 py-1.5",
          isActive 
            ? "bg-primary text-primary-foreground font-medium" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}>
          <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
          {!sidebarCollapsed && <span className="flex-1">{label}</span>}
          {badge !== undefined && badge > 0 && (
            <span className={cn(
              "bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
              sidebarCollapsed && "absolute -top-1 -right-1 min-w-[16px] h-[16px] text-[9px]"
            )}>
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
      </Link>
    );
    
    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{navContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return navContent;
  };

  const SidebarContent = () => (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full">
        {/* Header with logo and collapse toggle */}
        <div className={cn("py-3 border-b flex items-center", sidebarCollapsed ? "px-2 justify-center" : "px-4 justify-between")}>
          <Link href="/">
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-pink-500/20 to-red-500/20 blur-xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
              {sidebarCollapsed ? (
                <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-600 rounded-lg text-white font-bold text-sm">
                  R
                </div>
              ) : (
                <img 
                  src={logoUrl} 
                  alt="RPrime" 
                  className="relative w-full max-w-[140px] h-auto object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all duration-300 group-hover:scale-[1.02]" 
                />
              )}
            </div>
          </Link>
          {!sidebarCollapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={toggleSidebar}
              data-testid="button-collapse-sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="py-2 px-2 border-b">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-full text-muted-foreground hover:text-foreground"
                  onClick={toggleSidebar}
                  data-testid="button-expand-sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className={cn("flex-1 py-3 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent", sidebarCollapsed ? "px-2" : "px-3")}>
        <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
        <NavItem href="/reports" icon={FileText} label="Reports" />
        <NavItem href="/jobs" icon={Briefcase} label="Jobs" />
        {features.scheduling && <NavItem href="/schedule" icon={Calendar} label="Schedule" />}
        {features.chat && <NavItem href="/chat" icon={MessageCircle} label="Chat" badge={unreadCount} />}
        {showFinancials && <NavItem href="/quotes" icon={ClipboardList} label="Quotes" />}
        {showFinancials && <NavItem href="/invoices" icon={Receipt} label="Invoices" />}
        {showFinancials && features.purchaseOrders && <NavItem href="/purchase-orders" icon={Package} label="Purchase Orders" />}
        {showFinancials && <NavItem href="/rflash" icon={PenTool} label="RFlash" />}
        <NavItem href="/customers" icon={Users} label="Customers" />
        <NavItem href="/suppliers" icon={Building2} label="Suppliers" />
        {features.leads && <NavItem href="/leads" icon={UserPlus} label="Leads" />}
        {features.products && <NavItem href="/products" icon={Package} label="Products" />}
        {showSettings && <NavItem href="/settings" icon={Settings} label="Settings" />}
        {showSettings && <NavItem href="/billing" icon={CreditCard} label="Billing" />}
        {isSuperAdmin && <NavItem href="/feedback" icon={Bug} label="Feedback" />}
        {user?.isSuperAdmin && <NavItem href="/admin/organizations" icon={Shield} label="Super Admin" />}
      </div>

      <div className={cn("border-t bg-muted/20", sidebarCollapsed ? "p-2" : "p-4")}>
        {isAuthenticated && user ? (
          sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  {user.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt={user.firstName || 'User'} 
                      className="h-8 w-8 rounded-full object-cover cursor-pointer"
                    />
                  ) : (
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs text-white cursor-pointer"
                      style={{ backgroundColor: crewMember?.color || '#3b82f6' }}
                    >
                      {(crewMember?.name?.[0] || user.firstName?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {crewMember?.name || user.firstName || 'User'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    data-testid="button-logout-collapsed"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                {user.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt={user.firstName || 'User'} 
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div 
                    className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs text-white"
                    style={{ backgroundColor: crewMember?.color || '#3b82f6' }}
                  >
                    {(crewMember?.name?.[0] || user.firstName?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <p 
                    className="text-sm font-medium truncate" 
                    data-testid="text-username"
                    style={crewMember?.color ? { color: crewMember.color } : undefined}
                  >
                    {crewMember?.name 
                      || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null)
                      || user.firstName 
                      || 'Crew Member'}
                  </p>
                </div>
                <NotificationBell />
                <ThemeToggle />
              </div>
              <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground" 
                size="sm" 
                data-testid="button-logout"
                onClick={() => logout()}
                disabled={isLoggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </>
          )
        ) : (
          sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="/api/login">
                  <Button variant="ghost" size="icon" className="w-full h-8" data-testid="button-login-collapsed">
                    <LogIn className="h-4 w-4" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">Sign In</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  ?
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Not signed in</p>
                </div>
              </div>
              <a href="/api/login">
                <Button className="w-full justify-start" size="sm" data-testid="button-login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </a>
            </>
          )
        )}
      </div>
    </div>
    </TooltipProvider>
  );

  return (
    <div className="min-h-screen bg-muted/20 flex font-sans overflow-x-hidden">
      {/* Desktop Sidebar - hidden on screens under 1024px (lg breakpoint) to cover landscape phones */}
      <aside className={cn(
        "hidden lg:block bg-card border-r fixed h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-72"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar - notification bell for mobile users */}
      {isMobile && isAuthenticated && (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-12 px-3">
            <span className="text-sm font-semibold text-foreground">{user?.organizationName || 'RPrime'}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSearchOpen(true)}
                data-testid="button-mobile-search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <NotificationBell />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-h-screen w-full max-w-full overflow-x-hidden transition-all duration-300",
        isMobile ? "pb-20 pt-[calc(48px+env(safe-area-inset-top))]" : (sidebarCollapsed ? "lg:ml-16" : "lg:ml-72")
      )}>
        <TrialBanner />
        <div className={cn(
          "animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-full overflow-x-hidden",
          !fullWidth && "max-w-[1800px] mx-auto",
          !noPadding && (isMobile ? "px-3 pb-4" : "p-4 sm:p-6 lg:p-8")
        )}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - Tradify style */}
      {isMobile && isAuthenticated && <MobileNav />}

      {/* Global Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search jobs, customers, quotes, invoices, suppliers, leads..." data-testid="input-global-search" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {jobs.length > 0 && (
            <CommandGroup heading="Jobs">
              {jobs.slice(0, 5).map(job => (
                <CommandItem
                  key={job.id}
                  value={`job ${job.title} ${job.address || ''}`}
                  onSelect={() => handleSelect(`/jobs/${job.id}`)}
                  data-testid={`search-job-${job.id}`}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{job.title}</span>
                    <span className="text-xs text-muted-foreground">{job.address}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {customers.length > 0 && (
            <CommandGroup heading="Customers">
              {customers.slice(0, 5).map(customer => (
                <CommandItem
                  key={customer.id}
                  value={`customer ${customer.name} ${customer.email || ''}`}
                  onSelect={() => handleSelect(`/customer/${customer.id}`)}
                  data-testid={`search-customer-${customer.id}`}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{customer.name}</span>
                    <span className="text-xs text-muted-foreground">{customer.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showFinancials && quotes.length > 0 && (
            <CommandGroup heading="Quotes">
              {quotes.slice(0, 5).map(quote => (
                <CommandItem
                  key={quote.id}
                  value={`quote ${quote.quoteNumber} ${quote.customerName}`}
                  onSelect={() => handleSelect(`/quote/${quote.id}`)}
                  data-testid={`search-quote-${quote.id}`}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{quote.quoteNumber}</span>
                    <span className="text-xs text-muted-foreground">{quote.customerName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showFinancials && invoices.length > 0 && (
            <CommandGroup heading="Invoices">
              {invoices.slice(0, 5).map(invoice => (
                <CommandItem
                  key={invoice.id}
                  value={`invoice ${invoice.invoiceNumber} ${invoice.customerName}`}
                  onSelect={() => handleSelect(`/invoice/${invoice.id}`)}
                  data-testid={`search-invoice-${invoice.id}`}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <span className="text-xs text-muted-foreground">{invoice.customerName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {suppliers.length > 0 && (
            <CommandGroup heading="Suppliers">
              {suppliers.slice(0, 5).map(supplier => (
                <CommandItem
                  key={supplier.id}
                  value={`supplier ${supplier.name} ${supplier.contactName || ''}`}
                  onSelect={() => handleSelect(`/supplier/${supplier.id}`)}
                  data-testid={`search-supplier-${supplier.id}`}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{supplier.name}</span>
                    <span className="text-xs text-muted-foreground">{supplier.contactName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showFinancials && leads.length > 0 && (
            <CommandGroup heading="Leads">
              {leads.slice(0, 5).map(lead => (
                <CommandItem
                  key={lead.id}
                  value={`lead ${lead.name} ${lead.email || ''} ${lead.phone || ''}`}
                  onSelect={() => handleSelect(`/lead/${lead.id}`)}
                  data-testid={`search-lead-${lead.id}`}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showFinancials && purchaseOrders.length > 0 && (
            <CommandGroup heading="Purchase Orders">
              {purchaseOrders.slice(0, 5).map(po => (
                <CommandItem
                  key={po.id}
                  value={`purchase order ${po.poNumber} ${po.supplier}`}
                  onSelect={() => handleSelect(`/purchase-order/${po.id}`)}
                  data-testid={`search-po-${po.id}`}
                >
                  <Package className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{po.poNumber}</span>
                    <span className="text-xs text-muted-foreground">{po.supplier}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Navigation</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm">Go to page</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">G</kbd>
                    <span className="text-muted-foreground text-xs">then</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">D/J/S/C/Q/I/R/P/L</kbd>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pl-2">
                  D=Dashboard, J=Jobs, S=Schedule, C=Customers, Q=Quotes, I=Invoices, R=Reports, P=Products, L=Leads
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Search</h4>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Global search</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">⌘</kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">K</kbd>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Help</h4>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm">Show this help</span>
                <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">?</kbd>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
