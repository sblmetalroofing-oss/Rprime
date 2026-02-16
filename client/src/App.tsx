import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useDeviceInfo, DeviceProvider } from "@/hooks/use-mobile";
import { CapacitorProvider } from "@/hooks/use-capacitor";
import { Loader2 } from "lucide-react";
import { SubscriptionRequired } from "@/components/subscription-required";
import NotFound from "@/pages/not-found";
import Unauthorized from "@/pages/unauthorized";
import AuthPage from "@/pages/auth";
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Reports = lazy(() => import("@/pages/reports"));
const ReportEditor = lazy(() => import("@/pages/report-editor"));
const Settings = lazy(() => import("@/pages/settings"));
const PrintView = lazy(() => import("@/pages/print-view"));
const Customers = lazy(() => import("@/pages/customers"));
const CustomerEditor = lazy(() => import("@/pages/customer-editor"));
const Suppliers = lazy(() => import("@/pages/suppliers"));
const SupplierEditor = lazy(() => import("@/pages/supplier-editor"));
const Jobs = lazy(() => import("@/pages/jobs"));
const JobDetail = lazy(() => import("@/pages/job-detail"));
const JobEditor = lazy(() => import("@/pages/job-editor"));
const Schedule = lazy(() => import("@/pages/schedule"));
const Quotes = lazy(() => import("@/pages/quotes"));
const QuoteEditor = lazy(() => import("@/pages/quote-editor"));
const Invoices = lazy(() => import("@/pages/invoices"));
const InvoiceEditor = lazy(() => import("@/pages/invoice-editor"));
const PurchaseOrders = lazy(() => import("@/pages/purchase-orders"));
const POEditor = lazy(() => import("@/pages/po-editor"));
const Leads = lazy(() => import("@/pages/leads"));
const LeadEditor = lazy(() => import("@/pages/lead-editor"));
const Products = lazy(() => import("@/pages/products"));
const ProductEditor = lazy(() => import("@/pages/product-editor"));
const MobileSales = lazy(() => import("@/pages/mobile-sales"));
const MobileMore = lazy(() => import("@/pages/mobile-more"));
const Chat = lazy(() => import("@/pages/chat"));
const QuotePreview = lazy(() => import("@/pages/quote-preview"));
const InvoicePreview = lazy(() => import("@/pages/invoice-preview"));
const POPreview = lazy(() => import("@/pages/po-preview"));
const PublicDocumentView = lazy(() => import("@/pages/public-document-view"));
const DocumentThemes = lazy(() => import("@/pages/document-themes"));
const ThemeEditor = lazy(() => import("@/pages/theme-editor"));
const RFlash = lazy(() => import("@/pages/rflash"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Billing = lazy(() => import("@/pages/billing"));
const AdminOrganizations = lazy(() => import("@/pages/admin-organizations"));
const Signup = lazy(() => import("@/pages/signup"));
const FeedbackDashboard = lazy(() => import("@/pages/feedback-dashboard"));
const CrewDashboard = lazy(() => import("@/pages/crew-dashboard"));
import { fetchCrewMembers } from "@/lib/api";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  requirePermission?: 'canViewFinancials' | 'canAccessSettings' | 'canViewAllJobs' | 'canEditJobs' | 'isAdmin';
}

function ProtectedRoute({ component: Component, requirePermission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { isAuthorized, isLoading: permLoading, ...permissions } = usePermissions();
  const [location] = useLocation();
  const [minDelayComplete, setMinDelayComplete] = useState(false);

  const { data: crewMembers, isLoading: crewLoading } = useQuery({
    queryKey: ["/api/crew-members"],
    queryFn: fetchCrewMembers,
    enabled: !!user,
  });

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 1500 : 0;
    const timer = setTimeout(() => setMinDelayComplete(true), delay);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = authLoading || permLoading || (!!user && crewLoading) || !minDelayComplete;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <img 
          src="/logo-loading.png" 
          alt="RPrime" 
          className="w-[min(300px,70vw)] h-auto animate-pulse"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  // Check if user has no organization linked (orphan user)
  if (user && !user.organizationId) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md bg-card rounded-lg border shadow-sm p-6 space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Account Setup Required</h2>
            <p className="text-muted-foreground mt-2">
              Your account isn't connected to an organization yet.
            </p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Please contact your administrator to be added as a crew member. They need to add your email address to the team before you can access the app.
          </p>
          <button 
            onClick={() => window.location.href = "/api/logout"}
            className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Sign Out & Try Another Account
          </button>
        </div>
      </div>
    );
  }

  // Allow access if there are no crew members yet (first admin setup)
  const hasNoCrewMembers = !crewMembers || crewMembers.length === 0;
  
  if (!isAuthorized && !hasNoCrewMembers) {
    return <Unauthorized />;
  }

  // Check specific permission if required
  if (requirePermission && !hasNoCrewMembers && !permissions.isAdmin) {
    const hasPermission = permissions[requirePermission];
    if (!hasPermission) {
      return <Redirect to="/" />;
    }
  }

  return (
    <SubscriptionRequired>
      <Component />
    </SubscriptionRequired>
  );
}

