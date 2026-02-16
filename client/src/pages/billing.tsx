import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { ArrowLeft, Check, CreditCard, Building2, Clock, Sparkles, Users, FileText, Calendar, Receipt, ExternalLink, Save, XCircle, PlayCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Organization {
  id: string;
  name: string;
  businessName?: string;
  abn?: string;
  email?: string;
  phone?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
}

interface StripeInvoice {
  id: string;
  number?: string;
  created: number;
  amount_due: number;
  status: string;
  hosted_invoice_url?: string;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string };
  }[];
}

export default function Billing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canManageBilling, isLoading: permissionsLoading } = usePermissions();
  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const [orgForm, setOrgForm] = useState({
    name: "",
    businessName: "",
    abn: "",
    email: "",
    phone: "",
    address: "",
    suburb: "",
    state: "",
    postcode: "",
  });
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: canManageBilling,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/billing/products"],
    queryFn: async () => {
      const res = await fetch("/api/billing/products", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: canManageBilling,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["/api/billing/invoices"],
    queryFn: async () => {
      const res = await fetch("/api/billing/invoices", { credentials: 'include' });
      if (!res.ok) return { invoices: [] };
      return res.json();
    },
    enabled: canManageBilling,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: typeof orgForm) => {
      const res = await fetch("/api/billing/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create organization");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({ title: "Business details saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: "Failed to start checkout", variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to create portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: "Failed to open billing portal", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (cancelAtPeriodEnd: boolean = true) => {
      const res = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ cancelAtPeriodEnd }),
      });
      if (!res.ok) throw new Error("Failed to cancel subscription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({ title: "Subscription canceled" });
      setCancelDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to cancel subscription", variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/resume-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to resume subscription");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({ title: "Subscription resumed" });
    },
    onError: () => {
      toast({ title: "Failed to resume subscription", variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) throw new Error("Failed to change plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({ title: "Plan updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to change plan", variant: "destructive" });
    },
  });

  const organization: Organization | null = subscriptionData?.organization;
  const subscription = subscriptionData?.subscription;
  const products: StripeProduct[] = productsData?.products || [];

  useEffect(() => {
    if (organization) {
      setOrgForm({
        name: organization.name || "",
        businessName: organization.businessName || "",
        abn: organization.abn || "",
        email: organization.email || "",
        phone: organization.phone || "",
        address: organization.address || "",
        suburb: organization.suburb || "",
        state: organization.state || "",
        postcode: organization.postcode || "",
      });
    }
  }, [organization?.id]);

  const hasFormChanges = organization ? (
    orgForm.name !== (organization.name || "") ||
    orgForm.businessName !== (organization.businessName || "") ||
    orgForm.abn !== (organization.abn || "") ||
    orgForm.email !== (organization.email || "") ||
    orgForm.phone !== (organization.phone || "") ||
    orgForm.address !== (organization.address || "") ||
    orgForm.suburb !== (organization.suburb || "") ||
    orgForm.state !== (organization.state || "") ||
    orgForm.postcode !== (organization.postcode || "")
  ) : orgForm.name !== "";

  const trialDaysLeft = organization?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 14;

  const getStatusBadge = () => {
    const status = subscription?.status || organization?.subscriptionStatus || "trialing";
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Full Access Trial - {trialDaysLeft} days left</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "canceled":
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanFeatures = (metadata: Record<string, string>) => {
    const features = metadata?.features?.split(",") || [];
    const maxCrew = metadata?.max_crew || "3";
    return { features, maxCrew };
  };

  const featureLabels: Record<string, string> = {
    jobs: "Job Management",
    quotes: "Quotes",
    invoices: "Invoices",
    customers: "Customer CRM",
    reports: "Inspection Reports",
    scheduling: "Advanced Scheduling",
    purchase_orders: "Purchase Orders",
    leads: "Lead Pipeline",
    products: "Product Catalog",
    chat: "Team Chat",
    branding: "Custom Branding",
    api: "API Access",
  };

  if (permissionsLoading || subLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canManageBilling) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          <Card className="border-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
                Access Restricted
              </CardTitle>
              <CardDescription>
                Billing & subscription management is only available to organization owners.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                If you need to make changes to your organization's subscription, please contact your organization admin or business owner.
              </p>
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-6xl mx-auto">
        <Breadcrumb className="mb-4 hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/settings" data-testid="breadcrumb-settings">Settings</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">Billing & Subscription</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Billing & Subscription</h1>
            <p className="text-muted-foreground">Manage your RPrime subscription</p>
          </div>
        </div>

        {success && (
          <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Check className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium">Subscription activated!</p>
                  <p className="text-sm text-muted-foreground">Your 14-day free trial has started with full access to all features.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canceled && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <p className="text-sm">Checkout was canceled. You can try again when you're ready.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Details
              </CardTitle>
              <CardDescription>Your company information for billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Contact Name</Label>
                  <Input
                    id="name"
                    data-testid="input-name"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    data-testid="input-business-name"
                    value={orgForm.businessName}
                    onChange={(e) => setOrgForm({ ...orgForm, businessName: e.target.value })}
                    placeholder="Smith Roofing Pty Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    data-testid="input-abn"
                    value={orgForm.abn}
                    onChange={(e) => setOrgForm({ ...orgForm, abn: e.target.value })}
                    placeholder="12 345 678 901"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    data-testid="input-email"
                    type="email"
                    value={orgForm.email}
                    onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                    placeholder="john@smithroofing.com.au"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    data-testid="input-phone"
                    value={orgForm.phone}
                    onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                    placeholder="0412 345 678"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <AddressAutocomplete
                    data-testid="input-address"
                    value={orgForm.address}
                    onChange={(value) => setOrgForm({ ...orgForm, address: value })}
                    onPlaceSelect={(components) => {
                      setOrgForm(prev => ({
                        ...prev,
                        suburb: components.suburb || prev.suburb,
                        state: components.state || prev.state,
                        postcode: components.postcode || prev.postcode,
                      }));
                    }}
                    placeholder="Start typing an address..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input
                    id="suburb"
                    data-testid="input-suburb"
                    value={orgForm.suburb}
                    onChange={(e) => setOrgForm({ ...orgForm, suburb: e.target.value })}
                    placeholder="Tradeville"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      data-testid="input-state"
                      value={orgForm.state}
                      onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                      placeholder="NSW"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      data-testid="input-postcode"
                      value={orgForm.postcode}
                      onChange={(e) => setOrgForm({ ...orgForm, postcode: e.target.value })}
                      placeholder="2000"
                    />
                  </div>
                </div>
              </div>
              <Button
                data-testid="button-save-business"
                onClick={() => createOrgMutation.mutate(orgForm)}
                disabled={!orgForm.name || createOrgMutation.isPending || (!!organization && !hasFormChanges)}
              >
                <Save className="h-4 w-4 mr-2" />
                {createOrgMutation.isPending ? "Saving..." : organization ? "Save Changes" : "Save Business Details"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
              <CardDescription>Your billing status and plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge()}
              </div>

              {organization?.subscriptionPlan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{organization.subscriptionPlan}</span>
                </div>
              )}

              {organization?.trialEndsAt && !subscription && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trial Ends</span>
                  <span className="font-medium">
                    {formatDateShort(organization.trialEndsAt)}
                  </span>
                </div>
              )}

              {subscription?.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Next Billing</span>
                  <span className="font-medium">
                    {formatDateShort(new Date((subscription.current_period_end as number) * 1000))}
                  </span>
                </div>
              )}

              <Separator />

              {subscription?.cancel_at_period_end && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Subscription Ending</p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Your subscription will end on {formatDateShort(new Date((subscription.current_period_end as number) * 1000))}
                    </p>
                  </div>
                </div>
              )}

              {organization?.stripeCustomerId ? (
                <div className="space-y-2">
                  {subscription?.status === "active" && !subscription?.cancel_at_period_end && (
                    <Button
                      data-testid="button-cancel-subscription"
                      variant="outline"
                      className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={cancelMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  )}
                  {subscription?.status === "active" && subscription?.cancel_at_period_end && (
                    <Button
                      data-testid="button-resume-subscription"
                      variant="outline"
                      className="w-full"
                      onClick={() => resumeMutation.mutate()}
                      disabled={resumeMutation.isPending}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {resumeMutation.isPending ? "Resuming..." : "Resume Subscription"}
                    </Button>
                  )}
                  <Button
                    data-testid="button-manage-billing"
                    variant="outline"
                    className="w-full"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Billing
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Complete your business details and choose a plan to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-semibold mt-10 mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Choose Your Plan
        </h2>

        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Plans Coming Soon</h3>
              <p className="text-muted-foreground">
                Subscription plans are being set up. Check back shortly!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((product) => {
              const price = product.prices[0];
              const { features, maxCrew } = getPlanFeatures(product.metadata);
              const isCurrentPlan = organization?.subscriptionPlan === product.metadata?.plan_type;

              return (
                <Card
                  key={product.id}
                  className={`relative ${isCurrentPlan ? "border-primary ring-2 ring-primary" : ""}`}
                >
                  {isCurrentPlan && (
                    <Badge className="absolute -top-2 left-4 bg-primary">Current Plan</Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {price && (
                      <div className="text-3xl font-bold">
                        ${(price.unit_amount / 100).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{price.recurring?.interval || "month"}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{maxCrew === "unlimited" ? "Unlimited" : `Up to ${maxCrew}`} crew members</span>
                    </div>

                    <Separator />

                    <ul className="space-y-2">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {featureLabels[feature] || feature}
                        </li>
                      ))}
                    </ul>

                    {!isCurrentPlan && price && (
                      <Button
                        data-testid={`button-select-${product.metadata?.plan_type || product.id}`}
                        className="w-full"
                        onClick={() => {
                          if (subscription?.status === "active") {
                            changePlanMutation.mutate(price.id);
                          } else {
                            checkoutMutation.mutate(price.id);
                          }
                        }}
                        disabled={checkoutMutation.isPending || changePlanMutation.isPending || !organization}
                      >
                        {!organization 
                          ? "Save Details First" 
                          : subscription?.status === "active"
                            ? "Switch to This Plan"
                            : organization?.subscriptionStatus === "trialing"
                              ? "Start This Plan"
                              : "Start 14-Day Free Trial"}
                      </Button>
                    )}

                    {isCurrentPlan && (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Current Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Invoice History */}
        {invoicesData?.invoices?.length > 0 && (
          <Card className="mt-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice History
              </CardTitle>
              <CardDescription>Your past invoices and payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesData.invoices.map((invoice: StripeInvoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number || invoice.id.slice(-8)}</TableCell>
                      <TableCell>{formatDateShort(new Date(invoice.created * 1000))}</TableCell>
                      <TableCell>${(invoice.amount_due / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.hosted_invoice_url && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(invoice.hosted_invoice_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className="mt-10">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">14-Day Full Access Trial</h3>
                  <p className="text-sm text-muted-foreground">
                    Try all features risk-free. No credit card required to start.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Cancel Anytime</h3>
                  <p className="text-sm text-muted-foreground">
                    No lock-in contracts. Cancel your subscription whenever you need.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate(true)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Canceling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
