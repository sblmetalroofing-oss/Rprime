import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { MobileLayout } from "@/components/mobile-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { 
  Hash, 
  Plus, 
  Send, 
  Image, 
  Camera,
  MessageCircle,
  Users,
  Menu,
  ChevronLeft,
  ChevronUp,
  MoreVertical,
  Pin,
  Bell,
  BellOff,
  X,
  ZoomIn,
  ChevronRight,
  Download,
  Loader2
} from "lucide-react";
import { formatRelativeDateTime } from "@/lib/date-utils";
import { 
  fetchChatChannels, 
  fetchChatMessages, 
  createChatMessage, 
  createChatChannel,
  fetchCrewMembers,
  fetchDMConversations,
  fetchDirectMessages,
  createDirectMessage,
  updateChatMessage,
  deleteChatMessage,
  markChannelRead,
  markDMsRead,
  getChannelUnreadCount,
  getDMUnreadCount
} from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Check } from "lucide-react";
import { useChatWebSocket } from "@/hooks/use-chat-websocket";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { ChatChannel, ChatMessage, CrewMember, DirectMessage } from "@shared/schema";
import { FeatureGate } from "@/components/feature-gate";

function formatMessageDate(dateStr: string | Date): string {
  return formatRelativeDateTime(dateStr);
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function ChannelSidebar({ 
  channels, 
  selectedChannel, 
  onSelectChannel,
  onNewChannel,
  crewMembers,
  onSelectDM,
  selectedDM,
  currentUserId,
  channelUnreadCounts,
  dmUnreadCounts
}: { 
  channels: ChatChannel[];
  selectedChannel: string | null;
  onSelectChannel: (id: string | null) => void;
  onNewChannel: () => void;
  crewMembers: CrewMember[];
  onSelectDM: (crewMemberId: string | null) => void;
  selectedDM: string | null;
  currentUserId: string | null;
  channelUnreadCounts: Record<string, number>;
  dmUnreadCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-col h-full bg-muted/30 backdrop-blur-xl">
      <div className="p-4 sm:p-6 border-b border-border/50">
        <h2 className="font-bold text-foreground text-xl tracking-tight">Crew Chat</h2>
      </div>
      
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-6 py-6">
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Channels</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all" 
                onClick={onNewChannel}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="space-y-0.5">
              {channels.map(channel => {
                const unreadCount = channelUnreadCounts[channel.id] || 0;
                return (
                  <button
                    key={channel.id}
                    onClick={() => {
                      onSelectChannel(channel.id);
                      onSelectDM(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 group relative",
                      selectedChannel === channel.id && !selectedDM
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Hash className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      selectedChannel === channel.id && !selectedDM ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate text-sm font-semibold flex-1">{channel.name}</span>
                    {unreadCount > 0 && selectedChannel !== channel.id && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {selectedChannel === channel.id && !selectedDM && (
                      <div className="absolute left-0 w-1 h-4 bg-primary-foreground rounded-full opacity-50" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div>
            <div className="flex items-center px-3 mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Direct Messages</span>
            </div>
            
            <div className="space-y-0.5">
              {crewMembers.filter(m => m.id !== currentUserId).map(member => {
                const unreadCount = dmUnreadCounts[member.id] || 0;
                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      onSelectDM(member.id);
                      onSelectChannel(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 group relative",
                      selectedDM === member.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div 
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: member.color || '#6366f1' }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <span className="truncate text-sm font-semibold flex-1">{member.name}</span>
                    {unreadCount > 0 && selectedDM !== member.id && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function PhotoLightbox({ 
  images, 
  initialIndex, 
  onClose 
}: { 
  images: string[]; 
  initialIndex: number; 
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentUrl = images[currentIndex];
  
  const normalizedUrl = currentUrl?.includes('/api/object-storage/public/') 
    ? currentUrl.replace('/api/object-storage/public/', '/').replace('//', '/')
    : currentUrl;

  const goNext = () => setCurrentIndex((i) => (i + 1) % images.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="h-6 w-6 text-white" />
      </button>
      
      {images.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <ChevronLeft className="h-8 w-8 text-white" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <ChevronRight className="h-8 w-8 text-white" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
      
      <img 
        src={normalizedUrl}
        alt="Full size"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ChatImage({ 
  url, 
  className,
  onClick 
}: { 
  url: string; 
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  if (failed || !url || !url.trim()) return null;
  
  const normalizedUrl = url.includes('/api/object-storage/public/') 
    ? url.replace('/api/object-storage/public/', '/').replace('//', '/')
    : url;
  
  return (
    <div 
      className={cn(
        "relative cursor-pointer group overflow-hidden rounded-xl",
        !loaded && "opacity-0 h-0"
      )}
      onClick={onClick}
    >
      <img 
        src={normalizedUrl} 
        alt="Attachment" 
        className={cn(
          className, 
          "transition-transform duration-200 group-hover:scale-[1.02]"
        )}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
      </div>
    </div>
  );
}

function MessageList({ 
  messages, 
  isLoading,
  onLoadMore,
  hasMore,
  isLoadingMore,
  currentUserId,
  onEditMessage,
  onDeleteMessage
}: { 
  messages: (ChatMessage | DirectMessage)[];
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  currentUserId?: string | null;
  onEditMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };
  
  const closeLightbox = () => {
    setLightboxImages(null);
    setLightboxIndex(0);
  };
  
  const startEditing = (msg: ChatMessage | DirectMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };
  
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };
  
  const saveEdit = () => {
    if (editingMessageId && editContent.trim() && onEditMessage) {
      onEditMessage(editingMessageId, editContent.trim());
    }
    cancelEditing();
  };
  
  const confirmDelete = () => {
    if (deleteMessageId && onDeleteMessage) {
      onDeleteMessage(deleteMessageId);
    }
    setDeleteMessageId(null);
  };
  
  useEffect(() => {
    if (isLoadingMore) {
      isLoadingMoreRef.current = true;
    }
  }, [isLoadingMore]);
  
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        if (isLoadingMoreRef.current) {
          isLoadingMoreRef.current = false;
        } else {
          setTimeout(() => {
            scrollArea.scrollTop = scrollArea.scrollHeight;
          }, 50);
        }
      }
    }
  }, [messages]);
  
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-full max-w-[280px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground px-6">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium text-foreground">No messages yet</p>
          <p className="text-base mt-1">Be the first to say something!</p>
        </div>
      </div>
    );
  }
  
  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="px-4 py-3 space-y-1">
        {hasMore && onLoadMore && (
          <div className="flex justify-center py-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="h-10 px-4 text-sm"
              data-testid="button-load-earlier"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Load earlier messages
                </>
              )}
            </Button>
          </div>
        )}
        {messages.map((msg, i) => {
          const showHeader = i === 0 || 
            messages[i - 1].senderId !== msg.senderId ||
            new Date(msg.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 300000;
          
          const senderColor = 'senderColor' in msg && msg.senderColor ? msg.senderColor : '#6366f1';
          const isOwnMessage = currentUserId && msg.senderId === currentUserId;
          const isEditing = editingMessageId === msg.id;
          const isEdited = 'isEdited' in msg && msg.isEdited;
          
          // Render message content (either edit mode or display mode)
          const renderMessageContent = () => {
            const hasOnlyImages = msg.content === '📷' && 'imageUrls' in msg && msg.imageUrls && msg.imageUrls.length > 0;
            
            if (isEditing) {
              return (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    ref={editInputRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    className="flex-1 h-10"
                    data-testid="input-edit-message"
                  />
                  <Button 
                    size="sm" 
                    onClick={saveEdit} 
                    className="h-10 w-10 p-0"
                    data-testid="button-save-edit"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={cancelEditing} 
                    className="h-10 w-10 p-0"
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            }
            
            return (
              <>
                {!hasOnlyImages && (
                  <p className="text-foreground/90 break-words text-base leading-relaxed mt-1">
                    {msg.content}
                    {isEdited && <span className="text-xs text-muted-foreground ml-2">(edited)</span>}
                  </p>
                )}
                {'imageUrls' in msg && msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {msg.imageUrls.map((url: string, idx: number) => (
                      <ChatImage 
                        key={idx} 
                        url={url} 
                        className="max-w-[280px] max-h-[280px] object-cover shadow-lg"
                        onClick={() => openLightbox(msg.imageUrls as string[], idx)}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          };
          
          // Render the actions dropdown (only for own messages)
          const renderActions = () => {
            if (!isOwnMessage || isEditing) return null;
            
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    data-testid={`button-message-actions-${msg.id}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => startEditing(msg)}
                    className="h-11 text-base"
                    data-testid={`button-edit-message-${msg.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDeleteMessageId(msg.id)}
                    className="h-11 text-base text-destructive focus:text-destructive"
                    data-testid={`button-delete-message-${msg.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          };
          
          return (
            <div key={msg.id} className={cn("group py-1.5", !showHeader && "ml-[60px]")}>
              {showHeader ? (
                <div className="flex items-start gap-4">
                  <div 
                    className="h-12 w-12 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
                    style={{ backgroundColor: senderColor }}
                  >
                    {getInitials(msg.senderName)}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        className="font-semibold text-lg"
                        style={{ color: senderColor }}
                      >
                        {msg.senderName}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">{formatMessageDate(msg.createdAt)}</span>
                      {'isPinned' in msg && msg.isPinned && (
                        <Pin className="h-4 w-4 text-yellow-600" />
                      )}
                      <div className="flex-1" />
                      {renderActions()}
                    </div>
                    {renderMessageContent()}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {renderMessageContent()}
                  </div>
                  {renderActions()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {lightboxImages && (
        <PhotoLightbox 
          images={lightboxImages} 
          initialIndex={lightboxIndex} 
          onClose={closeLightbox} 
        />
      )}
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

function MessageInput({ 
  onSend, 
  channelName,
  isSending,
  canSend = true
}: { 
  onSend: (content: string, imageUrls?: string[]) => void;
  channelName: string;
  isSending: boolean;
  canSend?: boolean;
}) {
  if (!canSend) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground">
        <p className="text-sm">You need to be added as a crew member to send messages.</p>
        <p className="text-xs mt-1">Ask an admin to add your email to the crew list.</p>
      </div>
    );
  }
  const [message, setMessage] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const uploadedUrls: string[] = [];
    
    for (const file of Array.from(files)) {
      try {
        const response = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "image/jpeg",
          }),
        });
        
        if (!response.ok) throw new Error("Failed to get upload URL");
        
        const { uploadURL, objectPath } = await response.json();
        
        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "image/jpeg" },
        });
        
        const publicUrl = objectPath.startsWith('/') ? objectPath : `/${objectPath}`;
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    }
    
    if (uploadedUrls.length > 0) {
      setPendingImages(prev => [...prev, ...uploadedUrls]);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || pendingImages.length > 0) && !isSending && !isUploading) {
      onSend(message.trim() || "📷", pendingImages.length > 0 ? pendingImages : undefined);
      setMessage("");
      setPendingImages([]);
    }
  };
  
  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border bg-background">
      {pendingImages.length > 0 && (
        <div className="flex gap-3 mb-3 flex-wrap">
          {pendingImages.map((url, index) => (
            <div key={index} className="relative">
              <img src={url} alt="Pending" className="h-20 w-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 h-7 w-7 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground text-sm font-bold shadow-lg min-h-[28px] min-w-[28px]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 bg-muted rounded-2xl px-4 py-3 min-h-[56px]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground active:scale-95 transition-transform min-h-[44px] min-w-[44px] shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid="button-attach-image"
        >
          {isUploading ? (
            <div className="h-6 w-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Image className="h-6 w-6" />
          )}
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message #${channelName}`}
          className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-foreground placeholder:text-muted-foreground text-base h-11 min-h-[44px]"
          data-testid="input-message"
        />
        <Button 
          type="submit" 
          variant="ghost" 
          size="sm" 
          className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground active:scale-95 transition-transform min-h-[44px] min-w-[44px] shrink-0 disabled:opacity-30"
          disabled={(!message.trim() && pendingImages.length === 0) || isSending || isUploading}
          data-testid="button-send-message"
        >
          <Send className="h-6 w-6" />
        </Button>
      </div>
    </form>
  );
}

function NotificationPopup({
  isSupported,
  isSubscribed,
  isLoading,
  onSubscribe
}: {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  onSubscribe: () => Promise<boolean>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(() => 
    typeof Notification !== 'undefined' && Notification.permission === 'denied'
  );
  
  // Check if we should show based on localStorage
  const shouldShow = () => {
    if (!isSupported || isSubscribed || dismissed) return false;
    const lastDismissed = localStorage.getItem('notification_banner_dismissed');
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed, 10);
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneDayMs) return false;
    }
    return true;
  };
  
  if (!shouldShow()) return null;
  
  const handleEnable = async () => {
    setIsRequesting(true);
    const success = await onSubscribe();
    setIsRequesting(false);
    if (!success && Notification.permission === 'denied') {
      setIsBlocked(true);
    }
  };
  
  const handleDismiss = () => {
    localStorage.setItem('notification_banner_dismissed', Date.now().toString());
    setDismissed(true);
  };
  
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`rounded-xl shadow-lg border p-4 ${isBlocked ? 'bg-amber-950 border-amber-800' : 'bg-zinc-900 border-zinc-700'}`}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 rounded-full p-2 ${isBlocked ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
            {isBlocked ? (
              <BellOff className="h-5 w-5 text-amber-500" />
            ) : (
              <Bell className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isBlocked ? (
              <>
                <p className="font-medium text-sm text-foreground">Notifications blocked</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tap the lock icon in your browser to enable notifications.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-sm text-foreground">Enable notifications</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when your team sends messages.
                </p>
              </>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
                data-testid="button-not-now"
              >
                {isBlocked ? 'Dismiss' : 'Not now'}
              </Button>
              {!isBlocked && (
                <Button
                  size="sm"
                  className="h-8 px-4 text-xs"
                  onClick={handleEnable}
                  disabled={isRequesting || isLoading}
                  data-testid="button-enable-notifications"
                >
                  {isRequesting || isLoading ? (
                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Enable"
                  )}
                </Button>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            data-testid="button-close-popup"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewChannelDialog({ 
  open, 
  onOpenChange,
  onCreateChannel
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel: (name: string, description?: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateChannel(name.trim().toLowerCase().replace(/\s+/g, '-'), description.trim() || undefined);
      setName("");
      setDescription("");
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">Create Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400">Channel Name</label>
            <div className="flex items-center gap-2 mt-1">
              <Hash className="h-4 w-4 text-zinc-500" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="bg-zinc-800 border-zinc-700"
                data-testid="input-channel-name"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-400">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="bg-zinc-800 border-zinc-700 mt-1"
              data-testid="input-channel-description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()} data-testid="button-create-channel">
              Create Channel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Chat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timeout: NodeJS.Timeout }>>(new Map());
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGE_LIMIT = 50;
  
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['/api/chat/channels'],
    queryFn: fetchChatChannels
  });
  
  const { data: crewMembers = [] } = useQuery({
    queryKey: ['/api/crew-members'],
    queryFn: fetchCrewMembers
  });
  
  const currentCrewMember = crewMembers.find(m => 
    m.email && user?.email && m.email.toLowerCase() === user.email.toLowerCase()
  );
  
  const [channelUnreadCounts, setChannelUnreadCounts] = useState<Record<string, number>>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (!currentCrewMember?.id || channels.length === 0) return;
    
    const fetchChannelUnreads = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        channels.map(async (channel) => {
          const count = await getChannelUnreadCount(channel.id, currentCrewMember.id);
          counts[channel.id] = count;
        })
      );
      setChannelUnreadCounts(counts);
    };
    
    fetchChannelUnreads();
  }, [channels, currentCrewMember?.id]);
  
  useEffect(() => {
    if (!currentCrewMember?.id || crewMembers.length === 0) return;
    
    const fetchDMUnreads = async () => {
      const counts: Record<string, number> = {};
      const otherMembers = crewMembers.filter(m => m.id !== currentCrewMember.id);
      await Promise.all(
        otherMembers.map(async (member) => {
          const count = await getDMUnreadCount(member.id, currentCrewMember.id);
          counts[member.id] = count;
        })
      );
      setDmUnreadCounts(counts);
    };
    
    fetchDMUnreads();
  }, [crewMembers, currentCrewMember?.id]);
  
  useEffect(() => {
    if (!currentCrewMember?.id) return;
    
    if (selectedChannel && !selectedDM) {
      markChannelRead(selectedChannel, currentCrewMember.id).then(() => {
        setChannelUnreadCounts(prev => ({ ...prev, [selectedChannel]: 0 }));
      });
    }
  }, [selectedChannel, selectedDM, currentCrewMember?.id]);
  
  useEffect(() => {
    if (!currentCrewMember?.id || !selectedDM) return;
    
    markDMsRead(selectedDM, currentCrewMember.id).then(() => {
      setDmUnreadCounts(prev => ({ ...prev, [selectedDM]: 0 }));
    });
  }, [selectedDM, currentCrewMember?.id]);
  
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications({
    crewMemberId: currentCrewMember?.id || null
  });
  
  const handleNewMessage = useCallback((message: ChatMessage) => {
    queryClient.setQueryData<ChatMessage[]>(
      ['/api/chat/messages', message.channelId],
      (old = []) => {
        if (old.some(m => m.id === message.id)) return old;
        return [...old, message];
      }
    );
    
    if (message.channelId !== selectedChannel && message.senderId !== currentCrewMember?.id) {
      setChannelUnreadCounts(prev => ({
        ...prev,
        [message.channelId]: (prev[message.channelId] || 0) + 1
      }));
    }
  }, [queryClient, selectedChannel, currentCrewMember?.id]);
  
  const handleNewDM = useCallback((dm: DirectMessage) => {
    if (currentCrewMember) {
      const otherUserId = dm.senderId === currentCrewMember.id ? dm.recipientId : dm.senderId;
      
      queryClient.setQueryData<DirectMessage[]>(
        ['/api/chat/dm', currentCrewMember.id, otherUserId],
        (old = []) => {
          if (old.some(m => m.id === dm.id)) return old;
          return [...old, dm];
        }
      );
      
      if (dm.senderId !== selectedDM && dm.senderId !== currentCrewMember.id) {
        setDmUnreadCounts(prev => ({
          ...prev,
          [dm.senderId]: (prev[dm.senderId] || 0) + 1
        }));
      }
    }
  }, [queryClient, currentCrewMember, selectedDM]);
  
  const handleTyping = useCallback((data: { channelId: string; crewMemberId: string; name: string; isTyping: boolean }) => {
    if (data.crewMemberId !== currentCrewMember?.id) {
      setTypingUsers(prev => {
        const next = new Map(prev);
        if (data.isTyping) {
          const existing = next.get(data.crewMemberId);
          if (existing) clearTimeout(existing.timeout);
          const timeout = setTimeout(() => {
            setTypingUsers(p => {
              const n = new Map(p);
              n.delete(data.crewMemberId);
              return n;
            });
          }, 3000);
          next.set(data.crewMemberId, { name: data.name, timeout });
        } else {
          const existing = next.get(data.crewMemberId);
          if (existing) clearTimeout(existing.timeout);
          next.delete(data.crewMemberId);
        }
        return next;
      });
    }
  }, [currentCrewMember?.id]);
  
  const { isConnected, joinChannel, leaveChannel, sendTyping } = useChatWebSocket({
    crewMemberId: currentCrewMember?.id || null,
    onNewMessage: handleNewMessage,
    onNewDM: handleNewDM,
    onTyping: handleTyping
  });
  
  useEffect(() => {
    if (selectedChannel) {
      joinChannel(selectedChannel);
    }
    return () => {
      if (selectedChannel) {
        leaveChannel(selectedChannel);
      }
    };
  }, [selectedChannel, joinChannel, leaveChannel]);
  
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel && !selectedDM) {
      const generalChannel = channels.find(c => c.name === 'general');
      setSelectedChannel(generalChannel?.id || channels[0].id);
    }
  }, [channels, selectedChannel, selectedDM]);
  
  useEffect(() => {
    setHasMoreMessages(true);
    setIsLoadingMore(false);
  }, [selectedChannel, selectedDM]);
  
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['/api/chat/messages', selectedChannel],
    queryFn: async () => {
      if (!selectedChannel) return [];
      const msgs = await fetchChatMessages(selectedChannel, MESSAGE_LIMIT);
      setHasMoreMessages(msgs.length === MESSAGE_LIMIT);
      return msgs;
    },
    enabled: !!selectedChannel && !selectedDM
  });
  
  const { data: dmMessages = [], isLoading: dmLoading, refetch: refetchDMs } = useQuery({
    queryKey: ['/api/chat/dm', currentCrewMember?.id, selectedDM],
    queryFn: async () => {
      if (!currentCrewMember || !selectedDM) return [];
      const msgs = await fetchDirectMessages(currentCrewMember.id, selectedDM, MESSAGE_LIMIT);
      setHasMoreMessages(msgs.length === MESSAGE_LIMIT);
      return msgs;
    },
    enabled: !!currentCrewMember && !!selectedDM
  });
  
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    try {
      const currentMessages = selectedDM ? dmMessages : messages;
      if (currentMessages.length === 0) {
        setIsLoadingMore(false);
        return;
      }
      
      const oldestMessage = currentMessages[0];
      
      if (selectedChannel && !selectedDM) {
        const olderMessages = await fetchChatMessages(selectedChannel, MESSAGE_LIMIT, oldestMessage.id);
        setHasMoreMessages(olderMessages.length === MESSAGE_LIMIT);
        queryClient.setQueryData<ChatMessage[]>(
          ['/api/chat/messages', selectedChannel],
          (old = []) => [...olderMessages, ...old]
        );
      } else if (currentCrewMember && selectedDM) {
        const olderMessages = await fetchDirectMessages(currentCrewMember.id, selectedDM, MESSAGE_LIMIT, oldestMessage.id);
        setHasMoreMessages(olderMessages.length === MESSAGE_LIMIT);
        queryClient.setQueryData<DirectMessage[]>(
          ['/api/chat/dm', currentCrewMember.id, selectedDM],
          (old = []) => [...olderMessages, ...old]
        );
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedChannel, selectedDM, currentCrewMember, messages, dmMessages, isLoadingMore, hasMoreMessages, queryClient]);
  
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrls }: { content: string; imageUrls?: string[] }) => {
      if (!currentCrewMember) throw new Error("Not authenticated");
      
      if (selectedDM) {
        return createDirectMessage({
          senderId: currentCrewMember.id,
          senderName: currentCrewMember.name,
          senderColor: currentCrewMember.color || '#6366f1',
          recipientId: selectedDM,
          content,
          imageUrls: imageUrls || []
        });
      } else if (selectedChannel) {
        return createChatMessage(selectedChannel, {
          senderId: currentCrewMember.id,
          senderName: currentCrewMember.name,
          senderColor: currentCrewMember.color || '#6366f1',
          content,
          imageUrls: imageUrls || []
        });
      }
    },
    onSuccess: () => {
      if (selectedDM) {
        refetchDMs();
      } else {
        refetchMessages();
      }
    }
  });
  
  const createChannelMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!currentCrewMember) throw new Error("Not authenticated");
      return createChatChannel({
        name,
        description,
        createdBy: currentCrewMember.id,
        type: 'team'
      });
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/channels'] });
      if (channel) {
        setSelectedChannel(channel.id);
        setSelectedDM(null);
      }
    }
  });
  
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!currentCrewMember) throw new Error("Not authenticated");
      return updateChatMessage(messageId, { 
        content,
        senderId: currentCrewMember.id 
      });
    },
    onSuccess: () => {
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', selectedChannel] });
      }
    }
  });
  
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!currentCrewMember) throw new Error("Not authenticated");
      return deleteChatMessage(messageId, currentCrewMember.id);
    },
    onSuccess: () => {
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', selectedChannel] });
      }
    }
  });
  
  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  const selectedDMUser = crewMembers.find(m => m.id === selectedDM);
  
  useEffect(() => {
    // Update last visit time when user is on the chat page
    if (selectedChannel || selectedDM) {
      localStorage.setItem('last_chat_visit', Date.now().toString());
    }
  }, [selectedChannel, selectedDM]);

  const handleSendMessage = (content: string, imageUrls?: string[]) => {
    sendMessageMutation.mutate({ content, imageUrls });
  };
  
  const handleCreateChannel = (name: string, description?: string) => {
    createChannelMutation.mutate({ name, description });
  };
  
  const handleEditMessage = (messageId: string, content: string) => {
    editMessageMutation.mutate({ messageId, content });
  };
  
  const handleDeleteMessage = (messageId: string) => {
    deleteMessageMutation.mutate(messageId);
  };
  
  const displayMessages = selectedDM ? dmMessages : messages;
  const isLoadingMessages = selectedDM ? dmLoading : messagesLoading;
  const channelName = selectedDM 
    ? selectedDMUser?.name || 'Direct Message' 
    : selectedChannelData?.name || 'general';
  
  const sidebarContent = (
    <ChannelSidebar
      channels={channels}
      selectedChannel={selectedChannel}
      onSelectChannel={(id) => {
        setSelectedChannel(id);
        setShowSidebar(false);
      }}
      onNewChannel={() => setShowNewChannelDialog(true)}
      crewMembers={crewMembers}
      onSelectDM={(id) => {
        setSelectedDM(id);
        setShowSidebar(false);
      }}
      selectedDM={selectedDM}
      currentUserId={currentCrewMember?.id || null}
      channelUnreadCounts={channelUnreadCounts}
      dmUnreadCounts={dmUnreadCounts}
    />
  );

  const chatContent = (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center gap-3 px-6 pb-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] border-b border-border bg-card/50 backdrop-blur-sm min-h-[72px] shrink-0">
        {isMobile && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-11 w-11 p-0 min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
            onClick={() => setShowSidebar(true)}
            data-testid="button-open-sidebar"
          >
            <Menu className="h-6 w-6" />
          </Button>
        )}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedDM ? (
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
              style={{ backgroundColor: selectedDMUser?.color || '#6366f1' }}
            >
              {getInitials(selectedDMUser?.name || '')}
            </div>
          ) : (
            <Hash className="h-6 w-6 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-lg truncate leading-tight">{channelName}</h3>
            {selectedChannelData?.description && (
              <p className="text-sm text-muted-foreground truncate leading-tight">{selectedChannelData.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {pushSupported && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 p-0 min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
                    onClick={() => pushSubscribed ? unsubscribePush() : subscribePush()}
                    disabled={pushLoading}
                    data-testid="button-toggle-notifications"
                  >
                    {pushSubscribed ? (
                      <Bell className="h-6 w-6 text-green-600" />
                    ) : (
                      <BellOff className="h-6 w-6 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {pushSubscribed ? 'Notifications enabled' : 'Enable notifications'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      <MessageList 
        messages={displayMessages}
        isLoading={isLoadingMessages}
        onLoadMore={loadMoreMessages}
        hasMore={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        currentUserId={currentCrewMember?.id}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />
      
      {typingUsers.size > 0 && (
        <div className="px-6 py-1 text-xs text-muted-foreground font-medium italic animate-pulse">
          {Array.from(typingUsers.values()).map(u => u.name).join(', ')} typing...
        </div>
      )}
      
      <div className="p-4 bg-muted/20">
        <MessageInput 
          onSend={handleSendMessage}
          channelName={channelName}
          isSending={sendMessageMutation.isPending}
          canSend={!!currentCrewMember}
        />
      </div>
    </div>
  );

  const notificationPopup = (
    <NotificationPopup
      isSupported={pushSupported}
      isSubscribed={pushSubscribed}
      isLoading={pushLoading}
      onSubscribe={subscribePush}
    />
  );

  if (isMobile) {
    return (
      <MobileLayout showNav={true}>
        <FeatureGate feature="chat">
        {notificationPopup}
        <div className="fixed inset-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] flex flex-col">
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 bg-zinc-900 border-zinc-800">
              {sidebarContent}
            </SheetContent>
          </Sheet>
          {chatContent}
        </div>
        
        <NewChannelDialog
          open={showNewChannelDialog}
          onOpenChange={setShowNewChannelDialog}
          onCreateChannel={handleCreateChannel}
        />
        </FeatureGate>
      </MobileLayout>
    );
  }

  return (
    <Layout fullWidth noPadding>
      <FeatureGate feature="chat">
      {notificationPopup}
      <div className="h-[calc(100dvh-64px)] flex overflow-hidden">
        <div className="w-72 shrink-0 border-r border-border bg-muted/30">
          {sidebarContent}
        </div>
        <div className="flex-1 min-w-0 bg-background">
          {chatContent}
        </div>
      </div>
      
      <NewChannelDialog
        open={showNewChannelDialog}
        onOpenChange={setShowNewChannelDialog}
        onCreateChannel={handleCreateChannel}
      />
      </FeatureGate>
    </Layout>
  );
}
