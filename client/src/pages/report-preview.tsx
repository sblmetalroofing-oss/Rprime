import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FileText, MapPin, Calendar, User, Phone, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";

interface Finding {
  id: string;
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
}

interface ReportData {
  id: string;
  customerName: string;
  contactPhone?: string;
  address: string;
  suburb: string;
  date: string;
  inspector: string;
  status: string;
  roofType: string;
  measurements?: Record<string, unknown>;
  findings?: Finding[];
  themeId?: string | null;
}

interface ReportPreviewProps {
  publicData?: ReportData;
}

function getSeverityBadge(severity: string) {
  const severityLower = severity.toLowerCase();
  switch (severityLower) {
    case "critical":
      return (
        <Badge className="bg-red-600 text-white hover:bg-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Critical
        </Badge>
      );
    case "high":
      return (
        <Badge className="bg-orange-500 text-white hover:bg-orange-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          High
        </Badge>
      );
    case "medium":
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
          <Info className="h-3 w-3 mr-1" />
          Medium
        </Badge>
      );
    case "low":
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Low
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {severity}
        </Badge>
      );
  }
}

export default function ReportPreview({ publicData }: ReportPreviewProps) {
  const report: ReportData = publicData || {} as ReportData;
  const findings = report.findings || [];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Not specified";
    try {
      return format(new Date(dateStr), "MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatStatus = (status: string | null | undefined) => {
    if (!status) return "Draft";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getReportId = () => {
    if (!report.id) return "N/A";
    return report.id.slice(-8).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl">Roof Inspection Report</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Report ID: {getReportId()}
                  </p>
                </div>
              </div>
              <Badge variant={report.status === "completed" ? "default" : "secondary"} className="text-sm">
                {formatStatus(report.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Customer</h3>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {report.customerName || "Not specified"}
                  </p>
                </div>
                {report.contactPhone && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Contact</h3>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {report.contactPhone}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Property Address</h3>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {report.address || "Not specified"}{report.suburb ? `, ${report.suburb}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Inspection Date</h3>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(report.date)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Inspector</h3>
                  <p>{report.inspector || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Roof Type</h3>
                  <p>{report.roofType || "Not specified"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Inspection Findings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {findings.length} issue{findings.length !== 1 ? "s" : ""} identified
            </p>
          </CardHeader>
          <CardContent>
            {findings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No issues were found during this inspection.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {findings.map((finding: Finding, index: number) => (
                  <div key={finding.id || index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                        <Badge variant="outline">{finding.category || "General"}</Badge>
                        {getSeverityBadge(finding.severity || "medium")}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                        <p className="text-sm">{finding.description || "No description provided"}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Recommendation</h4>
                        <p className="text-sm">{finding.recommendation || "No recommendation provided"}</p>
                      </div>
                      
                      {(finding.photoUrls && finding.photoUrls.length > 0) || finding.photoUrl ? (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Photos</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {(finding.photoUrls || (finding.photoUrl ? [finding.photoUrl] : [])).map((url: string, photoIndex: number) => (
                              <a
                                key={photoIndex}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={url}
                                  alt={`Finding ${index + 1} photo ${photoIndex + 1}`}
                                  className="w-full h-32 object-cover rounded-md border hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>This is a read-only view of the inspection report.</p>
          <p>For questions, please contact the sender.</p>
        </div>
      </div>
    </div>
  );
}