function ConnectionAwareWrapper({ children }: { children: React.ReactNode }) {
  const deviceInfo = useDeviceInfo();
  
  useEffect(() => {
    if (deviceInfo.connectionType === 'slow' || deviceInfo.connectionType === 'offline') {
      document.body.classList.add('slow-connection');
    } else {
      document.body.classList.remove('slow-connection');
    }
    
    return () => {
      document.body.classList.remove('slow-connection');
    };
  }, [deviceInfo.connectionType]);
  
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/signup" component={Signup} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/customers">
        {() => <ProtectedRoute component={Customers} />}
      </Route>
      <Route path="/customer/new">
        {() => <ProtectedRoute component={CustomerEditor} />}
      </Route>
      <Route path="/customer/:id">
        {() => <ProtectedRoute component={CustomerEditor} />}
      </Route>
      <Route path="/suppliers">
        {() => <ProtectedRoute component={Suppliers} />}
      </Route>
      <Route path="/supplier/new">
        {() => <ProtectedRoute component={SupplierEditor} />}
      </Route>
      <Route path="/supplier/:id">
        {() => <ProtectedRoute component={SupplierEditor} />}
      </Route>
      <Route path="/leads">
        {() => <ProtectedRoute component={Leads} />}
      </Route>
      <Route path="/lead/new">
        {() => <ProtectedRoute component={LeadEditor} />}
      </Route>
      <Route path="/lead/:id">
        {() => <ProtectedRoute component={LeadEditor} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/product/new">
        {() => <ProtectedRoute component={ProductEditor} />}
      </Route>
      <Route path="/product/:id">
        {() => <ProtectedRoute component={ProductEditor} />}
      </Route>
      <Route path="/jobs">
        {() => <ProtectedRoute component={Jobs} />}
      </Route>
      <Route path="/job/new">
        {() => <ProtectedRoute component={JobEditor} />}
      </Route>
      <Route path="/job/:id/edit">
        {() => <ProtectedRoute component={JobEditor} />}
      </Route>
      <Route path="/jobs/:id">
        {(params) => <ProtectedRoute component={() => <JobDetail />} />}
      </Route>
      <Route path="/schedule">
        {() => <ProtectedRoute component={Schedule} />}
      </Route>
      <Route path="/quotes">
        {() => <ProtectedRoute component={Quotes} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/quote/new">
        {() => <ProtectedRoute component={QuoteEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/quote/:id">
        {() => <ProtectedRoute component={QuoteEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/preview/quote/:id">
        {() => <ProtectedRoute component={QuotePreview} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/invoices">
        {() => <ProtectedRoute component={Invoices} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/invoice/new">
        {() => <ProtectedRoute component={InvoiceEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/invoice/:id">
        {() => <ProtectedRoute component={InvoiceEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/preview/invoice/:id">
        {() => <ProtectedRoute component={InvoicePreview} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/purchase-orders">
        {() => <ProtectedRoute component={PurchaseOrders} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/purchase-order/new">
        {() => <ProtectedRoute component={POEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/purchase-order/:id">
        {() => <ProtectedRoute component={POEditor} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/preview/po/:id">
        {() => <ProtectedRoute component={POPreview} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} requirePermission="canAccessSettings" />}
      </Route>
      <Route path="/document-themes">
        {() => <ProtectedRoute component={DocumentThemes} requirePermission="canAccessSettings" />}
      </Route>
      <Route path="/theme-editor/new">
        {() => <ProtectedRoute component={ThemeEditor} requirePermission="canAccessSettings" />}
      </Route>
      <Route path="/theme-editor/:id">
        {() => <ProtectedRoute component={ThemeEditor} requirePermission="canAccessSettings" />}
      </Route>
      <Route path="/print/:id">
        {() => <ProtectedRoute component={PrintView} />}
      </Route>
      <Route path="/report/new">
        {() => <ProtectedRoute component={ReportEditor} />}
      </Route>
      <Route path="/report/:id">
        {() => <ProtectedRoute component={ReportEditor} />}
      </Route>
      <Route path="/mobile/sales">
        {() => <ProtectedRoute component={MobileSales} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/mobile/more">
        {() => <ProtectedRoute component={MobileMore} />}
      </Route>
      <Route path="/chat">
        {() => <ProtectedRoute component={Chat} />}
      </Route>
      <Route path="/rflash">
        {() => <ProtectedRoute component={RFlash} requirePermission="canViewFinancials" />}
      </Route>
      <Route path="/crew-dashboard">
        {() => <ProtectedRoute component={CrewDashboard} />}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute component={Billing} requirePermission="canAccessSettings" />}
      </Route>
      <Route path="/admin/organizations">
        {() => <ProtectedRoute component={AdminOrganizations} requirePermission="isAdmin" />}
      </Route>
      <Route path="/feedback">
        {() => <ProtectedRoute component={FeedbackDashboard} requirePermission="isAdmin" />}
      </Route>
      {/* Secure token-based public document view - no auth required */}
      <Route path="/view/doc/:token">
        {() => <PublicDocumentView />}
      </Route>
      {/* Legacy public view routes - redirect to login for security */}
      <Route path="/view/invoice/:id">
        {() => <Redirect to="/auth" />}
      </Route>
      <Route path="/view/quote/:id">
        {() => <Redirect to="/auth" />}
      </Route>
      <Route path="/view/po/:id">
        {() => <Redirect to="/auth" />}
      </Route>
      <Route path="/view/report/:id">
        {() => <Redirect to="/auth" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultAccent="slate" storageKey="sbl-ui-theme">
        <QueryClientProvider client={queryClient}>
          <DeviceProvider>
            <CapacitorProvider>
              <ConnectionAwareWrapper>
                <Toaster />
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <Router />
                </Suspense>
              </ConnectionAwareWrapper>
            </CapacitorProvider>
          </DeviceProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
