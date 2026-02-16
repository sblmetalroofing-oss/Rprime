import { useState, useCallback, DragEvent } from 'react';

export const PHOTO_TRANSFER_TYPE = 'application/x-rprime-photo';

export interface PhotoTransferData {
  url: string;
  name: string;
  sourceJobId?: string;
}

export function usePhotoTransfer() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragStart = useCallback((
    e: DragEvent<HTMLElement>,
    photoData: PhotoTransferData
  ) => {
    e.dataTransfer.setData(PHOTO_TRANSFER_TYPE, JSON.stringify(photoData));
    e.dataTransfer.setData('text/plain', photoData.url);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    const hasPhotoData = e.dataTransfer.types.includes(PHOTO_TRANSFER_TYPE) ||
                         e.dataTransfer.types.includes('text/plain');
    
    if (hasPhotoData) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback((
    e: DragEvent<HTMLElement>,
    onPhotoReceived: (data: PhotoTransferData) => void
  ) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const photoDataStr = e.dataTransfer.getData(PHOTO_TRANSFER_TYPE);
    if (photoDataStr) {
      try {
        const photoData: PhotoTransferData = JSON.parse(photoDataStr);
        onPhotoReceived(photoData);
        return;
      } catch (err) {
        console.error('Failed to parse photo data:', err);
      }
    }

    const plainUrl = e.dataTransfer.getData('text/plain');
    if (plainUrl && (plainUrl.startsWith('http') || plainUrl.startsWith('/'))) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(plainUrl) ||
                      plainUrl.includes('/objects/');
      if (isImage) {
        onPhotoReceived({ url: plainUrl, name: 'Dropped Photo' });
      }
    }
  }, []);

  return {
    isDraggingOver,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

export function DraggablePhoto({
  url,
  name,
  sourceJobId,
  children,
  className = '',
}: {
  url: string;
  name: string;
  sourceJobId?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { handleDragStart } = usePhotoTransfer();

  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, { url, name, sourceJobId })}
      className={`cursor-grab active:cursor-grabbing ${className}`}
    >
      {children}
    </div>
  );
}

export function PhotoDropZone({
  onPhotoReceived,
  children,
  className = '',
  activeClassName = 'ring-2 ring-primary ring-offset-2 bg-primary/5',
}: {
  onPhotoReceived: (data: PhotoTransferData) => void;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}) {
  const { isDraggingOver, handleDragOver, handleDragLeave, handleDrop } = usePhotoTransfer();

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, onPhotoReceived)}
      className={`${className} ${isDraggingOver ? activeClassName : ''} transition-all duration-200`}
    >
      {children}
    </div>
  );
}
