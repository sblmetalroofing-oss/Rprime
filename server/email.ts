// Resend email integration with tracking support
import { Resend } from 'resend';

interface EmailAttachment {
  filename: string;
  content: string;
}

interface ResendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
  attachments?: EmailAttachment[];
}

export async function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  // Use custom from email if set, otherwise use Resend's default testing email
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

interface DocumentAttachment {
  filename: string;
  content: string; // base64 encoded
}

interface SendDocumentEmailParams {
  to: string;
  recipientName: string;
  documentType: 'quote' | 'invoice' | 'report' | 'purchase_order';
  documentNumber: string;
  documentId: string;
  trackingToken: string;
  viewLink: string;
  includeAttachment?: boolean;
  pdfBase64?: string;
  customMessage?: string;
  sendCopyToSender?: boolean;
  senderEmail?: string;
  additionalAttachments?: DocumentAttachment[];
  organizationName?: string;
}

export async function sendDocumentEmail(params: SendDocumentEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const documentTypeLabels: Record<typeof params.documentType, string> = {
      quote: 'Quote',
      invoice: 'Invoice',
      report: 'Inspection Report',
      purchase_order: 'Purchase Order'
    };
    
    const docLabel = documentTypeLabels[params.documentType];
    const orgName = params.organizationName || 'RPrime Roofing';
    const subject = `${orgName} - ${docLabel} #${params.documentNumber}`;
    
    const formattedFrom = params.organizationName ? `"${params.organizationName}" <${fromEmail}>` : fromEmail;
    
    const baseUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : '');
    const trackingPixelUrl = `${baseUrl}/api/email/track/${params.trackingToken}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #3e4f61; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${orgName}</h1>
          </div>
          
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Dear ${params.recipientName || 'Valued Customer'},
            </p>
            
            ${params.customMessage ? `<p style="font-size: 16px; color: #333; margin-bottom: 24px;">${params.customMessage}</p>` : ''}
            
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Please find your ${docLabel} <strong>#${params.documentNumber}</strong> attached to this email.
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 32px;">
              If you have any questions about this ${docLabel.toLowerCase()}, please don't hesitate to contact us.
            </p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              ${orgName}
            </p>
          </div>
        </div>
        <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
      </body>
      </html>
    `;
    
    const emailOptions: ResendEmailOptions = {
      from: formattedFrom,
      to: params.to,
      subject: subject,
      html: htmlContent,
      ...(params.senderEmail && { reply_to: params.senderEmail }),
    };
    
    // Build attachments array
    const attachments: Array<{ filename: string; content: string }> = [];
    
    // Add main PDF if included
    if (params.includeAttachment && params.pdfBase64) {
      attachments.push({
        filename: `${docLabel}_${params.documentNumber}.pdf`,
        content: params.pdfBase64,
      });
    }
    
    // Add additional document attachments
    if (params.additionalAttachments && params.additionalAttachments.length > 0) {
      for (const att of params.additionalAttachments) {
        attachments.push({
          filename: att.filename,
          content: att.content,
        });
      }
    }
    
    if (attachments.length > 0) {
      emailOptions.attachments = attachments;
    }
    
    const { data, error } = await client.emails.send(emailOptions);
    
    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }
    
    // Send copy to sender if requested
    if (params.sendCopyToSender && params.senderEmail) {
      const copyHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background-color: #3e4f61; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${orgName}</h1>
            </div>
            
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 16px; font-weight: bold;">
                Copy of ${docLabel} sent to customer
              </p>
              
              <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="font-size: 14px; color: #666; margin: 0;">
                  <strong>Sent to:</strong> ${params.recipientName} (${params.to})<br>
                  <strong>${docLabel} #:</strong> ${params.documentNumber}
                </p>
              </div>
              
              ${params.customMessage ? `<p style="font-size: 14px; color: #666; margin-bottom: 16px;"><strong>Your message:</strong><br>${params.customMessage}</p>` : ''}
              
              <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
                Below is a copy of the email sent to your customer:
              </p>
              
              <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #fafafa;">
                <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
                  Dear ${params.recipientName || 'Valued Customer'},
                </p>
                
                <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
                  Please find your ${docLabel} <strong>#${params.documentNumber}</strong> attached to this email.
                </p>
              </div>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 14px; color: #666; margin: 0;">
                This is a copy of the email sent to your customer.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const copyEmailOptions: ResendEmailOptions = {
        from: formattedFrom,
        to: params.senderEmail,
        subject: `[Copy] ${subject} - Sent to ${params.to}`,
        html: copyHtmlContent,
      };
      
      // Include same attachments for copy email
      if (attachments.length > 0) {
        copyEmailOptions.attachments = attachments;
      }
      
      // Send copy (don't fail if this fails, main email was already sent)
      try {
        await client.emails.send(copyEmailOptions);
      } catch (copyError) {
        console.error('Failed to send copy email:', copyError);
      }
    }
    
    return { success: true };
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return { success: false, error: message };
  }
}
