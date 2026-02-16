import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Trash2, 
  RotateCcw, 
  RotateCw,
  Download, 
  List,
  X,
  Check,
  Briefcase,
  Plus,
  Minus,
  Maximize2,
  Loader2,
  Pencil,
  ArrowUp,
  ChevronDown,
  MessageCircle,
  Save
} from "lucide-react";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import logoUrl from "@assets/sbl-logo.png";
import { formatDateShort, formatDateTime, getTodayInput } from "@/lib/date-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  createPurchaseOrder, 
  getNextPONumber,
  fetchFlashingOrders,
  fetchFlashingProfiles,
  createFlashingOrder,
  updateFlashingOrder,
  createFlashingProfile,
  updateFlashingProfile,
  deleteFlashingProfile,
  type FlashingOrder,
  type FlashingProfile
} from "@/lib/api";

interface Point {
  x: number;
  y: number;
}

interface LabelInfo {
  type: "dimension" | "angle";
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  customOffset?: { x: number; y: number };
}

interface CommentBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type EndFoldType = 'none' | 'crush' | 'open_crush' | 'hook' | 'break';
type FoldDirection = 'up' | 'down';

interface EndFoldState {
  type: EndFoldType;
  length: number;
  direction: FoldDirection;
}

interface ProfileState {
  id?: string;
  code: string;
  name: string;
  points: Point[];
  material: string;
  thickness: string;
  quantity: number;
  lengthMm: number;
  colorSide?: 'left' | 'right' | null;
  startFold?: EndFoldState;
  endFold?: EndFoldState;
  labelOffsets?: { [key: string]: { x: number; y: number } };
  comments?: CommentBubble[];
}

const END_FOLD_OPTIONS: { value: EndFoldType; label: string; abbrev: string; description: string }[] = [
  { value: 'none', label: 'None', abbrev: '', description: 'No end fold' },
  { value: 'crush', label: 'Crush', abbrev: 'C', description: 'Folded flat and pressed together' },
  { value: 'open_crush', label: 'Open Crush', abbrev: 'O.C', description: 'Partially folded at an angle' },
  { value: 'hook', label: 'Hook', abbrev: 'H', description: 'Bent into a hook shape' },
  { value: 'break', label: 'Break', abbrev: 'B', description: 'Sharp 90° bend at the end' },
];

const FoldIcon = ({ type, direction = 'up', className = "" }: { type: EndFoldType; direction?: FoldDirection; className?: string }) => {
  if (type === 'none') return null;
  
  const flipY = direction === 'down';
  const transform = flipY ? 'scale(1, -1) translate(0, -28)' : '';
  
  let path = '';
  if (type === 'break') {
    // Simple horizontal perpendicular line
    path = 'M 16,24 L 16,16 L 6,16';
  } else if (type === 'hook') {
    // 45° diagonal line
    path = 'M 16,24 L 16,16 L 8,10';
  } else if (type === 'crush') {
    // Perpendicular horizontal then fold back parallel (no gap)
    path = 'M 16,24 L 16,16 L 6,16 L 6,22';
  } else if (type === 'open_crush') {
    // Perpendicular horizontal then fold back parallel (with gap)
    path = 'M 16,24 L 16,16 L 6,16 M 6,20 L 6,26';
  }
  
  return (
    <svg viewBox="0 0 32 28" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <g transform={transform}>
        <path d={path} />
      </g>
    </svg>
  );
};

const COLORBOND_COLORS = [
  { name: "Surfmist", hex: "#E8E6E0" },
  { name: "Classic Cream", hex: "#E6DCC5" },
  { name: "Paperbark", hex: "#C8B794" },
  { name: "Evening Haze", hex: "#C2B8A8" },
  { name: "Shale Grey", hex: "#A3A39E" },
  { name: "Dune", hex: "#9E8E75" },
  { name: "Woodland Grey", hex: "#4D4D4D" },
  { name: "Basalt", hex: "#595757" },
  { name: "Ironstone", hex: "#464544" },
  { name: "Monument", hex: "#2B2B28" },
  { name: "Night Sky", hex: "#1F1F21" },
  { name: "Windspray", hex: "#7A7B7B" },
  { name: "Pale Eucalypt", hex: "#7B8977" },
  { name: "Wilderness", hex: "#4A5D4B" },
  { name: "Cottage Green", hex: "#1D4226" },
  { name: "Manor Red", hex: "#6B2C29" },
  { name: "Headland", hex: "#544532" },
  { name: "Jasper", hex: "#563B3B" },
  { name: "Cove", hex: "#3B5568" },
  { name: "Deep Ocean", hex: "#1F3045" },
  { name: "Zinc", hex: "#A8A8A8" },
];

const THICKNESSES = ["0.35mm", "0.42mm", "0.48mm", "0.55mm"];
const GRID_OPTIONS = [
  { value: 10, label: "10mm" },
  { value: 20, label: "20mm" },
  { value: 35, label: "35mm" },
  { value: 50, label: "50mm" },
];

