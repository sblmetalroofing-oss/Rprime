import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Circle, ArrowRight, Type, Undo2, Download, X, Pencil } from "lucide-react";

type Tool = "arrow" | "circle" | "text" | "pencil";

interface PhotoAnnotatorProps {
  imageUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (annotatedImageUrl: string) => void;
}

export function PhotoAnnotator({ imageUrl, open, onClose, onSave }: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (open) {
      setImageLoaded(false);
      setLoadError(false);
      setHistory([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !imageUrl) return;
    
    // Small delay to ensure canvas is mounted
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("Canvas not available");
        setLoadError(true);
        return;
      }
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Cannot get canvas context");
        setLoadError(true);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = Math.min(800, window.innerWidth - 80);
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
        setImageLoaded(true);
        setLoadError(false);
      };
      img.onerror = (e) => {
        console.error("Failed to load image:", e);
        setLoadError(true);
        setImageLoaded(false);
      };
      // Set src directly without crossOrigin for data URLs
      img.src = imageUrl;
    }, 100);
    
    return () => clearTimeout(timer);
  }, [open, imageUrl]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    if ("changedTouches" in e && e.changedTouches.length > 0) {
      return {
        x: e.changedTouches[0].clientX - rect.left,
        y: e.changedTouches[0].clientY - rect.top
      };
    }
    if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    setIsDrawing(true);
    setStartPos(pos);

    if (tool === "text") {
      setTextPos(pos);
    } else if (tool === "pencil") {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    if (tool === "pencil") {
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const endPos = getPos(e);

    if (tool === "arrow") {
      drawArrow(ctx, startPos.x, startPos.y, endPos.x, endPos.y);
    } else if (tool === "circle") {
      const radius = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)
      );
      drawCircle(ctx, startPos.x, startPos.y, radius);
    }

    if (tool !== "text") {
      setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headLen = 15;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const addText = () => {
    if (!textPos || !textInput) return;
    const ctx = canvasRef.current?.getContext("2d");
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeText(textInput, textPos.x, textPos.y);
    ctx.fillText(textInput, textPos.x, textPos.y);

    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setTextInput("");
    setTextPos(null);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const newHistory = [...history];
    newHistory.pop();
    const prevState = newHistory[newHistory.length - 1];
    ctx.putImageData(prevState, 0, 0);
    setHistory(newHistory);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onSave(dataUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Annotate Photo</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={tool === "arrow" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("arrow")}
          >
            <ArrowRight className="h-4 w-4 mr-1" /> Arrow
          </Button>
          <Button
            variant={tool === "circle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("circle")}
          >
            <Circle className="h-4 w-4 mr-1" /> Circle
          </Button>
          <Button
            variant={tool === "pencil" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pencil")}
          >
            <Pencil className="h-4 w-4 mr-1" /> Draw
          </Button>
          <Button
            variant={tool === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("text")}
          >
            <Type className="h-4 w-4 mr-1" /> Text
          </Button>
          <Button variant="outline" size="sm" onClick={undo} disabled={history.length <= 1}>
            <Undo2 className="h-4 w-4 mr-1" /> Undo
          </Button>
        </div>

        {textPos && tool === "text" && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="flex-1 px-3 py-1 border rounded"
              autoFocus
            />
            <Button size="sm" onClick={addText}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setTextPos(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden bg-muted relative min-h-[200px]">
          {!imageLoaded && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground">Loading image...</div>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
              <div className="text-destructive">Failed to load image</div>
              <img src={imageUrl} alt="Preview" className="max-w-full max-h-[300px] object-contain" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={`max-w-full cursor-crosshair touch-none ${!imageLoaded ? 'invisible' : ''}`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Download className="h-4 w-4 mr-2" /> Save Annotated
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
