import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { MOCK_REPORTS, Report, EstimateItem } from "@/lib/store";
import { formatDateShort, formatDateTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export default function PrintView() {
  const [match, params] = useRoute("/print/:id");
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (params?.id) {
      const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || '[]');
      const existing = savedReports.find((r: Report) => r.id === params.id) || MOCK_REPORTS.find(r => r.id === params.id);
      
      if (existing) {
        setReport(existing);
        // Add a small delay to ensure images load, then print
        setTimeout(() => {
          window.print();
          // Optional: close window after print? No, let user decide.
        }, 1000);
      }
    }
  }, [params?.id]);

  if (!report) return <div className="p-8">Loading report for print...</div>;

  const calculateRowTotal = (item: EstimateItem) => {
    const cost = item.qty * item.unitCost;
    return cost * (1 + item.markup / 100);
  };

  const totalEstimate = report.estimateItems?.reduce((sum: number, item: EstimateItem) => sum + calculateRowTotal(item), 0) || 0;
  const totalGST = totalEstimate * 0.1;
  const grandTotal = totalEstimate + totalGST;

  return (
    <div className="bg-white text-black min-h-screen p-0 m-0 print:p-0">
      <div className="max-w-[210mm] mx-auto bg-white shadow-none">
        {/* Print Header */}
        <div className="p-8 border-b-4 border-slate-800 flex justify-between items-start bg-slate-50">
          <div>
            <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">ROOF INSPECTION REPORT</h1>
            <div className="text-sm text-slate-600">
              <p>Report #{report.id}</p>
              <p>{formatDateShort(new Date())}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-800 text-xl">SBL ROOFING PTY LTD</div>
            <p className="text-sm text-slate-500">ABN: 12 345 678 901</p>
            <p className="text-sm text-slate-500">www.sblroofing.com.au</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="p-8 grid grid-cols-2 gap-8 bg-slate-900 text-white print:bg-slate-900 print:text-white">
          <div>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Customer Details</h3>
            <p className="font-bold text-lg">{report.customerName || "Customer Name"}</p>
            <p className="opacity-90">{report.address}, {report.suburb}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Inspection Details</h3>
            <p className="opacity-90">Inspector: {MOCK_REPORTS[0].inspector}</p>
            <p className="opacity-90">Type: {report.roofType}</p>
            <p className="opacity-90">Weather: Sunny</p>
          </div>
        </div>

        {/* Summary */}
        <div className="p-8">
          <h2 className="text-xl font-bold border-b-2 border-slate-200 pb-2 mb-4 text-slate-800">Executive Summary</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            Based on the visual inspection carried out today, the roof is in <span className="font-bold">fair condition</span> overall. 
            However, there are <span className="font-bold text-red-600">{report.findings?.length || 0} items</span> requiring attention.
            Immediate action is recommended for the issues identified below to prevent water ingress.
          </p>
          
          <h2 className="text-xl font-bold border-b-2 border-slate-200 pb-2 mb-4 text-slate-800 mt-8">Findings & Recommendations</h2>
          <div className="space-y-6">
            {report.findings?.map((f, i) => (
              <div key={i} className="flex gap-4 border-b border-slate-100 pb-6 break-inside-avoid">
                <div className="w-1/3">
                  {f.photoUrl ? (
                    <img src={f.photoUrl} className="w-full rounded border border-slate-200 object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-slate-400 text-sm">No Photo</div>
                  )}
                </div>
                <div className="w-2/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-slate-900">{f.category}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold uppercase", 
                      f.severity === 'critical' ? 'bg-red-100 text-red-700' : 
                      f.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                    )}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2"><span className="font-bold">Issue:</span> {f.description || "No description provided."}</p>
                  <p className="text-sm text-slate-800"><span className="font-bold">Recommendation:</span> {f.recommendation || "No recommendation provided."}</p>
                </div>
              </div>
            ))}
            {(!report.findings || report.findings.length === 0) && (
              <p className="text-slate-500 italic">No specific findings recorded.</p>
            )}
          </div>
          
          {grandTotal > 0 && (
            <div className="mt-8 border-t-2 border-slate-800 pt-4 break-inside-avoid">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Estimated Cost of Works</h2>
                <div className="text-2xl font-bold text-slate-900">${grandTotal.toFixed(2)} <span className="text-sm font-normal text-slate-500">(Inc GST)</span></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This is an estimate only and subject to formal quotation. Valid for 30 days.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 mt-auto border-t text-center text-slate-400 text-sm">
          Generated by SBL Roofing App • {formatDateTime(new Date())}
        </div>
      </div>
    </div>
  );
}