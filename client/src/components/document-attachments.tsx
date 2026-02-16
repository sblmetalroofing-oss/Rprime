import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Paperclip, Upload, Trash2, Download, FileText, Image, File, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import { PhotoDropZone, PhotoTransferData } from "@/hooks/use-photo-transfer.tsx";

interface DocumentAttachmentsProps {
  documentType: 'quote' | 'invoice' | 'purchase_order';
  documentId: string;
  readOnly?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (contentType === 'application/pdf') return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

export function DocumentAttachments({ documentType, documentId, readOnly = false }: DocumentAttachmentsProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<api.DocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { uploadFile } = useUpload();

  const loadAttachments = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const data = await api.fetchDocumentAttachments(documentType, documentId);
    setAttachments(data);
    setLoading(false);
  }, [documentType, documentId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds ${formatFileSize(MAX_FILE_SIZE)}`
        });
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;
    try {
      for (const file of validFiles) {
        const uploadResult = await uploadFile(file);
        if (!uploadResult) continue;

        const attachment = await api.createDocumentAttachment({
          documentType,
          documentId,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          storageKey: uploadResult.objectPath
        });

        if (attachment) {
          setAttachments(prev => [attachment, ...prev]);
          successCount++;
        }
      }
      if (successCount > 0) {
        toast({ title: `${successCount} file${successCount !== 1 ? 's' : ''} uploaded` });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Could not upload all files"
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (attachment: api.DocumentAttachment) => {
    const success = await api.deleteDocumentAttachment(attachment.id);
    if (success) {
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast({ title: "File removed", description: attachment.fileName });
    } else {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not remove file"
      });
    }
  };

  const handleDownload = (attachment: api.DocumentAttachment) => {
    const key = attachment.storageKey.startsWith('/objects') 
      ? attachment.storageKey 
      : `/objects${attachment.storageKey}`;
    window.open(key, '_blank');
  };

  const handlePhotoDrop = async (data: PhotoTransferData) => {
    if (!documentId || readOnly) return;
    
    setUploading(true);
    try {
      const fileName = data.name || 'Dropped Photo.jpg';
      const contentType = data.url.match(/\.(png|gif|webp)$/i) ? `image/${data.url.split('.').pop()}` : 'image/jpeg';
      
      const attachment = await api.createDocumentAttachment({
        documentType,
        documentId,
        fileName,
        contentType,
        fileSize: 0,
        storageKey: data.url.startsWith('/objects') ? data.url.replace('/objects', '') : data.url
      });

      if (attachment) {
        setAttachments(prev => [attachment, ...prev]);
        toast({ title: "Photo added", description: fileName });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to add photo",
        description: "Could not add dropped photo"
      });
    } finally {
      setUploading(false);
    }
  };

  if (!documentId) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <p className="text-sm text-muted-foreground">Save the document first to add attachments</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PhotoDropZone
      onPhotoReceived={handlePhotoDrop}
      className="rounded-lg"
      activeClassName="ring-2 ring-primary ring-offset-2"
    >
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments ({attachments.length})
              {!readOnly && <span className="text-xs text-muted-foreground font-normal">Drop photos here</span>}
            </span>
          {!readOnly && (
            <label>
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                disabled={uploading}
                data-testid="input-attachment-file"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={uploading}
                asChild
              >
                <span>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </span>
              </Button>
            </label>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments yet
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted"
                data-testid={`attachment-${attachment.id}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getFileIcon(attachment.contentType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(attachment)}
                    data-testid={`download-attachment-${attachment.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(attachment)}
                      data-testid={`delete-attachment-${attachment.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </PhotoDropZone>
  );
}
