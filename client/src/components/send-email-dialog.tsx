import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Mail, Eye, EyeOff, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type DocumentType = 'quote' | 'invoice' | 'report' | 'purchase_order';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
  documentId: string;
  documentNumber: string;
  recipientEmail?: string;
  recipientName?: string;
  onSuccess?: () => void;
  getPdfBase64?: () => Promise<string>;
}

interface EmailTracking {
  id: string;
  documentType: string;
  documentId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  sentAt: string;
  openedAt?: string;
  openCount?: number;
  lastOpenedAt?: string;
}

async function sendEmail(data: {
  documentType: string;
  documentId: string;
  recipientEmail: string;
  recipientName?: string;
  customMessage?: string;
  includePdf: boolean;
  pdfBase64?: string;
  sendCopyToSender?: boolean;
  senderEmail?: string;
}) {
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send email');
  }
  return response.json();
}

async function fetchEmailHistory(documentType: string, documentId: string): Promise<EmailTracking[]> {
  const response = await fetch(`/api/email/tracking/${documentType}/${documentId}`);
  if (!response.ok) throw new Error('Failed to fetch email history');
  return response.json();
}

export function SendEmailDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  recipientEmail = "",
  recipientName = "",
  onSuccess,
  getPdfBase64,
}: SendEmailDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState(recipientEmail);
  const [name, setName] = useState(recipientName);
  const [customMessage, setCustomMessage] = useState("");
  const [includePdf, setIncludePdf] = useState(true);
  const [sendCopyToSender, setSendCopyToSender] = useState(true);
  const [senderEmail, setSenderEmail] = useState("admin@sblroofing.com.au");

  // Sync email and name when props change (e.g., opening dialog for different document)
  useEffect(() => {
    setEmail(recipientEmail);
    setName(recipientName);
  }, [recipientEmail, recipientName]);

  const { data: emailHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['emailHistory', documentType, documentId],
    queryFn: () => fetchEmailHistory(documentType, documentId),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      let pdfBase64: string | undefined;
      if (includePdf && getPdfBase64) {
        pdfBase64 = await getPdfBase64();
      }
      return sendEmail({
        documentType,
        documentId,
        recipientEmail: email,
        recipientName: name,
        customMessage,
        includePdf,
        pdfBase64,
        sendCopyToSender,
        senderEmail: sendCopyToSender ? senderEmail : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} sent to ${email}`,
      });
      refetchHistory();
      onSuccess?.();
      setCustomMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const documentLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent className="max-w-lg z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send {documentLabel} #{documentNumber}
          </DialogTitle>
          <DialogDescription>
            Send this {documentType} to your customer via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Recipient Name</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal note to the email..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              data-testid="input-message"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sendCopy">Send Copy to Me</Label>
              <p className="text-xs text-muted-foreground">
                Receive a copy of the email sent to customer
              </p>
            </div>
            <Switch
              id="sendCopy"
              checked={sendCopyToSender}
              onCheckedChange={setSendCopyToSender}
              data-testid="switch-send-copy"
            />
          </div>

          {sendCopyToSender && (
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Send copy to</Label>
              <Input
                id="senderEmail"
                type="email"
                placeholder="admin@sblroofing.com.au"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                data-testid="input-sender-email"
              />
            </div>
          )}

          {emailHistory.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Email History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {emailHistory.map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {format(new Date(record.sentAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span className="font-medium">{record.recipientEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.openedAt ? (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-green-500/20 text-green-400">
                          <Eye className="h-3 w-3" />
                          Opened {record.openCount && record.openCount > 1 ? `(${record.openCount}x)` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Not opened
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={() => sendMutation.mutate()}
            disabled={!email || sendMutation.isPending}
            data-testid="button-send-email"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
