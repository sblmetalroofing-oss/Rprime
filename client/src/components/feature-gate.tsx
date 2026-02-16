import { useState } from "react";
import { useLocation } from "wouter";
import { usePlanLimits, PlanLimits } from "@/hooks/use-plan-limits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Lock, Sparkles } from "lucide-react";

interface FeatureGateProps {
  feature: keyof PlanLimits["features"];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const FEATURE_NAMES: Record<string, string> = {
  scheduling: "Schedule & Calendar",
  purchaseOrders: "Purchase Orders",
  leads: "Lead Pipeline",
  products: "Product Catalog",
  chat: "Team Chat",
  branding: "Custom Branding",
  api: "API Access",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  scheduling: "Visual calendar for scheduling jobs and managing your team's workload.",
  purchaseOrders: "Create and track purchase orders for materials and supplies.",
  leads: "Track potential customers through your sales funnel with kanban boards.",
  products: "Manage your product catalog with pricing and margins.",
  chat: "Real-time team communication for better coordination.",
  branding: "Custom logo and branding on quotes, invoices, and reports.",
  api: "Access RPrime data via API for integrations.",
};

const FEATURE_MIN_PLAN: Record<string, { plan: string; label: string }> = {
  scheduling: { plan: "professional", label: "Professional" },
  purchaseOrders: { plan: "professional", label: "Professional" },
  leads: { plan: "professional", label: "Professional" },
  products: { plan: "professional", label: "Professional" },
  chat: { plan: "business", label: "Business" },
  branding: { plan: "business", label: "Business" },
  api: { plan: "business", label: "Business" },
};

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const [, navigate] = useLocation();
  const { features, plan, isLoading } = usePlanLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const hasAccess = features[feature];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const featureName = FEATURE_NAMES[feature] || feature;
  const featureDesc = FEATURE_DESCRIPTIONS[feature] || "";
  const minPlan = FEATURE_MIN_PLAN[feature] || { plan: "professional", label: "Professional" };

  return (
    <>
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto p-3 bg-amber-100 rounded-full w-fit mb-4">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle>{featureName}</CardTitle>
            <CardDescription>{featureDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              This feature is available on the {minPlan.label} plan{minPlan.plan !== "business" ? " and above" : ""}.
              Upgrade your subscription to unlock this feature.
            </p>
            <Button onClick={() => setShowUpgrade(true)} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to {minPlan.label}
            </Button>
          </CardContent>
        </Card>
      </div>
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="feature_locked"
        feature={feature}
        currentPlan={plan || "starter"}
      />
    </>
  );
}

export function useFeatureGate(feature: keyof PlanLimits["features"]) {
  const { features, isLoading } = usePlanLimits();
  return {
    hasAccess: features[feature],
    isLoading,
  };
}
