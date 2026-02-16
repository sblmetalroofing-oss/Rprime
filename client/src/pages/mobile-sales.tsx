import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/mobile-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, FileText } from "lucide-react";
import { fetchLeads, fetchQuotes, fetchInvoices, fetchPurchaseOrders } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlanLimits } from "@/hooks/use-plan-limits";

const formatCurrency = (amount: number) => '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function StatusRow({ href, dotColor, label, count, total, testId }: {
  href: string;
  dotColor: string;
  label: string;
  count: number;
  total?: number;
  testId: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between p-4 hover:bg-muted/50 active:bg-muted transition-colors min-h-[44px]" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{count}{total !== undefined && total > 0 ? `  ${formatCurrency(total)}` : ''}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function SkeletonSection() {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Card>
        <CardContent className="p-0 divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 min-h-[44px]">
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Skeleton className="w-full mt-3 h-11" />
    </section>
  );
}

export default function MobileSales() {
  const { canViewFinancials } = usePermissions();
  const { features } = usePlanLimits();

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["/api/leads"],
    queryFn: fetchLeads,
    enabled: canViewFinancials,
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: fetchQuotes,
    enabled: canViewFinancials,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: fetchInvoices,
    enabled: canViewFinancials,
  });

  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery({
    queryKey: ["/api/purchase-orders"],
    queryFn: fetchPurchaseOrders,
    enabled: canViewFinancials,
  });

  const isLoading = leadsLoading || quotesLoading || invoicesLoading || posLoading;

  if (!canViewFinancials) {
    return (
      <MobileLayout title="Sales">
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">You don't have permission to view sales information. Contact your manager for access.</p>
        </div>
      </MobileLayout>
    );
  }

  const sumTotal = (items: { total: number }[]) => items.reduce((sum, item) => sum + (item.total || 0), 0);

  const leadsByStage = (stage: string) => leads.filter(l => l.stage === stage);
  const quotesByStatus = (status: string) => quotes.filter(q => q.status === status);
  const invoicesByStatus = (status: string) => invoices.filter(i => i.status === status);
  const posByStatus = (status: string) => purchaseOrders.filter(p => p.status === status);

  if (isLoading) {
    return (
      <MobileLayout title="Sales">
        <div className="p-4 space-y-6">
          <SkeletonSection />
          <SkeletonSection />
          <SkeletonSection />
          <SkeletonSection />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Sales">
      <div className="p-4 space-y-6">
        {features.leads && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Leads</h2>
            <Link href="/leads" className="text-primary text-sm" data-testid="link-leads-see-all">See all</Link>
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              <StatusRow href="/leads" dotColor="bg-yellow-500" label="New" count={leadsByStage("new").length} testId="link-leads-new" />
              <StatusRow href="/leads" dotColor="bg-blue-500" label="Contacted" count={leadsByStage("contacted").length} testId="link-leads-contacted" />
              <StatusRow href="/leads" dotColor="bg-purple-500" label="Qualified" count={leadsByStage("qualified").length} testId="link-leads-qualified" />
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full mt-3 h-11 text-primary border-primary active:scale-95 transition-transform" asChild>
            <Link href="/lead/new" data-testid="button-new-lead">New Lead</Link>
          </Button>
        </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Quotes</h2>
            <Link href="/quotes" className="text-primary text-sm" data-testid="link-quotes-see-all">See all</Link>
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              <StatusRow href="/quotes?status=draft" dotColor="bg-yellow-500" label="Draft" count={quotesByStatus("draft").length} total={sumTotal(quotesByStatus("draft"))} testId="link-quotes-draft" />
              <StatusRow href="/quotes?status=approved" dotColor="bg-green-500" label="Approved" count={quotesByStatus("approved").length} total={sumTotal(quotesByStatus("approved"))} testId="link-quotes-approved" />
              <StatusRow href="/quotes?status=sent" dotColor="bg-blue-500" label="Awaiting Acceptance" count={quotesByStatus("sent").length} total={sumTotal(quotesByStatus("sent"))} testId="link-quotes-sent" />
              <StatusRow href="/quotes?status=accepted" dotColor="bg-green-500" label="Accepted" count={quotesByStatus("accepted").length} total={sumTotal(quotesByStatus("accepted"))} testId="link-quotes-accepted" />
              <StatusRow href="/quotes?status=declined" dotColor="bg-red-500" label="Declined" count={quotesByStatus("declined").length} total={sumTotal(quotesByStatus("declined"))} testId="link-quotes-declined" />
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full mt-3 h-11 text-primary border-primary active:scale-95 transition-transform" asChild>
            <Link href="/quote/new" data-testid="button-new-quote">New Quote</Link>
          </Button>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Invoices</h2>
            <Link href="/invoices" className="text-primary text-sm" data-testid="link-invoices-see-all">See all</Link>
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              <StatusRow href="/invoices?status=draft" dotColor="bg-yellow-500" label="Draft" count={invoicesByStatus("draft").length} total={sumTotal(invoicesByStatus("draft"))} testId="link-invoices-draft" />
              <StatusRow href="/invoices?status=approved" dotColor="bg-green-500" label="Approved" count={invoicesByStatus("approved").length} total={sumTotal(invoicesByStatus("approved"))} testId="link-invoices-approved" />
              <StatusRow href="/invoices?status=sent" dotColor="bg-blue-500" label="Unpaid" count={invoicesByStatus("sent").length} total={sumTotal(invoicesByStatus("sent"))} testId="link-invoices-sent" />
              <StatusRow href="/invoices?status=overdue" dotColor="bg-red-500" label="Overdue" count={invoicesByStatus("overdue").length} total={sumTotal(invoicesByStatus("overdue"))} testId="link-invoices-overdue" />
              <StatusRow href="/invoices?status=paid" dotColor="bg-green-500" label="Paid" count={invoicesByStatus("paid").length} total={sumTotal(invoicesByStatus("paid"))} testId="link-invoices-paid" />
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full mt-3 h-11 text-primary border-primary active:scale-95 transition-transform" asChild>
            <Link href="/invoice/new" data-testid="button-new-invoice">New Invoice</Link>
          </Button>
        </section>

        {features.purchaseOrders && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Purchase Orders</h2>
            <Link href="/purchase-orders" className="text-primary text-sm" data-testid="link-pos-see-all">See all</Link>
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              <StatusRow href="/purchase-orders?status=draft" dotColor="bg-yellow-500" label="Draft" count={posByStatus("draft").length} total={sumTotal(posByStatus("draft"))} testId="link-pos-draft" />
              <StatusRow href="/purchase-orders?status=ordered" dotColor="bg-blue-500" label="Sent" count={posByStatus("ordered").length} total={sumTotal(posByStatus("ordered"))} testId="link-pos-ordered" />
              <StatusRow href="/purchase-orders?status=received" dotColor="bg-green-500" label="Received" count={posByStatus("received").length} total={sumTotal(posByStatus("received"))} testId="link-pos-received" />
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full mt-3 h-11 text-primary border-primary active:scale-95 transition-transform" asChild>
            <Link href="/purchase-orders?newPO=true" data-testid="button-new-po">New PO</Link>
          </Button>
        </section>
        )}
      </div>
    </MobileLayout>
  );
}
