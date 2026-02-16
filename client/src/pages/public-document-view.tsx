import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { 
  fetchDocumentByToken, 
  type PublicDocumentResponse,
  type QuoteWithItems,
  type InvoiceWithItems,
  type PurchaseOrderWithItems
} from "@/lib/api";
import { Loader2, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuotePreview from "./quote-preview";
import InvoicePreview from "./invoice-preview";
import POPreview from "./po-preview";
import ReportPreview from "./report-preview";

export default function PublicDocumentView() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [document, setDocument] = useState<PublicDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      if (!token) {
        setError("No token provided");
        setLoading(false);
        return;
      }

      try {
        const result = await fetchDocumentByToken(token);
        if (!result) {
          setError("Document not found");
        } else {
          setDocument(result);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Invalid or expired token") {
          setError("This link has expired or is invalid. Please request a new link from the sender.");
        } else {
          setError("Failed to load document. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadDocument();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <CardTitle className="text-xl">Unable to View Document</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")}
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <CardTitle className="text-xl">Document Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">The document you're looking for could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (document.documentType === "quote") {
    return <QuotePreview publicData={document.document as QuoteWithItems} publicToken={token} acceptDeclineEnabled={document.settings?.acceptDeclineEnabled} />;
  }

  if (document.documentType === "invoice") {
    return <InvoicePreview publicData={document.document as InvoiceWithItems} publicToken={token} creditCardEnabled={document.settings?.creditCardEnabled} />;
  }

  if (document.documentType === "purchase_order") {
    return <POPreview publicData={document.document as PurchaseOrderWithItems} />;
  }

  if (document.documentType === "report") {
    return <ReportPreview publicData={document.document as unknown as Parameters<typeof ReportPreview>[0]['publicData']} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
          <CardTitle className="text-xl">Unknown Document Type</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600">This document type is not supported for viewing.</p>
        </CardContent>
      </Card>
    </div>
  );
}
