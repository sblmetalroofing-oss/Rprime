import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Calendar, Package, MessageSquare, Palette, Code } from "lucide-react";

interface UpgradePromptProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  reason?: "crew_limit" | "feature_locked";
  feature?: string;
  currentPlan?: string;
  currentCount?: number;
  limit?: number;
}

const FEATURE_ICONS: Record<string, any> = {
  scheduling: Calendar,
  purchaseOrders: Package,
  leads: Users,
  products: Package,
  chat: MessageSquare,
  branding: Palette,
  api: Code,
};

const FEATURE_LABELS: Record<string, string> = {
  scheduling: "Schedule & Calendar",
  purchaseOrders: "Purchase Orders",
  leads: "Lead Pipeline",
  products: "Product Catalog",
  chat: "Team Chat",
  branding: "Custom Branding",
  api: "API Access",
};

const PLAN_UPGRADES: Record<string, { name: string; price: number; features: string[] }> = {
  starter: {
    name: "Professional",
    price: 59,
    features: ["Up to 10 crew members", "Schedule & Calendar", "Purchase Orders", "Lead Pipeline", "Product Catalog"],
  },
  professional: {
    name: "Business",
    price: 99,
    features: ["Unlimited crew members", "Team Chat", "Custom Branding", "API Access", "Priority Support"],
  },
};

export function UpgradePrompt({ open, onClose, onOpenChange, reason, feature, currentPlan = "starter" }: UpgradePromptProps) {
  const [, navigate] = useLocation();
  const upgrade = PLAN_UPGRADES[currentPlan] || PLAN_UPGRADES.starter;
  const FeatureIcon = feature ? FEATURE_ICONS[feature] || Sparkles : Sparkles;
  const featureLabel = feature ? FEATURE_LABELS[feature] || feature : "";

  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    } else if (onClose) {
      onClose();
    }
  };

  const handleUpgrade = () => {
    handleClose();
    navigate("/billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange || onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              {reason === "crew_limit" ? (
                <Users className="h-5 w-5 text-amber-600" />
              ) : (
                <FeatureIcon className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Upgrade Required
            </Badge>
          </div>
          <DialogTitle>
            {reason === "crew_limit" 
              ? "Crew Member Limit Reached" 
              : `Unlock ${featureLabel}`}
          </DialogTitle>
          <DialogDescription>
            {reason === "crew_limit" 
              ? "You've reached the maximum number of crew members for your current plan. Upgrade to add more team members."
              : `${featureLabel} is available on the ${upgrade.name} plan and above.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-lg">{upgrade.name} Plan</span>
            <span className="text-2xl font-bold">${upgrade.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
          </div>
          <ul className="space-y-2">
            {upgrade.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="flex-1">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