export default function RFlash() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<LabelInfo[]>([]);
  
  const [currentProfile, setCurrentProfile] = useState<ProfileState>({
    code: "A1",
    name: "",
    points: [],
    material: "Surfmist",
    thickness: "0.55mm",
    quantity: 1,
    lengthMm: 3000,
  });
  
  const [profiles, setProfiles] = useState<ProfileState[]>([]);
  const [gridSize, setGridSize] = useState(35);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCuttingList, setShowCuttingList] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  
  const [editingLabel, setEditingLabel] = useState<LabelInfo | null>(null);
  const [editValue, setEditValue] = useState("");
  
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<Point | null>(null);
  const isPanningRef = useRef(false);
  const gestureEndTimeRef = useRef<number>(0);
  const singleTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSingleFingerPanningRef = useRef(false);
  const lastSingleTouchRef = useRef<{ x: number; y: number } | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [editingProfileIndex, setEditingProfileIndex] = useState<number | null>(null);
  const [colorSide, setColorSide] = useState<'left' | 'right' | null>(null);
  const colorSideCirclesRef = useRef<{ side: 'left' | 'right', x: number, y: number, radius: number }[]>([]);
  const [showEndFoldsMenu, setShowEndFoldsMenu] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'start' | 'end' | null>(null);
  const [startFold, setStartFold] = useState<EndFoldState>({ type: 'none', length: 10, direction: 'up' });
  const [endFold, setEndFold] = useState<EndFoldState>({ type: 'none', length: 10, direction: 'up' });
  const [activeFoldDropdown, setActiveFoldDropdown] = useState<'start' | 'end' | null>(null);
  const foldCirclesRef = useRef<{ endpoint: 'start' | 'end', x: number, y: number, radius: number }[]>([]);
  const [isRotating, setIsRotating] = useState(false);
  const rotateStartXRef = useRef<number>(0);
  const rotateStartPointsRef = useRef<Point[]>([]);
  
  // Store original angles when points are placed (keyed by point index)
  // These are the manufacturing angles that don't change with rotation
  const [originalAngles, setOriginalAngles] = useState<Record<number, number>>({});
  
  // Draggable labels and comments
  const [draggingLabel, setDraggingLabel] = useState<{ type: 'dimension' | 'angle' | 'comment'; index: number } | null>(null);
  const draggingLabelRef = useRef<{ type: 'dimension' | 'angle' | 'comment'; index: number } | null>(null);
  const touchedDraggableRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; labelX: number; labelY: number } | null>(null);
  const liveDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const drawCanvasRef = useRef<(() => void) | null>(null);
  const touchStartHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const touchMoveHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const touchEndHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const [comments, setComments] = useState<CommentBubble[]>([]);
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // Backend persistence state
  const queryClient = useQueryClient();
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/rflash/orders'],
    queryFn: () => fetchFlashingOrders(),
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: createFlashingOrder,
    onSuccess: (order) => {
      if (order) {
        setCurrentOrderId(order.id);
        queryClient.invalidateQueries({ queryKey: ['/api/rflash/orders'] });
      }
    },
  });

  // Create/update profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (profile: ProfileState) => {
      if (!currentOrderId) return null;
      
      const profileData = {
        orderId: currentOrderId,
        code: profile.code,
        name: profile.name || null,
        materialName: profile.material,
        points: profile.points,
        girth: profile.points.length > 1 ? Math.round(profile.points.reduce((total, p, i, arr) => i === 0 ? 0 : total + Math.sqrt(Math.pow(p.x - arr[i-1].x, 2) + Math.pow(p.y - arr[i-1].y, 2)), 0)) : 0,
        folds: Math.max(0, profile.points.length - 2),
        quantity: profile.quantity,
        lengthMm: profile.lengthMm,
        colorSide: profile.colorSide || null,
        startFold: profile.startFold || null,
        endFold: profile.endFold || null,
        labelOffsets: profile.labelOffsets || null,
        comments: profile.comments || null,
      };

      if (profile.id) {
        return updateFlashingProfile(profile.id, profileData);
      } else {
        return createFlashingProfile(profileData);
      }
    },
    onSuccess: () => {
      if (currentOrderId) {
        queryClient.invalidateQueries({ queryKey: ['/api/rflash/orders', currentOrderId, 'profiles'] });
      }
    },
  });

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: deleteFlashingProfile,
    onSuccess: () => {
      if (currentOrderId) {
        queryClient.invalidateQueries({ queryKey: ['/api/rflash/orders', currentOrderId, 'profiles'] });
      }
    },
  });

  // Load or create order on mount
  useEffect(() => {
    if (!ordersLoading && orders.length === 0 && !currentOrderId) {
      // Create a new order if none exist
      createOrderMutation.mutate({ status: 'draft' });
    } else if (!ordersLoading && orders.length > 0 && !currentOrderId) {
      // Use the most recent order
      setCurrentOrderId(orders[0].id);
    }
  }, [ordersLoading, orders, currentOrderId]);

  // Load profiles when order changes
  const { data: savedProfiles = [] } = useQuery({
    queryKey: ['/api/rflash/orders', currentOrderId, 'profiles'],
    queryFn: () => currentOrderId ? fetchFlashingProfiles(currentOrderId) : Promise.resolve([]),
    enabled: !!currentOrderId,
  });

  // Sync saved profiles to local state
  useEffect(() => {
    if (savedProfiles.length > 0 && profiles.length === 0) {
      const loadedProfiles: ProfileState[] = savedProfiles.map((p: FlashingProfile) => ({
        id: p.id,
        code: p.code,
        name: p.name || "",
        points: p.points || [],
        material: p.materialName || "Surfmist",
        thickness: "0.55mm",
        quantity: p.quantity || 1,
        lengthMm: p.lengthMm || 3000,
        colorSide: p.colorSide as 'left' | 'right' | undefined,
        startFold: p.startFold ?? undefined,
        endFold: p.endFold ?? undefined,
        labelOffsets: p.labelOffsets ?? undefined,
        comments: p.comments ?? undefined,
      }));
      setProfiles(loadedProfiles);
    }
  }, [savedProfiles]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };
    
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  const calculateAngle = useCallback((p1: Point, p2: Point, p3: Point): number => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 180;
    
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angle = Math.acos(cosAngle) * (180 / Math.PI);
    
    return Math.round(angle);
  }, []);

  const snapToGrid = useCallback((value: number): number => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  const checkOverlap = (label1: LabelInfo, label2: LabelInfo): boolean => {
    return !(label1.x + label1.width < label2.x ||
             label2.x + label2.width < label1.x ||
             label1.y + label1.height < label2.y ||
             label2.y + label2.height < label1.y);
  };

  const checkLabelCircleOverlap = (label: LabelInfo, circle: { x: number; y: number; radius: number }): boolean => {
    // Find closest point on rectangle to circle center
    const closestX = Math.max(label.x, Math.min(circle.x, label.x + label.width));
    const closestY = Math.max(label.y, Math.min(circle.y, label.y + label.height));
    
    // Calculate distance from circle center to closest point
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < circle.radius;
  };
  
  // Check if a label rectangle overlaps with a line segment
  const checkLabelLineOverlap = (label: { x: number; y: number; width: number; height: number }, p1: Point, p2: Point, padding: number = 5): boolean => {
    // Check if line segment intersects the padded rectangle
    const left = label.x - padding;
    const right = label.x + label.width + padding;
    const top = label.y - padding;
    const bottom = label.y + label.height + padding;
    
    // Check if either endpoint is inside the rectangle
    if ((p1.x >= left && p1.x <= right && p1.y >= top && p1.y <= bottom) ||
        (p2.x >= left && p2.x <= right && p2.y >= top && p2.y <= bottom)) {
      return true;
    }
    
    // Check if line intersects any edge of the rectangle
    const edges = [
      { x1: left, y1: top, x2: right, y2: top },
      { x1: right, y1: top, x2: right, y2: bottom },
      { x1: right, y1: bottom, x2: left, y2: bottom },
      { x1: left, y1: bottom, x2: left, y2: top },
    ];
    
    for (const edge of edges) {
      if (lineSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, edge.x1, edge.y1, edge.x2, edge.y2)) {
        return true;
      }
    }
    
    return false;
  };
  
  // Check if two line segments intersect
  const lineSegmentsIntersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean => {
    const denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    if (Math.abs(denom) < 0.0001) return false;
    
    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denom;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denom;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  const resolveOverlaps = (
    labels: LabelInfo[], 
    points: Point[],
    circles: { x: number; y: number; radius: number }[] = []
  ): LabelInfo[] => {
    const resolved = [...labels];
    
    for (let iterations = 0; iterations < 10; iterations++) {
      let hasOverlap = false;
      
      // Check label-to-label overlaps
      for (let i = 0; i < resolved.length; i++) {
        for (let j = i + 1; j < resolved.length; j++) {
          if (checkOverlap(resolved[i], resolved[j])) {
            hasOverlap = true;
            
            if (resolved[i].type === "dimension") {
              const segIdx = resolved[i].index;
              const p1 = points[segIdx - 1];
              const p2 = points[segIdx];
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                const perpX = -dy / len * 30;
                const perpY = dx / len * 30;
                resolved[i].x += perpX;
                resolved[i].y += perpY;
              }
            } else {
              resolved[i].y += 35;
            }
          }
        }
        
        // Check label-to-circle overlaps
        for (const circle of circles) {
          if (checkLabelCircleOverlap(resolved[i], circle)) {
            hasOverlap = true;
            // Move label away from circle
            const labelCenterX = resolved[i].x + resolved[i].width / 2;
            const labelCenterY = resolved[i].y + resolved[i].height / 2;
            const dx = labelCenterX - circle.x;
            const dy = labelCenterY - circle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              const pushDist = 25;
              resolved[i].x += (dx / dist) * pushDist;
              resolved[i].y += (dy / dist) * pushDist;
            } else {
              resolved[i].y += 35;
            }
          }
        }
        
        // Check label-to-line overlaps (avoid flashing line segments)
        for (let seg = 1; seg < points.length; seg++) {
          // Skip the segment this label belongs to (for dimension labels)
          if (resolved[i].type === "dimension" && resolved[i].index === seg) continue;
          
          const p1 = points[seg - 1];
          const p2 = points[seg];
          
          if (checkLabelLineOverlap(resolved[i], p1, p2, 8)) {
            hasOverlap = true;
            // Flip label to opposite side of its segment
            if (resolved[i].type === "dimension") {
              const segIdx = resolved[i].index;
              const segP1 = points[segIdx - 1];
              const segP2 = points[segIdx];
              const dx = segP2.x - segP1.x;
              const dy = segP2.y - segP1.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                // Flip to opposite side
                const perpX = -dy / len * 50;
                const perpY = dx / len * 50;
                resolved[i].x -= perpX * 2;
                resolved[i].y -= perpY * 2;
              }
            } else {
              // For angle labels, push away from colliding segment
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const labelCenterX = resolved[i].x + resolved[i].width / 2;
              const labelCenterY = resolved[i].y + resolved[i].height / 2;
              const dx = labelCenterX - midX;
              const dy = labelCenterY - midY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                resolved[i].x += (dx / dist) * 30;
                resolved[i].y += (dy / dist) * 30;
              }
            }
          }
        }
      }
      
      if (!hasOverlap) break;
    }
    
    return resolved;
  };

  const worldToScreen = useCallback((point: Point): Point => {
    return {
      x: point.x * zoom + panOffset.x,
      y: point.y * zoom + panOffset.y,
    };
  }, [zoom, panOffset]);

  const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  }, [zoom, panOffset]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas completely before drawing
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 0.5 / zoom;
    const gridPixels = gridSize;
    const startX = Math.floor(-panOffset.x / zoom / gridPixels) * gridPixels;
    const endX = Math.ceil((canvasSize.width - panOffset.x) / zoom / gridPixels) * gridPixels;
    const startY = Math.floor(-panOffset.y / zoom / gridPixels) * gridPixels;
    const endY = Math.ceil((canvasSize.height - panOffset.y) / zoom / gridPixels) * gridPixels;
    
    for (let x = startX; x <= endX; x += gridPixels) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridPixels) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    const materialColor = COLORBOND_COLORS.find(c => c.name === currentProfile.material)?.hex || "#666";
    const labels: LabelInfo[] = [];
    
    // Draw ghost reference of original shape during rotation
    if (isRotating && rotateStartPointsRef.current.length > 1) {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 2 / zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.beginPath();
      ctx.moveTo(rotateStartPointsRef.current[0].x, rotateStartPointsRef.current[0].y);
      
      for (let i = 1; i < rotateStartPointsRef.current.length; i++) {
        ctx.lineTo(rotateStartPointsRef.current[i].x, rotateStartPointsRef.current[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    if (currentProfile.points.length > 0) {
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.strokeStyle = materialColor;
      ctx.lineWidth = 4 / zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.beginPath();
      ctx.moveTo(currentProfile.points[0].x, currentProfile.points[0].y);
      
      for (let i = 1; i < currentProfile.points.length; i++) {
        ctx.lineTo(currentProfile.points[i].x, currentProfile.points[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const fontSize = 14 / zoom;
      ctx.font = `bold ${fontSize}px system-ui`;
      
      for (let i = 1; i < currentProfile.points.length; i++) {
        const p1 = currentProfile.points[i - 1];
        const p2 = currentProfile.points[i];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        const perpX = -dy / length * (25 / zoom);
        const perpY = dx / length * (25 / zoom);
        
        const labelText = `${Math.round(length)}`;
        const textWidth = (ctx.measureText(labelText).width + 16 / zoom);
        const labelHeight = 24 / zoom;
        
        // Apply custom offset if user dragged this label
        const dimKey = `dimension-${i}`;
        let customOffset = currentProfile.labelOffsets?.[dimKey] || { x: 0, y: 0 };
        
        // Use live drag offset if this label is being dragged (use ref for current value)
        if (draggingLabelRef.current?.type === 'dimension' && draggingLabelRef.current?.index === i && liveDragOffsetRef.current) {
          customOffset = liveDragOffsetRef.current;
        }
        
        labels.push({
          type: "dimension",
          index: i,
          x: midX + perpX - textWidth / 2 + customOffset.x,
          y: midY + perpY - labelHeight / 2 + customOffset.y,
          width: textWidth,
          height: labelHeight,
          value: Math.round(length),
        });
      }

      for (let i = 1; i < currentProfile.points.length - 1; i++) {
        const p2 = currentProfile.points[i];
        
        // Use stored original angle if available, otherwise calculate from current points
        // This ensures angles stay fixed during rotation
        const angle = originalAngles[i] !== undefined 
          ? originalAngles[i] 
          : calculateAngle(
              currentProfile.points[i - 1],
              p2,
              currentProfile.points[i + 1]
            );
        
        const labelWidth = 48 / zoom;
        const labelHeight = 24 / zoom;
        
        // Apply custom offset if user dragged this label
        const angleKey = `angle-${i}`;
        let customOffset = currentProfile.labelOffsets?.[angleKey] || { x: 0, y: 0 };
        
        // Use live drag offset if this label is being dragged (use ref for current value)
        if (draggingLabelRef.current?.type === 'angle' && draggingLabelRef.current?.index === i && liveDragOffsetRef.current) {
          customOffset = liveDragOffsetRef.current;
        }
        
        labels.push({
          type: "angle",
          index: i,
          x: p2.x - labelWidth / 2 + customOffset.x,
          y: p2.y + 12 / zoom + customOffset.y,
          width: labelWidth,
          height: labelHeight,
          value: angle,
        });
      }

      // Calculate all circle positions for overlap detection
      const allCircles: { x: number; y: number; radius: number }[] = [];
      
      // Add point circles
      currentProfile.points.forEach(point => {
        allCircles.push({ x: point.x, y: point.y, radius: 12 / zoom });
      });
      
      // Add color side circles (at girth midpoint)
      if (currentProfile.points.length >= 2) {
        let totalGirth = 0;
        const segments: { p1: Point, p2: Point, length: number, startDist: number }[] = [];
        
        for (let i = 0; i < currentProfile.points.length - 1; i++) {
          const p1 = currentProfile.points[i];
          const p2 = currentProfile.points[i + 1];
          const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          segments.push({ p1, p2, length: segLen, startDist: totalGirth });
          totalGirth += segLen;
        }
        
        const halfGirth = totalGirth / 2;
        let midSegment = segments[0];
        let distIntoSegment = halfGirth;
        for (const seg of segments) {
          if (halfGirth >= seg.startDist && halfGirth < seg.startDist + seg.length) {
            midSegment = seg;
            distIntoSegment = halfGirth - seg.startDist;
            break;
          }
        }
        
        const t = midSegment.length > 0 ? distIntoSegment / midSegment.length : 0;
        const midX = midSegment.p1.x + t * (midSegment.p2.x - midSegment.p1.x);
        const midY = midSegment.p1.y + t * (midSegment.p2.y - midSegment.p1.y);
        
        const dx = midSegment.p2.x - midSegment.p1.x;
        const dy = midSegment.p2.y - midSegment.p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = len > 0 ? -dy / len : 0;
        const perpY = len > 0 ? dx / len : 1;
        
        const colorCircleRadius = 12 / zoom;
        const colorCircleOffset = 22 / zoom;
        
        allCircles.push({ x: midX + perpX * colorCircleOffset, y: midY + perpY * colorCircleOffset, radius: colorCircleRadius });
        allCircles.push({ x: midX - perpX * colorCircleOffset, y: midY - perpY * colorCircleOffset, radius: colorCircleRadius });
      }
      
      // Add fold circles (near endpoints)
      if (currentProfile.points.length >= 2) {
        const startPoint = currentProfile.points[0];
        const secondPoint = currentProfile.points[1];
        const endPoint = currentProfile.points[currentProfile.points.length - 1];
        const secondLastPoint = currentProfile.points[currentProfile.points.length - 2];
        
        const foldCircleRadius = 14 / zoom;
        const foldCircleOffset = 35 / zoom;
        
        // Start fold circle
        const startDx = secondPoint.x - startPoint.x;
        const startDy = secondPoint.y - startPoint.y;
        const startLen = Math.sqrt(startDx * startDx + startDy * startDy);
        if (startLen > 0) {
          const startPerpX = -startDy / startLen;
          const startPerpY = startDx / startLen;
          allCircles.push({ 
            x: startPoint.x + startPerpX * foldCircleOffset, 
            y: startPoint.y + startPerpY * foldCircleOffset, 
            radius: foldCircleRadius 
          });
        }
        
        // End fold circle
        const endDx = endPoint.x - secondLastPoint.x;
        const endDy = endPoint.y - secondLastPoint.y;
        const endLen = Math.sqrt(endDx * endDx + endDy * endDy);
        if (endLen > 0) {
          const endPerpX = -endDy / endLen;
          const endPerpY = endDx / endLen;
          allCircles.push({ 
            x: endPoint.x + endPerpX * foldCircleOffset, 
            y: endPoint.y + endPerpY * foldCircleOffset, 
            radius: foldCircleRadius 
          });
        }
      }

      // No collision resolution - just use labels directly
      labelsRef.current = labels;

      // Helper to check if a label has any overlaps
      const hasAnyOverlap = (label: LabelInfo, allLabels: LabelInfo[], circles: { x: number; y: number; radius: number }[], points: Point[]): boolean => {
        // Check overlap with other labels
        for (const other of allLabels) {
          if (other === label) continue;
          if (checkOverlap(label, other)) return true;
        }
        // Check overlap with circles
        for (const circle of circles) {
          if (checkLabelCircleOverlap(label, circle)) return true;
        }
        // Check overlap with line segments (except own segment for dimension labels)
        for (let seg = 1; seg < points.length; seg++) {
          if (label.type === "dimension" && label.index === seg) continue;
          if (checkLabelLineOverlap(label, points[seg - 1], points[seg], 5)) return true;
        }
        return false;
      };

      for (const label of labels) {
        const isDragging = draggingLabelRef.current?.type === label.type && draggingLabelRef.current?.index === label.index;
        const isOverlapping = hasAnyOverlap(label, labels, allCircles, currentProfile.points);
        
        // Light orange when overlapping, red when clear, darker when dragging
        let fillColor = "#ef4444"; // normal red
        if (isOverlapping) {
          fillColor = "#fb923c"; // light orange - needs repositioning
        }
        if (isDragging) {
          fillColor = isOverlapping ? "#ea580c" : "#dc2626"; // darker versions when dragging
        }
        
        if (label.type === "dimension") {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.roundRect(label.x, label.y, label.width, label.height, 12 / zoom);
          ctx.fill();
          
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${14 / zoom}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${label.value}`, label.x + label.width / 2, label.y + label.height / 2);
        } else {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.roundRect(label.x, label.y, label.width, label.height, 12 / zoom);
          ctx.fill();
          
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${12 / zoom}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${label.value}°`, label.x + label.width / 2, label.y + label.height / 2);
        }
      }
      
      // Draw comment bubbles
      comments.forEach((comment, idx) => {
        const isDragging = draggingLabelRef.current?.type === 'comment' && draggingLabelRef.current?.index === idx;
        
        // Use live drag position if this comment is being dragged
        let drawX = comment.x;
        let drawY = comment.y;
        if (isDragging && liveDragOffsetRef.current) {
          drawX = liveDragOffsetRef.current.x;
          drawY = liveDragOffsetRef.current.y;
        }
        
        ctx.fillStyle = isDragging ? "#0284c7" : "#0ea5e9";
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, comment.width, comment.height, 8 / zoom);
        ctx.fill();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = `${11 / zoom}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(comment.text, drawX + comment.width / 2, drawY + comment.height / 2);
      });

      currentProfile.points.forEach((point, idx) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10 / zoom, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = idx === currentProfile.points.length - 1 ? "#ef4444" : "#1a1a1a";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw color side toggle circles at the girth midpoint (girth ÷ 2)
      colorSideCirclesRef.current = [];
      if (currentProfile.points.length >= 2) {
        // Calculate total girth and find midpoint
        let totalGirth = 0;
        const segments: { p1: Point, p2: Point, length: number, startDist: number }[] = [];
        
        for (let i = 0; i < currentProfile.points.length - 1; i++) {
          const p1 = currentProfile.points[i];
          const p2 = currentProfile.points[i + 1];
          const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          segments.push({ p1, p2, length: segLen, startDist: totalGirth });
          totalGirth += segLen;
        }
        
        const halfGirth = totalGirth / 2;
        
        // Find which segment contains the midpoint
        let midSegment = segments[0];
        let distIntoSegment = halfGirth;
        for (const seg of segments) {
          if (halfGirth >= seg.startDist && halfGirth < seg.startDist + seg.length) {
            midSegment = seg;
            distIntoSegment = halfGirth - seg.startDist;
            break;
          }
        }
        
        // Calculate the exact midpoint position on that segment
        const t = midSegment.length > 0 ? distIntoSegment / midSegment.length : 0;
        const midX = midSegment.p1.x + t * (midSegment.p2.x - midSegment.p1.x);
        const midY = midSegment.p1.y + t * (midSegment.p2.y - midSegment.p1.y);
        
        // Calculate perpendicular direction to that segment
        const dx = midSegment.p2.x - midSegment.p1.x;
        const dy = midSegment.p2.y - midSegment.p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = len > 0 ? -dy / len : 0;
        const perpY = len > 0 ? dx / len : 1;
        
        const circleRadius = 12 / zoom;
        const circleOffset = 22 / zoom;
        
        // Position circles on either side of the girth midpoint
        const leftX = midX + perpX * circleOffset;
        const leftY = midY + perpY * circleOffset;
        const rightX = midX - perpX * circleOffset;
        const rightY = midY - perpY * circleOffset;
        
        // For arrow direction calculations
        const centerX = midX;
        const centerY = midY;
        
        // Draw left circle
        ctx.beginPath();
        ctx.arc(leftX, leftY, circleRadius, 0, Math.PI * 2);
        if (colorSide === 'left') {
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        } else {
          ctx.strokeStyle = "#888";
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
        }
        colorSideCirclesRef.current.push({ side: 'left', x: leftX, y: leftY, radius: circleRadius });
        
        // Draw right circle
        ctx.beginPath();
        ctx.arc(rightX, rightY, circleRadius, 0, Math.PI * 2);
        if (colorSide === 'right') {
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        } else {
          ctx.strokeStyle = "#888";
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
        }
        colorSideCirclesRef.current.push({ side: 'right', x: rightX, y: rightY, radius: circleRadius });
        
        // Draw arrow from selected circle almost touching the profile line
        if (colorSide) {
          const selectedX = colorSide === 'left' ? leftX : rightX;
          const selectedY = colorSide === 'left' ? leftY : rightY;
          
          // Arrow points toward the midpoint on the profile line
          const dx = centerX - selectedX;
          const dy = centerY - selectedY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const arrowDirX = dx / dist;
          const arrowDirY = dy / dist;
          
          // Start just outside the circle edge
          const arrowStartX = selectedX + arrowDirX * (circleRadius + 2 / zoom);
          const arrowStartY = selectedY + arrowDirY * (circleRadius + 2 / zoom);
          
          // End almost at the profile line (stop 3px short)
          const gap = 3 / zoom;
          const arrowEndX = centerX - arrowDirX * gap;
          const arrowEndY = centerY - arrowDirY * gap;
          
          // Draw arrow line (extends from circle almost to the line)
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3 / zoom;
          ctx.lineCap = "round";
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(arrowStartX, arrowStartY);
          ctx.lineTo(arrowEndX, arrowEndY);
          ctx.stroke();
          
          // Draw arrowhead at the end
          const headLength = 7 / zoom;
          const headAngle = Math.PI / 6;
          const angle = Math.atan2(arrowDirY, arrowDirX);
          
          ctx.beginPath();
          ctx.moveTo(arrowEndX, arrowEndY);
          ctx.lineTo(
            arrowEndX - headLength * Math.cos(angle - headAngle),
            arrowEndY - headLength * Math.sin(angle - headAngle)
          );
          ctx.moveTo(arrowEndX, arrowEndY);
          ctx.lineTo(
            arrowEndX - headLength * Math.cos(angle + headAngle),
            arrowEndY - headLength * Math.sin(angle + headAngle)
          );
          ctx.stroke();
        }
      }
      
      if (currentProfile.points.length >= 2) {
        const startPoint = currentProfile.points[0];
        const secondPoint = currentProfile.points[1];
        const endPoint = currentProfile.points[currentProfile.points.length - 1];
        const secondLastPoint = currentProfile.points[currentProfile.points.length - 2];
        
        const drawFoldOnProfile = (
          endpoint: Point, 
          adjacentPoint: Point, 
          foldState: EndFoldState, 
          isStart: boolean,
          allLabels: LabelInfo[]
        ) => {
          if (foldState.type === 'none') return;
          
          const opt = END_FOLD_OPTIONS.find(o => o.value === foldState.type);
          const foldLength = foldState.length;
          
          const dx = endpoint.x - adjacentPoint.x;
          const dy = endpoint.y - adjacentPoint.y;
          const segmentLength = Math.sqrt(dx * dx + dy * dy);
          const dirX = dx / segmentLength;
          const dirY = dy / segmentLength;
          
          const perpX = foldState.direction === 'up' ? dirY : -dirY;
          const perpY = foldState.direction === 'up' ? -dirX : dirX;
          
          ctx.strokeStyle = materialColor;
          ctx.lineWidth = 4 / zoom;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          
          ctx.beginPath();
          ctx.moveTo(endpoint.x, endpoint.y);
          
          let foldEndPoint = { x: endpoint.x, y: endpoint.y };
          
          if (foldState.type === 'break') {
            // 45° diagonal line going perpendicular + away from profile
            const foldEnd = { 
              x: endpoint.x + (perpX * 0.707 + dirX * 0.707) * foldLength, 
              y: endpoint.y + (perpY * 0.707 + dirY * 0.707) * foldLength 
            };
            ctx.lineTo(foldEnd.x, foldEnd.y);
            foldEndPoint = foldEnd;
          } else if (foldState.type === 'hook') {
            // 45° diagonal line going perpendicular + back toward profile
            const hookEnd = {
              x: endpoint.x + (perpX * 0.707 - dirX * 0.707) * foldLength,
              y: endpoint.y + (perpY * 0.707 - dirY * 0.707) * foldLength
            };
            ctx.lineTo(hookEnd.x, hookEnd.y);
            foldEndPoint = hookEnd;
          } else if (foldState.type === 'crush') {
            // Fold back along the profile line, offset to show which side it folds onto
            const offset = 4 / zoom;
            const startOffset = {
              x: endpoint.x + perpX * offset,
              y: endpoint.y + perpY * offset
            };
            ctx.moveTo(startOffset.x, startOffset.y);
            const crushEnd = { 
              x: startOffset.x - dirX * foldLength, 
              y: startOffset.y - dirY * foldLength 
            };
            ctx.lineTo(crushEnd.x, crushEnd.y);
            foldEndPoint = crushEnd;
          } else if (foldState.type === 'open_crush') {
            // Fold back along the profile line, offset with visible gap
            const offset = 6 / zoom;
            const startOffset = {
              x: endpoint.x + perpX * offset,
              y: endpoint.y + perpY * offset
            };
            ctx.moveTo(startOffset.x, startOffset.y);
            const crushEnd = { 
              x: startOffset.x - dirX * foldLength, 
              y: startOffset.y - dirY * foldLength 
            };
            ctx.lineTo(crushEnd.x, crushEnd.y);
            foldEndPoint = crushEnd;
          }
          
          ctx.stroke();
          
          const labelX = foldEndPoint.x + perpX * 55 / zoom;
          const labelY = foldEndPoint.y + perpY * 55 / zoom;
          const fontSize = 12 / zoom;
          ctx.font = `bold ${fontSize}px system-ui`;
          
          const labelText = `${opt?.label || ''}\n${foldLength}`;
          const lines = [opt?.label || '', String(foldLength)];
          const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
          const padding = 8 / zoom;
          const boxWidth = maxWidth + padding * 2;
          const boxHeight = fontSize * 2.4 + padding * 2;
          
          let finalLabelX = labelX - boxWidth / 2;
          let finalLabelY = labelY - boxHeight / 2;
          
          const checkCollision = (lx: number, ly: number) => {
            for (const label of allLabels) {
              if (!(lx + boxWidth < label.x || lx > label.x + label.width ||
                    ly + boxHeight < label.y || ly > label.y + label.height)) {
                return true;
              }
            }
            return false;
          };
          
          const offsets = [
            { x: 0, y: 0 },
            { x: 40 / zoom, y: 0 },
            { x: -40 / zoom, y: 0 },
            { x: 0, y: 40 / zoom },
            { x: 0, y: -40 / zoom },
            { x: 40 / zoom, y: 40 / zoom },
            { x: -40 / zoom, y: -40 / zoom },
          ];
          
          for (const offset of offsets) {
            const testX = finalLabelX + offset.x;
            const testY = finalLabelY + offset.y;
            if (!checkCollision(testX, testY)) {
              finalLabelX = testX;
              finalLabelY = testY;
              break;
            }
          }
          
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.roundRect(finalLabelX, finalLabelY, boxWidth, boxHeight, 8 / zoom);
          ctx.fill();
          
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(opt?.label || '', finalLabelX + boxWidth / 2, finalLabelY + boxHeight / 2 - fontSize * 0.5);
          ctx.fillText(String(foldLength), finalLabelX + boxWidth / 2, finalLabelY + boxHeight / 2 + fontSize * 0.6);
        };
        
        drawFoldOnProfile(startPoint, secondPoint, startFold, true, labels);
        drawFoldOnProfile(endPoint, secondLastPoint, endFold, false, labels);
        
        // Draw fold toggle circles near each endpoint
        const circleRadius = 14 / zoom;
        const circleOffset = 35 / zoom;
        foldCirclesRef.current = [];
        
        // Calculate perpendicular direction for start point
        const startDx = secondPoint.x - startPoint.x;
        const startDy = secondPoint.y - startPoint.y;
        const startLen = Math.sqrt(startDx * startDx + startDy * startDy);
        const startDirX = startDx / startLen;
        const startDirY = startDy / startLen;
        const startPerpX = -startDirY;
        const startPerpY = startDirX;
        
        // Start fold circle (offset perpendicular from start point)
        const startCircleX = startPoint.x + startPerpX * circleOffset;
        const startCircleY = startPoint.y + startPerpY * circleOffset;
        
        ctx.beginPath();
        ctx.arc(startCircleX, startCircleY, circleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = startFold.type !== 'none' ? "#ef4444" : "#888";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
        if (startFold.type !== 'none') {
          ctx.fillStyle = "#ef4444";
          ctx.fill();
          // Draw checkmark
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.5 / zoom;
          ctx.beginPath();
          ctx.moveTo(startCircleX - 5 / zoom, startCircleY);
          ctx.lineTo(startCircleX - 1 / zoom, startCircleY + 4 / zoom);
          ctx.lineTo(startCircleX + 6 / zoom, startCircleY - 4 / zoom);
          ctx.stroke();
        }
        foldCirclesRef.current.push({ endpoint: 'start', x: startCircleX, y: startCircleY, radius: circleRadius });
        
        // Calculate perpendicular direction for end point
        const endDx = endPoint.x - secondLastPoint.x;
        const endDy = endPoint.y - secondLastPoint.y;
        const endLen = Math.sqrt(endDx * endDx + endDy * endDy);
        const endDirX = endDx / endLen;
        const endDirY = endDy / endLen;
        const endPerpX = -endDirY;
        const endPerpY = endDirX;
        
        // End fold circle (offset perpendicular from end point)
        const endCircleX = endPoint.x + endPerpX * circleOffset;
        const endCircleY = endPoint.y + endPerpY * circleOffset;
        
        ctx.beginPath();
        ctx.arc(endCircleX, endCircleY, circleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = endFold.type !== 'none' ? "#ef4444" : "#888";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
        if (endFold.type !== 'none') {
          ctx.fillStyle = "#ef4444";
          ctx.fill();
          // Draw checkmark
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.5 / zoom;
          ctx.beginPath();
          ctx.moveTo(endCircleX - 5 / zoom, endCircleY);
          ctx.lineTo(endCircleX - 1 / zoom, endCircleY + 4 / zoom);
          ctx.lineTo(endCircleX + 6 / zoom, endCircleY - 4 / zoom);
          ctx.stroke();
        }
        foldCirclesRef.current.push({ endpoint: 'end', x: endCircleX, y: endCircleY, radius: circleRadius });
      }
    } else {
      labelsRef.current = [];
      foldCirclesRef.current = [];
    }
    
    ctx.restore();
  }, [currentProfile.points, currentProfile.material, currentProfile.labelOffsets, gridSize, canvasSize, calculateAngle, zoom, panOffset, startFold, endFold, colorSide, originalAngles, isRotating, comments]);

  useEffect(() => {
    // Cancel any pending animation frame to avoid stacking
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // Throttle draw calls using requestAnimationFrame
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
      animationFrameRef.current = null;
    });
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawCanvas]);

  // Keep ref in sync with the latest drawCanvas function
  useEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

  const findLabelAtPosition = (worldX: number, worldY: number): LabelInfo | null => {
    for (const label of labelsRef.current) {
      if (worldX >= label.x && worldX <= label.x + label.width &&
          worldY >= label.y && worldY <= label.y + label.height) {
        return label;
      }
    }
    return null;
  };

  const findFoldCircleAtPosition = (worldX: number, worldY: number): 'start' | 'end' | null => {
    for (const circle of foldCirclesRef.current) {
      const dx = worldX - circle.x;
      const dy = worldY - circle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= circle.radius * 1.5) {
        return circle.endpoint;
      }
    }
    return null;
  };

  const findColorSideCircleAtPosition = (worldX: number, worldY: number): 'left' | 'right' | null => {
    for (const circle of colorSideCirclesRef.current) {
      const dx = worldX - circle.x;
      const dy = worldY - circle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= circle.radius * 1.5) {
        return circle.side;
      }
    }
    return null;
  };

  const handleCanvasInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    const world = screenToWorld(screenX, screenY);
    
    // Check color side circles first
    const colorSideCircle = findColorSideCircleAtPosition(world.x, world.y);
    if (colorSideCircle) {
      setColorSide(colorSideCircle);
      return;
    }
    
    // Check fold circles
    const foldCircle = findFoldCircleAtPosition(world.x, world.y);
    if (foldCircle) {
      setActiveFoldDropdown(foldCircle);
      setSelectedEndpoint(foldCircle);
      return;
    }
    
    // Close dropdown if clicking elsewhere
    if (activeFoldDropdown) {
      setActiveFoldDropdown(null);
    }
    
    const label = findLabelAtPosition(world.x, world.y);
    if (label) {
      setEditingLabel(label);
      setEditValue(label.value.toString());
      return;
    }
    
    const snappedX = snapToGrid(world.x);
    const snappedY = snapToGrid(world.y);
    
    setCurrentProfile(prev => {
      const newPoints = [...prev.points, { x: snappedX, y: snappedY }];
      
      // Calculate and store original angle for the previous middle point
      // (need at least 3 points to have an angle at the middle one)
      if (newPoints.length >= 3) {
        const middleIdx = newPoints.length - 2;
        const p1 = newPoints[middleIdx - 1];
        const p2 = newPoints[middleIdx];
        const p3 = newPoints[middleIdx + 1];
        const angle = calculateAngle(p1, p2, p3);
        
        setOriginalAngles(prevAngles => ({
          ...prevAngles,
          [middleIdx]: angle,
        }));
      }
      
      return { ...prev, points: newPoints };
    });
  }, [snapToGrid, screenToWorld, activeFoldDropdown, calculateAngle]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasInteraction(e.clientX, e.clientY);
  }, [handleCanvasInteraction]);

  const getTouchDistance = (touches: TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: TouchList): Point => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPanningRef.current = true;
      isSingleFingerPanningRef.current = false;
      singleTouchStartRef.current = null;
      lastSingleTouchRef.current = null;
      setDraggingLabel(null);
      draggingLabelRef.current = null;
      lastTouchDistRef.current = getTouchDistance(e.touches);
      lastTouchCenterRef.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      const world = screenToWorld(touchX, touchY);
      
      // Check if touching a comment bubble first (priority for dragging)
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        if (world.x >= comment.x && world.x <= comment.x + comment.width &&
            world.y >= comment.y && world.y <= comment.y + comment.height) {
          e.preventDefault();
          touchedDraggableRef.current = true;
          const dragInfo = { type: 'comment' as const, index: i };
          setDraggingLabel(dragInfo);
          draggingLabelRef.current = dragInfo;
          dragStartRef.current = { x: world.x, y: world.y, labelX: comment.x, labelY: comment.y };
          return;
        }
      }
      
      // Check if touching a dimension or angle label
      for (let i = labelsRef.current.length - 1; i >= 0; i--) {
        const label = labelsRef.current[i];
        if (world.x >= label.x && world.x <= label.x + label.width &&
            world.y >= label.y && world.y <= label.y + label.height) {
          e.preventDefault();
          touchedDraggableRef.current = true;
          const dragInfo = { type: label.type, index: label.index };
          setDraggingLabel(dragInfo);
          draggingLabelRef.current = dragInfo;
          // Store the current offset at drag start (not the rendered position)
          const key = `${label.type}-${label.index}`;
          const existingOffset = currentProfile.labelOffsets?.[key] || { x: 0, y: 0 };
          dragStartRef.current = { x: world.x, y: world.y, labelX: existingOffset.x, labelY: existingOffset.y };
          return;
        }
      }
      
      singleTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      lastSingleTouchRef.current = { x: touch.clientX, y: touch.clientY };
      isSingleFingerPanningRef.current = false;
    }
  }, [screenToWorld, comments, currentProfile.labelOffsets]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Handle label/comment dragging - use refs to avoid stale closures
    if (draggingLabelRef.current && e.touches.length === 1 && dragStartRef.current) {
      e.preventDefault();
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      const world = screenToWorld(touchX, touchY);
      
      const dx = world.x - dragStartRef.current.x;
      const dy = world.y - dragStartRef.current.y;
      
      if (draggingLabelRef.current.type === 'comment') {
        // Store absolute position for comments
        liveDragOffsetRef.current = { 
          x: dragStartRef.current.labelX + dx, 
          y: dragStartRef.current.labelY + dy 
        };
      } else {
        // Store offset for dimension/angle labels
        liveDragOffsetRef.current = { 
          x: dragStartRef.current.labelX + dx, 
          y: dragStartRef.current.labelY + dy 
        };
      }
      
      // Directly call draw via ref (avoids stale closure)
      drawCanvasRef.current?.();
      return;
    }
    
    if (e.touches.length === 2 && isPanningRef.current) {
      e.preventDefault();
      
      const newDist = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistRef.current !== null) {
        const scaleDelta = newDist / lastTouchDistRef.current;
        const newZoom = Math.min(Math.max(zoom * scaleDelta, 0.25), 4);
        
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const centerX = newCenter.x - rect.left;
          const centerY = newCenter.y - rect.top;
          
          const worldX = (centerX - panOffset.x) / zoom;
          const worldY = (centerY - panOffset.y) / zoom;
          
          const newPanX = centerX - worldX * newZoom;
          const newPanY = centerY - worldY * newZoom;
          
          setZoom(newZoom);
          setPanOffset({ x: newPanX, y: newPanY });
        }
      }
      
      if (lastTouchCenterRef.current !== null) {
        const dx = newCenter.x - lastTouchCenterRef.current.x;
        const dy = newCenter.y - lastTouchCenterRef.current.y;
        setPanOffset(prev => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }
      
      lastTouchDistRef.current = newDist;
      lastTouchCenterRef.current = newCenter;
    } else if (e.touches.length === 1 && singleTouchStartRef.current && lastSingleTouchRef.current) {
      const touch = e.touches[0];
      const startPos = singleTouchStartRef.current;
      
      // Calculate distance from start position
      const dx = touch.clientX - startPos.x;
      const dy = touch.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If moved more than threshold (15px), start panning
      if (distance > 15 || isSingleFingerPanningRef.current) {
        e.preventDefault();
        isSingleFingerPanningRef.current = true;
        
        // Calculate movement delta from last position
        const moveDx = touch.clientX - lastSingleTouchRef.current.x;
        const moveDy = touch.clientY - lastSingleTouchRef.current.y;
        
        setPanOffset(prev => ({
          x: prev.x + moveDx,
          y: prev.y + moveDy,
        }));
        
        lastSingleTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, [zoom, panOffset, screenToWorld]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Commit the live drag offset to state on touch end (use ref for current value)
    const currentDrag = draggingLabelRef.current;
    const wasTouchingDraggable = touchedDraggableRef.current;
    const liveOffset = liveDragOffsetRef.current;
    
    if (currentDrag && liveOffset) {
      if (currentDrag.type === 'comment') {
        // Commit absolute position for comments - capture values before state update
        const newX = liveOffset.x;
        const newY = liveOffset.y;
        setComments(prev => prev.map((c, idx) => 
          idx === currentDrag.index
            ? { ...c, x: newX, y: newY }
            : c
        ));
      } else {
        // Commit offset for dimension/angle labels
        const key = `${currentDrag.type}-${currentDrag.index}`;
        const offsetCopy = { x: liveOffset.x, y: liveOffset.y };
        setCurrentProfile(prev => ({
          ...prev,
          labelOffsets: {
            ...prev.labelOffsets,
            [key]: offsetCopy
          }
        }));
      }
      liveDragOffsetRef.current = null;
      setDraggingLabel(null);
      draggingLabelRef.current = null;
      dragStartRef.current = null;
      touchedDraggableRef.current = false;
      return;
    }
    
    // Clear dragging state if no live offset (touch was on draggable but didn't move)
    // This means it was a tap - open edit dialog for comments
    if (currentDrag) {
      if (currentDrag.type === 'comment') {
        // It was a tap on a comment - open edit dialog
        const commentIndex = currentDrag.index;
        const comment = comments[commentIndex];
        if (comment) {
          setEditingCommentIndex(commentIndex);
          setEditCommentText(comment.text);
        }
      }
      liveDragOffsetRef.current = null;
      setDraggingLabel(null);
      draggingLabelRef.current = null;
      dragStartRef.current = null;
      touchedDraggableRef.current = false;
      return;
    }
    
    const wasPanning = isPanningRef.current;
    const wasSingleFingerPanning = isSingleFingerPanningRef.current;
    
    if (e.touches.length < 2) {
      if (isPanningRef.current) {
        gestureEndTimeRef.current = Date.now();
      }
      isPanningRef.current = false;
      lastTouchDistRef.current = null;
      lastTouchCenterRef.current = null;
    }
    
    // Handle single finger touch end
    if (e.touches.length === 0) {
      if (isSingleFingerPanningRef.current) {
        gestureEndTimeRef.current = Date.now();
      }
      isSingleFingerPanningRef.current = false;
      singleTouchStartRef.current = null;
      lastSingleTouchRef.current = null;
    }
    
    const timeSinceGesture = Date.now() - gestureEndTimeRef.current;
    const recentlyPanned = timeSinceGesture < 300;
    
    // Skip interaction if we touched a draggable element (prevents edit dialog when trying to drag)
    // This handles the case where touch started on draggable but currentDrag was cleared
    if (wasTouchingDraggable) {
      touchedDraggableRef.current = false;
      return;
    }
    
    // Only trigger interaction if it was a tap (not a pan gesture)
    if (e.changedTouches.length === 1 && e.touches.length === 0 && !wasPanning && !wasSingleFingerPanning && !recentlyPanned) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleCanvasInteraction(touch.clientX, touch.clientY);
    }
  }, [handleCanvasInteraction, comments]);

  // Keep touch handler refs in sync
  useEffect(() => {
    touchStartHandlerRef.current = handleTouchStart;
  }, [handleTouchStart]);
  
  useEffect(() => {
    touchMoveHandlerRef.current = handleTouchMove;
  }, [handleTouchMove]);
  
  useEffect(() => {
    touchEndHandlerRef.current = handleTouchEnd;
  }, [handleTouchEnd]);

  // Attach native touch event listeners with { passive: false } for proper preventDefault support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const onTouchStart = (e: TouchEvent) => touchStartHandlerRef.current?.(e);
    const onTouchMove = (e: TouchEvent) => touchMoveHandlerRef.current?.(e);
    const onTouchEnd = (e: TouchEvent) => touchEndHandlerRef.current?.(e);
    
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  
  const addComment = useCallback(() => {
    if (!newCommentText.trim()) return;
    
    // Place comment in center of current view
    const centerX = (canvasSize.width / 2 - panOffset.x) / zoom;
    const centerY = (canvasSize.height / 2 - panOffset.y) / zoom;
    
    const newComment: CommentBubble = {
      id: `comment-${Date.now()}`,
      text: newCommentText.trim(),
      x: centerX - 40,
      y: centerY - 15,
      width: Math.max(80, newCommentText.trim().length * 7),
      height: 24,
    };
    
    setComments(prev => [...prev, newComment]);
    setNewCommentText("");
    setShowAddComment(false);
    toast({ title: "Comment added - drag to reposition" });
  }, [newCommentText, canvasSize, panOffset, zoom, toast]);
  
  const deleteComment = useCallback((index: number) => {
    setComments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateComment = useCallback(() => {
    if (editingCommentIndex === null || !editCommentText.trim()) return;
    
    setComments(prev => prev.map((c, idx) => 
      idx === editingCommentIndex
        ? { ...c, text: editCommentText.trim(), width: Math.max(80, editCommentText.trim().length * 7) }
        : c
    ));
    setEditingCommentIndex(null);
    setEditCommentText("");
    toast({ title: "Comment updated" });
  }, [editingCommentIndex, editCommentText, toast]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 4));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.25));
  };

  const handleFitToScreen = () => {
    if (currentProfile.points.length < 2) {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      return;
    }
    
    const xs = currentProfile.points.map(p => p.x);
    const ys = currentProfile.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const profileWidth = maxX - minX;
    const profileHeight = maxY - minY;
    
    const padding = 80;
    const availableWidth = canvasSize.width - padding * 2;
    const availableHeight = canvasSize.height - padding * 2;
    
    const scaleX = availableWidth / (profileWidth || 1);
    const scaleY = availableHeight / (profileHeight || 1);
    const newZoom = Math.min(scaleX, scaleY, 2);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newPanX = canvasSize.width / 2 - centerX * newZoom;
    const newPanY = canvasSize.height / 2 - centerY * newZoom;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const applyDimensionEdit = () => {
    if (!editingLabel || editingLabel.type !== "dimension") return;
    
    const newLength = parseFloat(editValue);
    if (isNaN(newLength) || newLength <= 0) {
      toast({ title: "Invalid length", variant: "destructive" });
      return;
    }
    
    const segIndex = editingLabel.index;
    const p1 = currentProfile.points[segIndex - 1];
    const p2 = currentProfile.points[segIndex];
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);
    
    if (currentLength === 0) return;
    
    const ratio = newLength / currentLength;
    const newX = p1.x + dx * ratio;
    const newY = p1.y + dy * ratio;
    
    const delta = { x: newX - p2.x, y: newY - p2.y };
    
    setCurrentProfile(prev => ({
      ...prev,
      points: prev.points.map((p, i) => 
        i >= segIndex ? { x: p.x + delta.x, y: p.y + delta.y } : p
      ),
    }));
    
    setEditingLabel(null);
    toast({ title: `Length updated to ${newLength}mm` });
  };

  const applyAngleEdit = () => {
    if (!editingLabel || editingLabel.type !== "angle") return;
    
    const newAngle = parseFloat(editValue);
    if (isNaN(newAngle) || newAngle <= 0 || newAngle >= 180) {
      toast({ title: "Angle must be between 1° and 179°", variant: "destructive" });
      return;
    }
    
    const vertexIndex = editingLabel.index;
    const p1 = currentProfile.points[vertexIndex - 1];
    const p2 = currentProfile.points[vertexIndex];
    const p3 = currentProfile.points[vertexIndex + 1];
    
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const currentOutDir = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    
    const v1Dir = Math.atan2(v1.y, v1.x);
    
    const cross = v1.x * (p3.y - p2.y) - v1.y * (p3.x - p2.x);
    const side = cross >= 0 ? 1 : -1;
    
    const newAngleRad = newAngle * (Math.PI / 180);
    const newOutDir = v1Dir + side * newAngleRad;
    
    // Calculate the rotation angle (how much we need to rotate the outgoing segment)
    const rotationAngle = newOutDir - currentOutDir;
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    
    // Rotate all points after the vertex around p2 (the bend point)
    // This preserves all subsequent angles
    setCurrentProfile(prev => ({
      ...prev,
      points: prev.points.map((p, i) => {
        if (i <= vertexIndex) return p;
        // Rotate point around p2
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        return {
          x: p2.x + dx * cos - dy * sin,
          y: p2.y + dx * sin + dy * cos,
        };
      }),
    }));
    
    // Update the stored original angle for this vertex
    setOriginalAngles(prev => ({
      ...prev,
      [vertexIndex]: newAngle,
    }));
    
    setEditingLabel(null);
    toast({ title: `Angle updated to ${newAngle}°` });
  };

  const handleEditSubmit = () => {
    if (!editingLabel) return;
    
    if (editingLabel.type === "dimension") {
      applyDimensionEdit();
    } else {
      applyAngleEdit();
    }
  };

  const calculateGirth = useCallback(() => {
    let total = 0;
    for (let i = 1; i < currentProfile.points.length; i++) {
      const p1 = currentProfile.points[i - 1];
      const p2 = currentProfile.points[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.round(total);
  }, [currentProfile.points]);

  const handleUndo = () => {
    setCurrentProfile(prev => {
      const newLength = prev.points.length - 1;
      // Remove angle for the point that will now be the last point (no longer a middle point)
      if (newLength >= 1) {
        setOriginalAngles(prevAngles => {
          const newAngles = { ...prevAngles };
          delete newAngles[newLength - 1];
          return newAngles;
        });
      }
      return {
        ...prev,
        points: prev.points.slice(0, -1),
      };
    });
  };

  const handleClear = () => {
    setCurrentProfile(prev => ({ ...prev, points: [] }));
    setOriginalAngles({}); // Clear stored angles when clearing canvas
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setEditingProfileIndex(null);
    setStartFold({ type: 'none', length: 10, direction: 'up' });
    setEndFold({ type: 'none', length: 10, direction: 'up' });
  };

  const rotatePointsByAngle = useCallback((originalPoints: Point[], angleDegrees: number): Point[] => {
    if (originalPoints.length < 2) return originalPoints;
    
    const centerX = originalPoints.reduce((sum, p) => sum + p.x, 0) / originalPoints.length;
    const centerY = originalPoints.reduce((sum, p) => sum + p.y, 0) / originalPoints.length;
    
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    // Don't snap to grid during free rotation - this preserves exact angles
    return originalPoints.map(p => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      };
    });
  }, []);

  const handleRotateStart = (clientX: number) => {
    if (currentProfile.points.length < 2) return;
    setIsRotating(true);
    rotateStartXRef.current = clientX;
    rotateStartPointsRef.current = [...currentProfile.points];
  };

  const handleRotateMove = (clientX: number) => {
    if (!isRotating || rotateStartPointsRef.current.length < 2) return;
    
    const deltaX = clientX - rotateStartXRef.current;
    const angleDegrees = deltaX * 0.5; // 0.5 degrees per pixel for smooth rotation
    
    const rotatedPoints = rotatePointsByAngle(rotateStartPointsRef.current, angleDegrees);
    setCurrentProfile(prev => ({ ...prev, points: rotatedPoints }));
  };

  const handleRotateEnd = () => {
    setIsRotating(false);
  };

  const handleRotate = () => {
    if (currentProfile.points.length < 2) return;
    
    const points = currentProfile.points;
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    
    const rotatedPoints = points.map(p => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      return {
        x: snapToGrid(centerX - dy),
        y: snapToGrid(centerY + dx),
      };
    });
    
    setCurrentProfile(prev => ({ ...prev, points: rotatedPoints }));
  };

  const handleEditProfile = (index: number) => {
    const profile = profiles[index];
    setCurrentProfile({
      ...profile,
      id: profile.id,
    });
    setColorSide(profile.colorSide || null);
    setStartFold(profile.startFold || { type: 'none', length: 10, direction: 'up' });
    setEndFold(profile.endFold || { type: 'none', length: 10, direction: 'up' });
    setEditingProfileIndex(index);
    setShowCuttingList(false);
    toast({
      title: "Editing Profile",
      description: `Now editing ${profile.code}. Make changes and tap Done to update.`,
    });
  };

  const handleDone = async () => {
    if (currentProfile.points.length >= 2) {
      const girth = calculateGirth();
      const newProfile: ProfileState = {
        ...currentProfile,
        name: currentProfile.name || `Profile ${currentProfile.code}`,
        colorSide: colorSide,
        startFold: startFold.type !== 'none' ? startFold : undefined,
        endFold: endFold.type !== 'none' ? endFold : undefined,
      };
      
      const isEditing = editingProfileIndex !== null;
      const wasEditingIndex = editingProfileIndex;
      
      // Save to backend first if we have an order
      if (currentOrderId) {
        setIsSaving(true);
        try {
          const savedProfile = await saveProfileMutation.mutateAsync(newProfile);
          
          // Update local state with server-assigned ID
          const profileWithId = savedProfile ? { ...newProfile, id: savedProfile.id } : newProfile;
          
          if (isEditing && wasEditingIndex !== null) {
            setProfiles(prev => prev.map((p, i) => i === wasEditingIndex ? profileWithId : p));
            toast({ title: `Profile ${profileWithId.code} updated (${girth}mm girth)` });
            setEditingProfileIndex(null);
          } else {
            setProfiles(prev => [...prev, profileWithId]);
            toast({ title: `Profile ${profileWithId.code} added (${girth}mm girth)` });
          }
          
          // Reset editor state after successful save
          const nextNum = profiles.length + (isEditing ? 1 : 2);
          setCurrentProfile({
            code: `A${nextNum}`,
            name: "",
            points: [],
            material: currentProfile.material,
            thickness: currentProfile.thickness,
            quantity: 1,
            lengthMm: 3000,
          });
          
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
        } catch (error) {
          console.error('Failed to save profile:', error);
          toast({ 
            title: "Failed to save profile", 
            description: "Changes were not saved. Please try again.",
            variant: "destructive" 
          });
        } finally {
          setIsSaving(false);
        }
      } else {
        // No order yet - just update local state (will be saved when order is created)
        if (isEditing && wasEditingIndex !== null) {
          setProfiles(prev => prev.map((p, i) => i === wasEditingIndex ? newProfile : p));
          toast({ title: `Profile ${newProfile.code} updated (${girth}mm girth)` });
          setEditingProfileIndex(null);
        } else {
          setProfiles(prev => [...prev, newProfile]);
          toast({ title: `Profile ${newProfile.code} added (${girth}mm girth)` });
        }
        
        const nextNum = profiles.length + (isEditing ? 1 : 2);
        setCurrentProfile({
          code: `A${nextNum}`,
          name: "",
          points: [],
          material: currentProfile.material,
          thickness: currentProfile.thickness,
          quantity: 1,
          lengthMm: 3000,
        });
        
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleCancel = () => {
    if (currentProfile.points.length > 0) {
      handleClear();
    } else {
      setLocation(isMobile ? "/mobile/more" : "/");
    }
  };

  const removeProfile = async (index: number) => {
    const profileToRemove = profiles[index];
    setProfiles(prev => prev.filter((_, i) => i !== index));
    
    // Delete from backend if profile has an ID
    if (profileToRemove.id) {
      try {
        await deleteProfileMutation.mutateAsync(profileToRemove.id);
      } catch (error) {
        console.error('Failed to delete profile:', error);
        // Re-add the profile if deletion failed
        setProfiles(prev => [...prev.slice(0, index), profileToRemove, ...prev.slice(index)]);
        toast({ title: "Failed to delete profile", variant: "destructive" });
      }
    }
  };

  const generatePdf = async () => {
    if (profiles.length === 0) {
      toast({ title: "No profiles to export", variant: "destructive" });
      return;
    }
    
    setIsGeneratingPdf(true);
    
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const cardWidth = (pageWidth - margin * 3) / 2;
      const cardHeight = 110;
      const date = formatDateShort(new Date());
      const dateTime = formatDateTime(new Date());
      
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };
      
      const calculateGirth = (points: Point[]): number => {
        let total = 0;
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i-1].x;
          const dy = points[i].y - points[i-1].y;
          total += Math.sqrt(dx * dx + dy * dy);
        }
        return Math.round(total);
      };
      
      const countFolds = (points: Point[]): number => {
        return Math.max(0, points.length - 2);
      };
      
      const drawProfileCard = (
        profile: ProfileState, 
        cardX: number, 
        cardY: number, 
        cardNum: number,
        profileColorSide: 'left' | 'right' | null
      ) => {
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.3);
        pdf.rect(cardX, cardY, cardWidth, cardHeight);
        
        pdf.setFontSize(9);
        pdf.setTextColor(0);
        pdf.text(`${cardNum}`, cardX + 3, cardY + 5);
        
        const girth = calculateGirth(profile.points);
        const folds = countFolds(profile.points);
        
        pdf.setFontSize(8);
        pdf.text('Colour / Material', cardX + 12, cardY + 5);
        pdf.text('CODE', cardX + cardWidth - 35, cardY + 5);
        pdf.text('F', cardX + cardWidth - 20, cardY + 5);
        pdf.text('GIRTH', cardX + cardWidth - 12, cardY + 5);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${profile.material}`, cardX + 12, cardY + 12);
        pdf.text(`${profile.code}`, cardX + cardWidth - 35, cardY + 12);
        pdf.text(`${folds}`, cardX + cardWidth - 20, cardY + 12);
        pdf.text(`${girth.toLocaleString()}`, cardX + cardWidth - 12, cardY + 12);
        pdf.setFont('helvetica', 'normal');
        
        const totalLM = (profile.quantity * profile.lengthMm / 1000).toFixed(1);
        pdf.setFontSize(9);
        pdf.text(`Q x L ${profile.quantity} x ${profile.lengthMm.toLocaleString()}`, cardX + 3, cardY + cardHeight - 5);
        pdf.text(`T - ${totalLM}`, cardX + cardWidth - 20, cardY + cardHeight - 5);
        
        const points = profile.points;
        if (points.length >= 2) {
          const drawAreaX = cardX + 8;
          const drawAreaY = cardY + 20;
          const drawAreaW = cardWidth - 16;
          const drawAreaH = cardHeight - 35;
          
          const minX = Math.min(...points.map(p => p.x));
          const maxX = Math.max(...points.map(p => p.x));
          const minY = Math.min(...points.map(p => p.y));
          const maxY = Math.max(...points.map(p => p.y));
          
          const profileWidth = maxX - minX || 1;
          const profileHeight = maxY - minY || 1;
          const scaleX = drawAreaW / profileWidth;
          const scaleY = drawAreaH / profileHeight;
          const scale = Math.min(scaleX, scaleY) * 0.7;
          
          const offsetX = drawAreaX + (drawAreaW - profileWidth * scale) / 2;
          const offsetY = drawAreaY + (drawAreaH - profileHeight * scale) / 2;
          
          pdf.setDrawColor(0);
          pdf.setLineWidth(0.8);
          
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const x1 = offsetX + (p1.x - minX) * scale;
            const y1 = offsetY + (p1.y - minY) * scale;
            const x2 = offsetX + (p2.x - minX) * scale;
            const y2 = offsetY + (p2.y - minY) * scale;
            pdf.line(x1, y1, x2, y2);
          }
          
          pdf.setFontSize(6);
          pdf.setTextColor(0);
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.round(Math.sqrt(dx * dx + dy * dy));
            const segLen = Math.sqrt(dx * dx + dy * dy) * scale;
            
            const midX = offsetX + ((p1.x + p2.x) / 2 - minX) * scale;
            const midY = offsetY + ((p1.y + p2.y) / 2 - minY) * scale;
            
            const perpX = -dy / Math.sqrt(dx * dx + dy * dy);
            const perpY = dx / Math.sqrt(dx * dx + dy * dy);
            const offset = 3;
            
            pdf.text(`${len}`, midX + perpX * offset, midY + perpY * offset, { align: 'center' });
          }
          
          if (profileColorSide && points.length >= 2) {
            let totalGirth = 0;
            const segments: { p1: Point, p2: Point, length: number, startDist: number }[] = [];
            
            for (let i = 0; i < points.length - 1; i++) {
              const p1 = points[i];
              const p2 = points[i + 1];
              const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
              segments.push({ p1, p2, length: segLen, startDist: totalGirth });
              totalGirth += segLen;
            }
            
            const halfGirth = totalGirth / 2;
            let midSegment = segments[0];
            let distIntoSegment = halfGirth;
            for (const seg of segments) {
              if (halfGirth >= seg.startDist && halfGirth < seg.startDist + seg.length) {
                midSegment = seg;
                distIntoSegment = halfGirth - seg.startDist;
                break;
              }
            }
            
            const t = midSegment.length > 0 ? distIntoSegment / midSegment.length : 0;
            const midPtX = midSegment.p1.x + t * (midSegment.p2.x - midSegment.p1.x);
            const midPtY = midSegment.p1.y + t * (midSegment.p2.y - midSegment.p1.y);
            
            const dx = midSegment.p2.x - midSegment.p1.x;
            const dy = midSegment.p2.y - midSegment.p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            let perpX = len > 0 ? -dy / len : 0;
            let perpY = len > 0 ? dx / len : 1;
            
            if (profileColorSide === 'right') {
              perpX = -perpX;
              perpY = -perpY;
            }
            
            const linePointX = offsetX + (midPtX - minX) * scale;
            const linePointY = offsetY + (midPtY - minY) * scale;
            const arrowLen = 8;
            const arrowStartX = linePointX + perpX * arrowLen;
            const arrowStartY = linePointY + perpY * arrowLen;
            const arrowEndX = linePointX;
            const arrowEndY = linePointY;
            
            pdf.setDrawColor(0);
            pdf.setLineWidth(0.5);
            pdf.line(arrowStartX, arrowStartY, arrowEndX, arrowEndY);
            
            const headLen = 2;
            const headAngle = Math.PI / 6;
            const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
            pdf.line(
              arrowEndX,
              arrowEndY,
              arrowEndX - headLen * Math.cos(angle - headAngle),
              arrowEndY - headLen * Math.sin(angle - headAngle)
            );
            pdf.line(
              arrowEndX,
              arrowEndY,
              arrowEndX - headLen * Math.cos(angle + headAngle),
              arrowEndY - headLen * Math.sin(angle + headAngle)
            );
          }
        }
      };
      
      const addPageHeader = (pageNum: number) => {
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text('SBL Roofing Pty Ltd', margin, 6);
        
        pdf.setFontSize(10);
        pdf.setTextColor(0);
        pdf.text('Flashing Order', pageWidth / 2, 6, { align: 'center' });
        
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`Order Date: ${dateTime}`, pageWidth - margin, 6, { align: 'right' });
        
        pdf.setFontSize(7);
        pdf.text('\u2022 Arrow points to the (solid) coloured side', margin, 12);
        pdf.text('\u2022 F = Total number of folds', margin, 16);
        pdf.text('*** PLEASE WRITE ALL CODES ON FLASHINGS ***', pageWidth - margin, 14, { align: 'right' });
      };
      
      addPageHeader(1);
      
      let yPos = 22;
      const cardsPerRow = 2;
      const rowsPerPage = Math.floor((pageHeight - 30) / (cardHeight + 5));
      
      profiles.forEach((profile, idx) => {
        const row = Math.floor(idx / cardsPerRow);
        const col = idx % cardsPerRow;
        const pageRow = row % rowsPerPage;
        
        if (row > 0 && row % rowsPerPage === 0 && col === 0) {
          pdf.addPage();
          addPageHeader(Math.floor(row / rowsPerPage) + 1);
        }
        
        const cardX = margin + col * (cardWidth + margin);
        const cardY = 22 + pageRow * (cardHeight + 5);
        
        drawProfileCard(profile, cardX, cardY, idx + 1, colorSide);
      });
      
      pdf.addPage();
      addPageHeader(0);
      
      pdf.setFontSize(14);
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Cutting List & Order Sheet', pageWidth / 2, 25, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      
      const tableStartY = 35;
      const colWidths = [8, 30, 10, 12, 18, 25, 18];
      const headers = ['#', 'Colour / Material', 'CODE', 'Fold', 'Girth', 'Q x L', 'T - LM'];
      
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, tableStartY, pageWidth - margin * 2, 8, 'F');
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      let colX = margin + 2;
      headers.forEach((header, i) => {
        pdf.text(header, colX, tableStartY + 5);
        colX += colWidths[i];
      });
      pdf.setFont('helvetica', 'normal');
      
      const sortedProfiles = [...profiles].sort((a, b) => {
        if (a.material !== b.material) return a.material.localeCompare(b.material);
        return calculateGirth(a.points) - calculateGirth(b.points);
      });
      
      let rowY = tableStartY + 10;
      let totalFolds = 0;
      let totalLM = 0;
      let totalSqm = 0;
      
      sortedProfiles.forEach((profile, idx) => {
        const girth = calculateGirth(profile.points);
        const folds = countFolds(profile.points);
        const lm = profile.quantity * profile.lengthMm / 1000;
        const sqm = (girth / 1000) * (profile.lengthMm / 1000) * profile.quantity;
        
        totalFolds += folds * profile.quantity;
        totalLM += lm;
        totalSqm += sqm;
        
        const originalIdx = profiles.indexOf(profile) + 1;
        
        if (idx % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, rowY - 3, pageWidth - margin * 2, 6, 'F');
        }
        
        pdf.setFontSize(8);
        colX = margin + 2;
        pdf.text(`${originalIdx}`, colX, rowY);
        colX += colWidths[0];
        pdf.text(profile.material, colX, rowY);
        colX += colWidths[1];
        pdf.text(profile.code, colX, rowY);
        colX += colWidths[2];
        pdf.text(`${folds}`, colX, rowY);
        colX += colWidths[3];
        pdf.text(girth.toLocaleString(), colX, rowY);
        colX += colWidths[4];
        pdf.text(`${profile.quantity} x ${profile.lengthMm.toLocaleString()}`, colX, rowY);
        colX += colWidths[5];
        pdf.text(`${lm.toFixed(1)} LM`, colX, rowY);
        
        rowY += 6;
      });
      
      rowY += 5;
      pdf.setDrawColor(0);
      pdf.line(margin, rowY - 3, pageWidth - margin, rowY - 3);
      
      rowY += 5;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      
      const summaryY = rowY;
      const summaryColWidth = (pageWidth - margin * 2) / 4;
      
      pdf.text('Total Flashings', margin, summaryY);
      pdf.text('Total Folds', margin + summaryColWidth, summaryY);
      pdf.text('Total LM', margin + summaryColWidth * 2, summaryY);
      pdf.text('Total Sqm', margin + summaryColWidth * 3, summaryY);
      
      pdf.setFontSize(12);
      pdf.text(`${profiles.length}`, margin, summaryY + 7);
      pdf.text(`${totalFolds}`, margin + summaryColWidth, summaryY + 7);
      pdf.text(`${totalLM.toFixed(1)} LM`, margin + summaryColWidth * 2, summaryY + 7);
      pdf.text(`${totalSqm.toFixed(4)} Sqm`, margin + summaryColWidth * 3, summaryY + 7);
      
      pdf.setFont('helvetica', 'normal');
      
      pdf.save(`flashing-order-${date.replace(/\s/g, '-')}.pdf`);
      toast({ title: "PDF downloaded successfully" });
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const createPO = async () => {
    if (profiles.length === 0) {
      toast({ title: "No profiles to add to PO", variant: "destructive" });
      return;
    }
    
    setIsCreatingPO(true);
    
    try {
      const poNumber = await getNextPONumber();
      
      const items = profiles.map((profile, idx) => {
        let girthTotal = 0;
        for (let i = 1; i < profile.points.length; i++) {
          const p1 = profile.points[i - 1];
          const p2 = profile.points[i];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          girthTotal += Math.sqrt(dx * dx + dy * dy);
        }
        girthTotal = Math.round(girthTotal);
        
        const description = `${profile.code} - Custom Flashing ${profile.material} ${profile.thickness}\nGirth: ${girthTotal}mm × Length: ${profile.lengthMm}mm`;
        const unitCost = 0;
        
        return {
          productId: null,
          itemCode: profile.code,
          description,
          qty: profile.quantity,
          unitCost,
          total: unitCost * profile.quantity,
          sortOrder: idx,
          section: null,
        };
      });
      
      const today = getTodayInput();
      
      const po = await createPurchaseOrder({
        id: crypto.randomUUID(),
        poNumber,
        supplier: 'Custom Flashings Supplier',
        supplierContact: '',
        supplierPhone: '',
        supplierEmail: '',
        status: 'draft',
        orderDate: today,
        description: `Custom flashing order - ${profiles.length} profile(s)`,
        subtotal: 0,
        gst: 0,
        total: 0,
        taxMode: 'exclusive',
        discount: 0,
        items,
      });
      
      toast({ title: `Purchase Order ${poNumber} created` });
      setLocation(`/purchase-orders/${po.id}`);
      
    } catch (error) {
      console.error('PO creation error:', error);
      toast({ title: "Failed to create PO", variant: "destructive" });
    } finally {
      setIsCreatingPO(false);
    }
  };

  const totalItems = profiles.reduce((sum, p) => sum + p.quantity, 0);
  const girth = calculateGirth();
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-2 h-11 bg-[#1a1a1a] border-b border-[#333]">
        <Button 
          variant="ghost" 
          onClick={handleCancel}
          className="text-red-500 hover:text-red-400 hover:bg-transparent h-9 px-2 text-sm"
          data-testid="button-cancel"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <h1 className="text-white font-bold text-base">DESIGNER</h1>
        <Button 
          variant="ghost" 
          onClick={handleDone}
          disabled={currentProfile.points.length < 2}
          className="text-red-500 hover:text-red-400 hover:bg-transparent h-9 px-2 text-sm disabled:opacity-50"
          data-testid="button-done"
        >
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 relative overflow-hidden select-none"
        style={{ 
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full touch-none select-none"
          style={{ 
            width: canvasSize.width, 
            height: canvasSize.height,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none'
          }}
          data-testid="canvas-drawing"
        />
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowProfileSettings(true)}
            className="h-10 w-10 bg-[#2a2a2a]/80 border-[#444] text-white hover:bg-[#3a3a3a]"
            data-testid="button-profile-settings"
          >
            <Briefcase className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            className="h-10 w-10 bg-[#2a2a2a]/80 border-[#444] text-white hover:bg-[#3a3a3a]"
            data-testid="button-zoom-in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            className="h-10 w-10 bg-[#2a2a2a]/80 border-[#444] text-white hover:bg-[#3a3a3a]"
            data-testid="button-zoom-out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleFitToScreen}
            className="h-10 w-10 bg-[#2a2a2a]/80 border-[#444] text-white hover:bg-[#3a3a3a]"
            data-testid="button-fit"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowAddComment(true)}
            className="h-10 w-10 bg-[#2a2a2a]/80 border-[#444] text-sky-400 hover:bg-[#3a3a3a]"
            data-testid="button-add-comment"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <div className="text-center text-[10px] text-gray-400">
            {zoomPercent}%
          </div>
        </div>
        
        {/* Touch Rotation Slider - compact */}
        {currentProfile.points.length >= 2 && (
          <div 
            className="absolute bottom-2 left-2 right-2 h-10 bg-[#2a2a2a]/90 border border-[#444] rounded-lg flex items-center justify-center gap-2 px-3 touch-none select-none"
            onMouseDown={(e) => handleRotateStart(e.clientX)}
            onMouseMove={(e) => handleRotateMove(e.clientX)}
            onMouseUp={handleRotateEnd}
            onMouseLeave={handleRotateEnd}
            onTouchStart={(e) => handleRotateStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleRotateMove(e.touches[0].clientX)}
            onTouchEnd={handleRotateEnd}
            data-testid="rotate-slider"
          >
            <RotateCcw className={`h-4 w-4 ${isRotating ? 'text-red-500' : 'text-gray-500'}`} />
            <div className="flex-1 flex items-center justify-center">
              <div className={`text-xs font-medium ${isRotating ? 'text-red-500' : 'text-gray-400'}`}>
                {isRotating ? 'Slide to rotate' : 'Hold & slide to rotate'}
              </div>
            </div>
            <RotateCw className={`h-4 w-4 ${isRotating ? 'text-red-500' : 'text-gray-500'}`} />
          </div>
        )}
        
        {/* Fold Type Dropdown Overlay */}
        {activeFoldDropdown && (
          <div 
            className="absolute inset-0 z-20"
            onClick={() => setActiveFoldDropdown(null)}
          >
            <div 
              className={`absolute ${activeFoldDropdown === 'start' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 bg-[#2a2a2a] border border-[#444] rounded-xl shadow-2xl p-2 min-w-[160px]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-gray-400 px-3 py-2 font-medium">
                {activeFoldDropdown === 'start' ? 'START' : 'END'} FOLD
              </div>
              {END_FOLD_OPTIONS.map(opt => {
                const currentFold = activeFoldDropdown === 'start' ? startFold : endFold;
                const isSelected = currentFold.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (activeFoldDropdown === 'start') {
                        setStartFold(prev => ({ ...prev, type: opt.value }));
                      } else {
                        setEndFold(prev => ({ ...prev, type: opt.value }));
                      }
                      if (opt.value === 'none') {
                        setActiveFoldDropdown(null);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                      isSelected ? "bg-red-500 text-white" : "hover:bg-[#3a3a3a] text-white"
                    }`}
                    data-testid={`fold-option-${opt.value}`}
                  >
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {opt.abbrev && <span className="bg-black/30 px-1.5 py-0.5 rounded text-xs">{opt.abbrev}</span>}
                        {opt.label}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
              
              {/* Length and Direction controls when fold is selected */}
              {(activeFoldDropdown === 'start' ? startFold.type : endFold.type) !== 'none' && (
                <div className="mt-2 pt-2 border-t border-[#444]">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-gray-400">Length</span>
                    <div className="flex items-center gap-1">
                      {[5, 10, 15, 20].map(len => (
                        <button
                          key={len}
                          onClick={() => {
                            if (activeFoldDropdown === 'start') {
                              setStartFold(prev => ({ ...prev, length: len }));
                            } else {
                              setEndFold(prev => ({ ...prev, length: len }));
                            }
                          }}
                          className={`w-10 h-8 rounded text-xs font-medium transition-all ${
                            (activeFoldDropdown === 'start' ? startFold.length : endFold.length) === len
                              ? "bg-red-500 text-white" 
                              : "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white"
                          }`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-gray-400">Direction</span>
                    <button
                      onClick={() => {
                        if (activeFoldDropdown === 'start') {
                          setStartFold(prev => ({ ...prev, direction: prev.direction === 'up' ? 'down' : 'up' }));
                        } else {
                          setEndFold(prev => ({ ...prev, direction: prev.direction === 'up' ? 'down' : 'up' }));
                        }
                      }}
                      className="flex items-center gap-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] px-3 py-1.5 rounded text-sm"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        (activeFoldDropdown === 'start' ? startFold : endFold).direction === 'up' ? 'rotate-180' : ''
                      }`} />
                      {(activeFoldDropdown === 'start' ? startFold : endFold).direction === 'up' ? 'Up' : 'Down'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Combined compact footer - single row */}
      <div className="bg-[#1a1a1a] border-t border-[#444] px-2">
        <div className="flex items-center justify-between h-12">
          {/* Left: Girth info */}
          <div className="text-white text-xs">
            <span className="text-gray-500">GIRTH:</span>
            <span className="font-bold ml-1">{girth}</span>
            <button
              onClick={() => setShowGridMenu(true)}
              className="text-gray-500 hover:text-white ml-2"
              data-testid="button-grid-menu"
            >
              {gridSize}mm
            </button>
          </div>
          
          {/* Right: Toolbar buttons in single row */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleUndo}
              disabled={currentProfile.points.length === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 p-2"
              data-testid="toolbar-undo"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setShowColorPicker(true)}
              className="p-1"
              data-testid="toolbar-color"
            >
              <div 
                className="h-6 w-6 rounded-full border-2 border-white"
                style={{ backgroundColor: COLORBOND_COLORS.find(c => c.name === currentProfile.material)?.hex }}
              />
            </button>
            
            <button
              onClick={handleClear}
              disabled={currentProfile.points.length === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 p-2"
              data-testid="toolbar-clear"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setShowCuttingList(true)}
              className="text-gray-400 hover:text-white p-2 relative"
              data-testid="toolbar-list"
            >
              <Briefcase className="h-5 w-5" />
              {profiles.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {profiles.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <Dialog open={editingLabel !== null} onOpenChange={(open) => !open && setEditingLabel(null)}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {editingLabel?.type === "dimension" ? "Edit Length" : "Edit Angle"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingLabel?.type === "dimension" 
                ? "Enter the new length in millimeters" 
                : "Enter the new angle in degrees"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-14 text-2xl text-center bg-[#3a3a3a] border-[#555] text-white"
                autoFocus
                data-testid="input-edit-value"
              />
              <span className="text-xl text-gray-400">
                {editingLabel?.type === "dimension" ? "mm" : "°"}
              </span>
            </div>
            <Button 
              onClick={handleEditSubmit}
              className="w-full h-12 mt-4 bg-red-500 hover:bg-red-600"
              data-testid="button-apply-edit"
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Colour</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose a Colorbond colour for your flashing
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 py-4">
            {COLORBOND_COLORS.map(color => (
              <button
                key={color.name}
                onClick={() => {
                  setCurrentProfile(prev => ({ ...prev, material: color.name }));
                  setShowColorPicker(false);
                }}
                className={`aspect-square rounded-lg border-2 transition-all ${
                  currentProfile.material === color.name 
                    ? "border-red-500 ring-2 ring-red-500/50 scale-110" 
                    : "border-transparent hover:border-white/50"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                data-testid={`color-${color.name}`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-gray-400">
            Selected: <span className="text-white font-medium">{currentProfile.material}</span>
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={showGridMenu} onOpenChange={setShowGridMenu}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-xs">
          <DialogHeader>
            <DialogTitle>Grid Size</DialogTitle>
            <DialogDescription className="text-gray-400">
              Larger grid makes it easier to tap with gloves
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {GRID_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setGridSize(opt.value);
                  setShowGridMenu(false);
                }}
                className={`w-full h-12 rounded-lg text-left px-4 transition-all ${
                  gridSize === opt.value 
                    ? "bg-red-500 text-white" 
                    : "bg-[#3a3a3a] hover:bg-[#4a4a4a]"
                }`}
                data-testid={`grid-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEndFoldsMenu} onOpenChange={(open) => {
        setShowEndFoldsMenu(open);
        if (!open) setSelectedEndpoint(null);
      }}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedEndpoint === 'start' ? 'Start End Fold' : selectedEndpoint === 'end' ? 'End End Fold' : 'End Folds'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedEndpoint ? 'Select fold type and length' : 'Tap a fold marker on the canvas to edit'}
            </DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                {END_FOLD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (selectedEndpoint === 'start') {
                        setStartFold(prev => ({ ...prev, type: opt.value }));
                      } else {
                        setEndFold(prev => ({ ...prev, type: opt.value }));
                      }
                    }}
                    className={`w-full h-14 rounded-lg text-left px-4 transition-all flex items-center gap-3 ${
                      (selectedEndpoint === 'start' ? startFold.type : endFold.type) === opt.value 
                        ? "bg-red-500 text-white" 
                        : "bg-[#3a3a3a] hover:bg-[#4a4a4a]"
                    }`}
                    data-testid={`fold-type-${opt.value}`}
                  >
                    {opt.value !== 'none' ? (
                      <div className="w-12 h-10 flex items-center justify-center bg-black/20 rounded">
                        <FoldIcon type={opt.value} direction={(selectedEndpoint === 'start' ? startFold : endFold).direction} className="w-10 h-8" />
                      </div>
                    ) : (
                      <div className="w-12 h-10 flex items-center justify-center bg-black/20 rounded text-gray-500">
                        <X className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {opt.abbrev && <span className="bg-black/30 px-2 py-0.5 rounded text-sm">{opt.abbrev}</span>}
                        {opt.label}
                      </div>
                      <div className="text-xs opacity-70">{opt.description}</div>
                    </div>
                    {(selectedEndpoint === 'start' ? startFold.type : endFold.type) === opt.value && <Check className="h-5 w-5" />}
                  </button>
                ))}
              </div>
              
              {(selectedEndpoint === 'start' ? startFold.type : endFold.type) !== 'none' && (
                <>
                  <div>
                    <Label className="text-gray-400 block mb-2">Direction</Label>
                    <button
                      onClick={() => {
                        if (selectedEndpoint === 'start') {
                          setStartFold(prev => ({ ...prev, direction: prev.direction === 'up' ? 'down' : 'up' }));
                        } else {
                          setEndFold(prev => ({ ...prev, direction: prev.direction === 'up' ? 'down' : 'up' }));
                        }
                      }}
                      className="w-full h-14 rounded-lg bg-[#3a3a3a] hover:bg-[#4a4a4a] px-4 flex items-center justify-between"
                      data-testid="toggle-fold-direction"
                    >
                      <span className="flex items-center gap-3">
                        <div className="w-12 h-10 flex items-center justify-center bg-black/20 rounded">
                          <FoldIcon 
                            type={(selectedEndpoint === 'start' ? startFold : endFold).type} 
                            direction={(selectedEndpoint === 'start' ? startFold : endFold).direction}
                            className="w-10 h-8" 
                          />
                        </div>
                        <span>{(selectedEndpoint === 'start' ? startFold : endFold).direction === 'up' ? 'Fold Up' : 'Fold Down'}</span>
                      </span>
                      <ChevronDown className={`h-6 w-6 transition-transform ${(selectedEndpoint === 'start' ? startFold : endFold).direction === 'up' ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  <div>
                    <Label className="text-gray-400 block mb-2">Fold Length (mm)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={(selectedEndpoint === 'start' ? startFold : endFold).length}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 10;
                          if (selectedEndpoint === 'start') {
                            setStartFold(prev => ({ ...prev, length: Math.max(1, Math.min(100, val)) }));
                          } else {
                            setEndFold(prev => ({ ...prev, length: Math.max(1, Math.min(100, val)) }));
                          }
                        }}
                        className="flex-1 h-14 rounded-lg bg-[#3a3a3a] text-white text-center text-xl font-bold border-0 focus:ring-2 focus:ring-red-500"
                        data-testid="input-fold-length"
                      />
                      <span className="text-gray-400 text-lg">mm</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[5, 10, 15, 20, 25].map(len => (
                        <button
                          key={len}
                          onClick={() => {
                            if (selectedEndpoint === 'start') {
                              setStartFold(prev => ({ ...prev, length: len }));
                            } else {
                              setEndFold(prev => ({ ...prev, length: len }));
                            }
                          }}
                          className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                            (selectedEndpoint === 'start' ? startFold.length : endFold.length) === len
                              ? "bg-red-500 text-white" 
                              : "bg-[#3a3a3a] hover:bg-[#4a4a4a]"
                          }`}
                          data-testid={`fold-length-${len}`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {!selectedEndpoint && (
            <div className="space-y-4 py-4">
              <button
                onClick={() => setSelectedEndpoint('start')}
                className="w-full h-16 rounded-lg bg-[#3a3a3a] hover:bg-[#4a4a4a] px-4 flex items-center gap-3"
                data-testid="button-edit-start-fold"
              >
                {startFold.type !== 'none' ? (
                  <div className="w-12 h-10 flex items-center justify-center bg-red-500/20 rounded">
                    <FoldIcon type={startFold.type} direction={startFold.direction} className="w-10 h-8 text-red-500" />
                  </div>
                ) : (
                  <div className="w-12 h-10 rounded bg-red-500 flex items-center justify-center font-bold text-lg">S</div>
                )}
                <div className="text-left flex-1">
                  <div className="font-medium">Start End</div>
                  <div className="text-sm text-gray-400">
                    {startFold.type === 'none' ? 'No fold set' : `${END_FOLD_OPTIONS.find(o => o.value === startFold.type)?.label} ${startFold.length}mm ${startFold.direction === 'up' ? '↑' : '↓'}`}
                  </div>
                </div>
              </button>
              <button
                onClick={() => setSelectedEndpoint('end')}
                className="w-full h-16 rounded-lg bg-[#3a3a3a] hover:bg-[#4a4a4a] px-4 flex items-center gap-3"
                data-testid="button-edit-end-fold"
              >
                {endFold.type !== 'none' ? (
                  <div className="w-12 h-10 flex items-center justify-center bg-red-500/20 rounded">
                    <FoldIcon type={endFold.type} direction={endFold.direction} className="w-10 h-8 text-red-500" />
                  </div>
                ) : (
                  <div className="w-12 h-10 rounded bg-red-500 flex items-center justify-center font-bold text-lg">E</div>
                )}
                <div className="text-left flex-1">
                  <div className="font-medium">End End</div>
                  <div className="text-sm text-gray-400">
                    {endFold.type === 'none' ? 'No fold set' : `${END_FOLD_OPTIONS.find(o => o.value === endFold.type)?.label} ${endFold.length}mm ${endFold.direction === 'up' ? '↑' : '↓'}`}
                  </div>
                </div>
              </button>
            </div>
          )}
          <Button 
            onClick={() => {
              if (selectedEndpoint) {
                setSelectedEndpoint(null);
              } else {
                setShowEndFoldsMenu(false);
              }
            }}
            className="w-full h-12 bg-red-500 hover:bg-red-600"
            data-testid="button-done-end-folds"
          >
            {selectedEndpoint ? 'Back' : 'Done'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileSettings} onOpenChange={setShowProfileSettings}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription className="text-gray-400">
              Configure this flashing profile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">Profile Code</Label>
              <Input 
                value={currentProfile.code}
                onChange={(e) => setCurrentProfile(prev => ({ ...prev, code: e.target.value }))}
                className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1"
                data-testid="input-profile-code"
                autoFocus={false}
              />
            </div>
            <div>
              <Label className="text-gray-400">Thickness (BMT)</Label>
              <Select 
                value={currentProfile.thickness} 
                onValueChange={(v) => setCurrentProfile(prev => ({ ...prev, thickness: v }))}
              >
                <SelectTrigger className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1" data-testid="select-thickness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#3a3a3a] border-[#555]">
                  {THICKNESSES.map(t => (
                    <SelectItem key={t} value={t} className="text-white hover:bg-[#4a4a4a]">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Length (mm)</Label>
              <Input 
                type="number"
                value={currentProfile.lengthMm}
                onChange={(e) => setCurrentProfile(prev => ({ ...prev, lengthMm: parseInt(e.target.value) || 0 }))}
                className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1"
                data-testid="input-length"
              />
            </div>
            <div>
              <Label className="text-gray-400">Quantity</Label>
              <Input 
                type="number"
                value={currentProfile.quantity}
                onChange={(e) => setCurrentProfile(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1"
                min={1}
                data-testid="input-quantity"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-[#444]">
            <Button
              variant="outline"
              onClick={() => setShowProfileSettings(false)}
              className="flex-1 h-12 bg-[#3a3a3a] border-[#555] text-white hover:bg-[#4a4a4a]"
              data-testid="button-cancel-profile"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowProfileSettings(false)}
              className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
              data-testid="button-save-profile"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Comment Dialog */}
      <Dialog open={showAddComment} onOpenChange={setShowAddComment}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a custom annotation to the drawing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">Comment Text</Label>
              <Input 
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Enter your comment..."
                className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1"
                data-testid="input-comment-text"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCommentText.trim()) {
                    addComment();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-[#444]">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddComment(false);
                setNewCommentText("");
              }}
              className="flex-1 h-12 bg-[#3a3a3a] border-[#555] text-white hover:bg-[#4a4a4a]"
              data-testid="button-cancel-comment"
            >
              Cancel
            </Button>
            <Button
              onClick={addComment}
              disabled={!newCommentText.trim()}
              className="flex-1 h-12 bg-sky-500 hover:bg-sky-600 text-white"
              data-testid="button-add-comment-confirm"
            >
              Add Comment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Comment Dialog */}
      <Dialog open={editingCommentIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingCommentIndex(null);
          setEditCommentText("");
        }
      }}>
        <DialogContent className="bg-[#2a2a2a] border-[#444] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Comment</DialogTitle>
            <DialogDescription className="text-gray-400">
              Modify the comment text
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">Comment Text</Label>
              <Input 
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                placeholder="Enter your comment..."
                className="h-12 bg-[#3a3a3a] border-[#555] text-white mt-1"
                data-testid="input-edit-comment-text"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editCommentText.trim()) {
                    updateComment();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-[#444]">
            <Button
              variant="outline"
              onClick={() => {
                if (editingCommentIndex !== null) {
                  deleteComment(editingCommentIndex);
                }
                setEditingCommentIndex(null);
                setEditCommentText("");
              }}
              className="flex-1 h-12 bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
              data-testid="button-delete-comment"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              onClick={updateComment}
              disabled={!editCommentText.trim()}
              className="flex-1 h-12 bg-sky-500 hover:bg-sky-600 text-white"
              data-testid="button-save-comment"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showCuttingList} onOpenChange={setShowCuttingList}>
        <SheetContent side="bottom" className="bg-[#2a2a2a] border-[#444] text-white h-[70vh]">
          <SheetHeader>
            <SheetTitle className="text-white">Cutting List ({profiles.length} profiles)</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-auto max-h-[calc(70vh-120px)]">
            {profiles.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No profiles added yet.
                <br />Draw a profile and tap "Done" to add it.
              </div>
            ) : (
              profiles.map((profile, index) => {
                let profileGirth = 0;
                for (let i = 1; i < profile.points.length; i++) {
                  const dx = profile.points[i].x - profile.points[i-1].x;
                  const dy = profile.points[i].y - profile.points[i-1].y;
                  profileGirth += Math.sqrt(dx*dx + dy*dy);
                }
                
                const pts = profile.points;
                const minX = Math.min(...pts.map(p => p.x));
                const maxX = Math.max(...pts.map(p => p.x));
                const minY = Math.min(...pts.map(p => p.y));
                const maxY = Math.max(...pts.map(p => p.y));
                const width = maxX - minX || 1;
                const height = maxY - minY || 1;
                const scale = Math.min(36 / width, 36 / height);
                const offsetX = (40 - width * scale) / 2 - minX * scale;
                const offsetY = (40 - height * scale) / 2 - minY * scale;
                const pathData = pts.length > 0 
                  ? `M ${pts.map(p => `${p.x * scale + offsetX},${p.y * scale + offsetY}`).join(' L ')}`
                  : '';
                const materialColor = COLORBOND_COLORS.find(c => c.name === profile.material)?.hex || '#fff';
                
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-4 bg-[#3a3a3a] rounded-lg cursor-pointer hover:bg-[#4a4a4a] transition-colors"
                    onClick={() => handleEditProfile(index)}
                    data-testid={`profile-item-${index}`}
                  >
                    <div className="w-10 h-10 rounded-lg border-2 border-white/20 bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <path 
                          d={pathData}
                          fill="none"
                          stroke={materialColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-mono font-bold flex items-center gap-2">
                        {profile.code}
                        {profile.colorSide && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 font-normal">
                            <ArrowUp className={`h-3 w-3 text-red-500 ${
                              profile.colorSide === 'right' ? 'rotate-90' :
                              profile.colorSide === 'left' ? '-rotate-90' : ''
                            }`} />
                            color
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {Math.round(profileGirth)}mm × {profile.lengthMm}mm • {profile.material} {profile.thickness}
                        {(profile.startFold || profile.endFold) && (
                          <span className="block text-xs mt-0.5">
                            Ends: {profile.startFold ? `${END_FOLD_OPTIONS.find(o => o.value === profile.startFold?.type)?.label || ''} ${profile.startFold?.length || 10}` : 'None'} / {profile.endFold ? `${END_FOLD_OPTIONS.find(o => o.value === profile.endFold?.type)?.label || ''} ${profile.endFold?.length || 10}` : 'None'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-bold">
                      ×{profile.quantity}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleEditProfile(index); }}
                      className="h-10 w-10 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                      data-testid={`button-edit-${index}`}
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); removeProfile(index); }}
                      className="h-10 w-10 text-red-500 hover:text-red-400 hover:bg-red-500/20"
                      data-testid={`button-remove-${index}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          
          {profiles.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#2a2a2a] border-t border-[#444]">
              <div className="flex justify-between mb-3 text-sm">
                <span className="text-gray-400">Total Items:</span>
                <span className="font-bold">{totalItems}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  className="flex-1 h-12 bg-red-500 hover:bg-red-600 gap-2" 
                  data-testid="button-generate-pdf"
                  onClick={generatePdf}
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  PDF
                </Button>
                <Button 
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 gap-2" 
                  data-testid="button-create-po"
                  onClick={createPO}
                  disabled={isCreatingPO}
                >
                  {isCreatingPO ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Briefcase className="h-5 w-5" />
                  )}
                  Create PO
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
