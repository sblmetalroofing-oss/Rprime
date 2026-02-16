import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Clock } from "lucide-react";
import type { Job, Quote, Invoice, PurchaseOrder, Customer, Appointment } from "@shared/schema";

interface JobOverviewTabProps {
  job: Job;
  customer: Customer | null;
  quotes: Quote[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  appointments?: Appointment[];
}

export function JobOverviewTab({
  job,
  customer,
  quotes,
  invoices,
  purchaseOrders,
  appointments,
}: JobOverviewTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{job.address || job.suburb || ''}</p>
              </div>
            </div>
            {job.scheduledDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Scheduled Date</p>
                  <p className="text-sm text-muted-foreground">{job.scheduledDate}</p>
                </div>
              </div>
            )}
            {job.scheduledTime && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Time</p>
                  <p className="text-sm text-muted-foreground">{job.scheduledTime}</p>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {job.description && (
              <div>
                <p className="font-medium">Description</p>
                <p className="text-sm text-muted-foreground">{job.description}</p>
              </div>
            )}
            {job.notes && (
              <div>
                <p className="font-medium">Notes</p>
                <p className="text-sm text-muted-foreground">{job.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Job Costing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const quoteTotal = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
              const invoiceTotal = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
              const paidTotal = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
              const materialCost = purchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
              const laborCost = (job.laborHours || 0) * (job.laborRate || 75);
              const totalCost = materialCost + laborCost;
              const profit = paidTotal - totalCost;
              const margin = paidTotal > 0 ? (profit / paidTotal) * 100 : 0;

              return (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Quoted:</div>
                    <div className="text-right font-medium">${quoteTotal.toLocaleString()}</div>
                    
                    <div className="text-muted-foreground">Invoiced:</div>
                    <div className="text-right font-medium">${invoiceTotal.toLocaleString()}</div>
                    
                    <div className="text-muted-foreground">Paid:</div>
                    <div className="text-right font-medium text-green-600">${paidTotal.toLocaleString()}</div>
                  </div>
                  
                  <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Labor ({job.laborHours || 0}h @ ${job.laborRate || 75}/h):</div>
                    <div className="text-right font-medium text-red-600">${laborCost.toLocaleString()}</div>
                    
                    <div className="text-muted-foreground">Materials ({purchaseOrders.length} POs):</div>
                    <div className="text-right font-medium text-red-600">${materialCost.toLocaleString()}</div>
                    
                    <div className="text-muted-foreground font-medium">Total Costs:</div>
                    <div className="text-right font-bold text-red-600">${totalCost.toLocaleString()}</div>
                  </div>
                  
                  <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground font-medium">Profit:</div>
                    <div className={`text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${profit.toLocaleString()}
                    </div>
                    
                    <div className="text-muted-foreground">Margin:</div>
                    <div className={`text-right font-medium ${margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {margin.toFixed(1)}%
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
