import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MentionTextarea } from "@/components/mention-textarea";
import { 
  MessageSquare,
  History,
  Send,
  Image,
  Paperclip,
  X,
  File,
  ExternalLink,
} from "lucide-react";
import { DraggablePhoto } from "@/hooks/use-photo-transfer.tsx";
import type { JobStatusHistory, JobActivity } from "@/lib/api";
import type { CrewMember } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface JobActivityTabProps {
  jobId: string;
  statusHistory: JobStatusHistory[];
  activities: JobActivity[];
  crewMembers: CrewMember[];
  currentUserCrewMember: CrewMember | undefined;
  activityFilter: 'all' | 'text' | 'photos' | 'files';
  onActivityFilterChange: (filter: 'all' | 'text' | 'photos' | 'files') => void;
  newNote: string;
  onNewNoteChange: (note: string) => void;
  uploadedFiles: { path: string; name: string; type: string }[];
  onRemoveFile: (index: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
  addingNote: boolean;
  onAddNote: () => Promise<void>;
  onOpenLightbox: (data: { images: { url: string; name: string }[]; currentIndex: number }) => void;
  onOpenFile: (url: string, type?: string, name?: string) => void;
  getCrewMemberByIdOrEmail: (idOrEmail: string | null) => CrewMember | null;
}

export function JobActivityTab({
  jobId,
  statusHistory,
  activities,
  crewMembers,
  currentUserCrewMember,
  activityFilter,
  onActivityFilterChange,
  newNote,
  onNewNoteChange,
  uploadedFiles,
  onRemoveFile,
  onFileSelect,
  isUploading,
  addingNote,
  onAddNote,
  onOpenLightbox,
  onOpenFile,
  getCrewMemberByIdOrEmail,
}: JobActivityTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAttachment = (a: string) => {
    try {
      const parsed = JSON.parse(a);
      return { url: parsed.url || a, name: parsed.name || '', type: parsed.type || '', isLegacy: false };
    } catch { 
      return { url: a, name: '', type: '', isLegacy: true }; 
    }
  };

  const isImageAttachment = (a: string) => {
    const { url, name, type, isLegacy } = parseAttachment(a);
    return type.startsWith('image/') || 
           name.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
           url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
           (isLegacy && url.includes('/objects/'));
  };

  const filteredActivities = activities.filter(activity => {
    if (activityFilter === 'all') return true;
    const hasText = activity.content && activity.content !== '(Attachments)';
    const hasPhotos = activity.attachments?.some(isImageAttachment);
    const hasFiles = activity.attachments?.some(a => !isImageAttachment(a));
    
    if (activityFilter === 'text') return hasText;
    if (activityFilter === 'photos') return hasPhotos;
    if (activityFilter === 'files') return hasFiles;
    return true;
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Status History
          </CardTitle>
          <CardDescription>Track when job status changed</CardDescription>
        </CardHeader>
        <CardContent>
          {statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes recorded yet</p>
          ) : (
            <div className="space-y-4">
              {statusHistory.map((entry) => (
                <div key={entry.id} className="flex gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <div className="w-0.5 h-full bg-border absolute top-3 left-[5px]" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : entry.toStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </p>
                    {entry.note && (
                      <p className="text-sm mt-1">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes & Attachments
          </CardTitle>
          <CardDescription>Add notes, photos, and files to this job</CardDescription>
          <div className="flex gap-1 mt-2">
            <Button 
              variant={activityFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => onActivityFilterChange('all')}
              data-testid="filter-all"
            >
              All
            </Button>
            <Button 
              variant={activityFilter === 'text' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => onActivityFilterChange('text')}
              data-testid="filter-text"
            >
              Text
            </Button>
            <Button 
              variant={activityFilter === 'photos' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => onActivityFilterChange('photos')}
              data-testid="filter-photos"
            >
              Photos
            </Button>
            <Button 
              variant={activityFilter === 'files' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => onActivityFilterChange('files')}
              data-testid="filter-files"
            >
              Files
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <MentionTextarea
              value={newNote}
              onChange={onNewNoteChange}
              users={crewMembers.map(m => ({ id: m.id, name: m.name, color: m.color }))}
              placeholder="Add a note... (type @ to mention someone)"
              className="min-h-[80px]"
              data-testid="input-new-note"
            />
            
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    {file.type.startsWith('image/') ? (
                      <div className="w-20 h-20 rounded border overflow-hidden">
                        <img 
                          src={file.path} 
                          alt={file.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded border flex flex-col items-center justify-center bg-muted p-2">
                        <File className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate w-full text-center mt-1">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="absolute -top-3 -right-3 h-8 w-8 min-h-[44px] min-w-[44px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-file-${index}`}
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileSelect}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                multiple
                data-testid="input-file-upload"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-add-photo"
              >
                <Image className="h-4 w-4 mr-2" aria-hidden="true" />
                {isUploading ? 'Uploading...' : 'Add Photo'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-add-file"
              >
                <Paperclip className="h-4 w-4 mr-2" aria-hidden="true" />
                Add File
              </Button>
            </div>
          </div>
          
          {currentUserCrewMember && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
              <span 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: currentUserCrewMember.color || '#888' }}
              />
              <span className="text-sm text-muted-foreground">
                Posting as <span className="font-medium text-foreground">{currentUserCrewMember.name}</span>
              </span>
            </div>
          )}
          
          <Button 
            onClick={onAddNote} 
            disabled={(newNote.trim() === '' && uploadedFiles.length === 0) || addingNote}
            className="w-full"
            data-testid="button-add-note"
          >
            <Send className="h-4 w-4 mr-2" aria-hidden="true" />
            {addingNote ? 'Saving...' : 'Save Note'}
          </Button>
          
          <div className="space-y-3 mt-4">
            {filteredActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {activityFilter === 'all' ? 'No notes yet' : `No ${activityFilter} found`}
              </p>
            ) : (
              filteredActivities.map((activity) => {
                const crewMember = getCrewMemberByIdOrEmail(activity.createdBy);
                const displayName = crewMember?.name || (activity as JobActivity & { createdByName?: string }).createdByName || activity.createdBy || 'Team Member';
                
                const allImages: { url: string; name: string }[] = [];
                if (activity.attachments) {
                  activity.attachments.forEach((attachment) => {
                    const { url, name, type, isLegacy } = parseAttachment(attachment);
                    const isImage = !isLegacy && (type.startsWith('image/') || 
                                   name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                                   url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                    if (isImage) {
                      allImages.push({ url, name: name || `Photo ${allImages.length + 1}` });
                    }
                  });
                }
                
                return (
                  <div key={activity.id} className="border rounded-lg p-3">
                    {displayName && (
                      <p className="text-sm font-medium mb-1" style={{ color: crewMember?.color || '#888' }}>
                        {displayName}
                      </p>
                    )}
                    {activity.content && activity.content !== '(Attachments)' && (
                      <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                    )}
                    {activity.attachments && activity.attachments.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        {activity.attachments.map((attachment, idx) => {
                          const { url, name, type, isLegacy } = parseAttachment(attachment);
                          const isImage = !isLegacy && (type.startsWith('image/') || 
                                         name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                                         url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                          const isFile = !isLegacy && !isImage;
                          
                          if (isImage) {
                            const imageIndex = Math.max(0, allImages.findIndex(img => img.url === url));
                            return (
                              <DraggablePhoto
                                key={idx}
                                url={url}
                                name={name || `Photo ${idx + 1}`}
                                sourceJobId={jobId}
                              >
                                <button 
                                  onClick={() => onOpenLightbox({ images: allImages, currentIndex: imageIndex })}
                                  className="block cursor-pointer min-h-[44px] w-full"
                                  data-testid={`desktop-photo-thumbnail-${idx}`}
                                  title="Drag to report or quote"
                                >
                                  <div className="aspect-square rounded-lg border overflow-hidden bg-muted relative group">
                                    <img 
                                      src={url} 
                                      alt={name || `Photo ${idx + 1}`} 
                                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                  </div>
                                </button>
                              </DraggablePhoto>
                            );
                          } else if (isFile) {
                            return (
                              <button 
                                key={idx} 
                                onClick={() => onOpenFile(url, type, name)}
                                className="block min-h-[44px]"
                              >
                                <div className="rounded-lg border flex flex-col items-center justify-center bg-muted hover:bg-muted/80 transition p-3">
                                  <File className="h-8 w-8 text-muted-foreground shrink-0" />
                                  <span className="text-xs text-muted-foreground mt-2 truncate max-w-full px-1 text-center">
                                    {name || 'File'}
                                  </span>
                                </div>
                              </button>
                            );
                          } else {
                            return (
                              <button 
                                key={idx} 
                                onClick={() => onOpenFile(url)}
                                className="block min-h-[44px]"
                                data-testid={`desktop-legacy-attachment-${idx}`}
                              >
                                <div className="aspect-square rounded-lg border flex flex-col items-center justify-center bg-muted hover:bg-muted/80 transition">
                                  <ExternalLink className="h-8 w-8 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground mt-2">View</span>
                                </div>
                              </button>
                            );
                          }
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
