import { useLocation } from "wouter";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { X, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";

export function TrialBanner() {
  const [, navigate] = useLocation();
  const { trial, subscriptionStatus, isLoading, needsUpgrade } = usePlanLimits();
  const { canManageBilling } = usePermissions();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;
  if (subscriptionStatus === "active") return null;
  if (!trial.isTrialing && !needsUpgrade) return null;

  const isUrgent = trial.daysLeft <= 3;
  const isExpired = trial.isExpired;

  if (isExpired) {
    return (
      <div className="bg-red-500 text-white px-4 py-3" data-testid="trial-expired-banner">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              {canManageBilling 
                ? "Your trial has expired. Subscribe now to continue using RPrime."
                : "Your trial has expired. Contact your organization admin to subscribe."}
            </span>
          </div>
          {canManageBilling && (
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => navigate("/billing")}
              data-testid="upgrade-button"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Subscribe Now
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isUrgent) {
    return (
      <div className="bg-amber-500 text-white px-4 py-3" data-testid="trial-urgent-banner">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              {trial.daysLeft === 0 
                ? (canManageBilling ? "Your full access trial ends today! Choose a plan to continue." : "Your full access trial ends today!")
                : trial.daysLeft === 1 
                  ? (canManageBilling ? "Only 1 day left of full access! Choose a plan to continue." : "Only 1 day left of full access!")
                  : (canManageBilling ? `Only ${trial.daysLeft} days left of full access! Choose a plan to continue.` : `Only ${trial.daysLeft} days left of full access!`)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canManageBilling && (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => navigate("/billing")}
                data-testid="upgrade-button"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Choose a Plan
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-white hover:bg-white/20"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-500 text-white px-4 py-2" data-testid="trial-info-banner">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">
            <strong>{trial.daysLeft} days</strong> left in your free trial - you have full access to all features
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canManageBilling && (
            <Button 
              size="sm" 
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => navigate("/billing")}
              data-testid="upgrade-button"
            >
              View Plans
            </Button>
          )}
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
