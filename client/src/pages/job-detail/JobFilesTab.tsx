import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderOpen, Image, File, ExternalLink } from "lucide-react";
import type { JobActivity } from "@/lib/api";

interface JobFilesTabProps {
  activities: JobActivity[];
  onOpenLightbox: (data: { images: { url: string; name: string }[]; currentIndex: number }) => void;
}

export function JobFilesTab({ activities, onOpenLightbox }: JobFilesTabProps) {
  const parseAttachment = (a: string) => {
    try {
      const parsed = JSON.parse(a);
      return { url: parsed.url || a, name: parsed.name || '', type: parsed.type || '', isLegacy: false };
    } catch { return { url: a, name: '', type: '', isLegacy: true }; }
  };
  
  const allFiles: { url: string; name: string; type: string; source: string; date: string }[] = [];
  
  activities.forEach(activity => {
    if (!activity.attachments || activity.attachments.length === 0) return;
    
    activity.attachments.forEach((att) => {
      const { url, name, type, isLegacy } = parseAttachment(att);
      if (url) {
        const isImage = type.startsWith('image/') || 
                       /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || 
                       /\.(jpg|jpeg|png|gif|webp)$/i.test(url) ||
                       (isLegacy && url.includes('/objects/'));
        allFiles.push({
          url,
          name: name || url.split('/').pop() || 'File',
          type: isImage ? 'image/jpeg' : (type || 'file'),
          source: 'Activity',
          date: activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''
        });
      }
    });
  });

  if (allFiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Job Files
          </CardTitle>
          <CardDescription>
            All files and documents attached to this job
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No files attached to this job yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Files added through activity notes will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const imageFiles = allFiles.filter(f => f.type?.startsWith('image/'));
  const otherFiles = allFiles.filter(f => !f.type?.startsWith('image/'));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Job Files
        </CardTitle>
        <CardDescription>
          All files and documents attached to this job
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {imageFiles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Image className="h-4 w-4" />
                Photos ({imageFiles.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {imageFiles.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOpenLightbox({
                      images: imageFiles.map(f => ({ url: f.url, name: f.name })),
                      currentIndex: idx
                    })}
                    className="aspect-square rounded-lg border overflow-hidden bg-muted relative group"
                    data-testid={`files-photo-${idx}`}
                  >
                    <img 
                      src={file.url} 
                      alt={file.name} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {otherFiles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <File className="h-4 w-4" />
                Documents ({otherFiles.length})
              </h4>
              <div className="space-y-2">
                {otherFiles.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                    data-testid={`files-document-${idx}`}
                  >
                    <File className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.source} • {file.date}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
