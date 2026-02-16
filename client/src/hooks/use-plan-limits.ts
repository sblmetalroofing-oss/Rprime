import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

export interface PlanLimits {
  plan: "starter" | "professional" | "business" | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | null;
  maxCrewMembers: number;
  currentCrewCount: number;
  canAddMoreCrew: boolean;
  crewSlotsRemaining: number;
  features: {
    jobs: boolean;
    quotes: boolean;
    invoices: boolean;
    customers: boolean;
    reports: boolean;
    scheduling: boolean;
    purchaseOrders: boolean;
    leads: boolean;
    products: boolean;
    chat: boolean;
    branding: boolean;
    api: boolean;
  };
  trial: {
    isTrialing: boolean;
    daysLeft: number;
    endsAt: Date | null;
    isExpired: boolean;
  };
  isSubscribed: boolean;
  needsUpgrade: boolean;
  isLoading: boolean;
}

const PLAN_LIMITS = {
  starter: {
    maxCrewMembers: 3,
    features: ["jobs", "quotes", "invoices", "customers", "reports"],
  },
  professional: {
    maxCrewMembers: 10,
    features: ["jobs", "quotes", "invoices", "customers", "reports", "scheduling", "purchaseOrders", "leads", "products"],
  },
  business: {
    maxCrewMembers: Infinity,
    features: ["jobs", "quotes", "invoices", "customers", "reports", "scheduling", "purchaseOrders", "leads", "products", "chat", "branding", "api"],
  },
};

export function usePlanLimits(): PlanLimits {
  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: crewData, isLoading: crewLoading } = useQuery({
    queryKey: ["/api/crew-members"],
    queryFn: async () => {
      const res = await fetch("/api/crew-members");
      if (!res.ok) return { crewMembers: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  // Get current user to check for super admin status
  const { data: user, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });

  const isLoading = subLoading || crewLoading || userLoading;
  const organization = subscriptionData?.organization;
  const subscription = subscriptionData?.subscription;
  
  // Super admins always get business tier features
  const isSuperAdmin = !!(user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin;
  
  // Valid subscription statuses
  const validStatuses = ["trialing", "active", "past_due", "canceled", "unpaid"];
  
  // Read status from: Stripe subscription > top-level API response > organization field
  // Only accept valid subscription statuses (ignore "no_organization" etc.)
  const rawStatus = subscription?.status || subscriptionData?.status || organization?.subscriptionStatus;
  const subscriptionStatus = validStatuses.includes(rawStatus) ? rawStatus : null;
  
  // Determine effective plan: superAdmin > planOverride > billingOverride='free' > subscriptionPlan
  const getEffectivePlan = (): "starter" | "professional" | "business" => {
    if (isSuperAdmin) {
      return "business";
    }
    if (organization?.planOverride) {
      return organization.planOverride as "starter" | "professional" | "business";
    }
    if (organization?.billingOverride === 'free') {
      return "business";
    }
    return (organization?.subscriptionPlan || "starter") as "starter" | "professional" | "business";
  };
  
  const plan = getEffectivePlan();
  const hasOverride = isSuperAdmin || !!(organization?.planOverride || organization?.billingOverride === 'free');
  const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  
  const trialEndsAt = organization?.trialEndsAt ? new Date(organization.trialEndsAt) : null;
  const now = new Date();
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const isExpired = trialEndsAt ? trialEndsAt < now : false;
  
  // Determine trial status: either from subscriptionStatus OR from trialEndsAt date
  // This handles the case where crew members get "no_organization" status initially
  // but the organization data (with trialEndsAt) is still available
  const isTrialing = subscriptionStatus === "trialing" || (trialEndsAt !== null && !isExpired);
  const isActiveTrialing = trialEndsAt !== null && !isExpired;
  // Super admin or override takes priority, then active trial gives business tier, then use base plan
  const effectivePlanConfig = hasOverride 
    ? planConfig  // planConfig already reflects the override (business for super admin)
    : (isActiveTrialing ? PLAN_LIMITS.business : planConfig);
  
  const currentCrewCount = crewData?.crewMembers?.filter((c: { isActive?: string }) => c.isActive !== 'false')?.length || 0;
  const maxCrewMembers = effectivePlanConfig.maxCrewMembers;
  const canAddMoreCrew = currentCrewCount < maxCrewMembers;
  const crewSlotsRemaining = Math.max(0, maxCrewMembers - currentCrewCount);

  const allFeatures = ["jobs", "quotes", "invoices", "customers", "reports", "scheduling", "purchaseOrders", "leads", "products", "chat", "branding", "api"];
  const features = allFeatures.reduce((acc, feature) => {
    acc[feature as keyof PlanLimits["features"]] = effectivePlanConfig.features.includes(feature);
    return acc;
  }, {} as PlanLimits["features"]);

  // isSubscribed: active subscription, active trial, or has override
  const isSubscribed = subscriptionStatus === "active" || isActiveTrialing || hasOverride;
  // Users with override or active trial don't need to upgrade
  // needsUpgrade: expired trial, canceled, or unpaid (but not if override)
  const needsUpgrade = !hasOverride && !isActiveTrialing && (isExpired || subscriptionStatus === "canceled" || subscriptionStatus === "unpaid");

  return {
    plan,
    subscriptionStatus,
    maxCrewMembers: maxCrewMembers === Infinity ? 999 : maxCrewMembers,
    currentCrewCount,
    canAddMoreCrew,
    crewSlotsRemaining,
    features,
    trial: {
      isTrialing,
      daysLeft,
      endsAt: trialEndsAt,
      isExpired,
    },
    isSubscribed,
    needsUpgrade,
    isLoading,
  };
}

export function useFeatureAccess(feature: keyof PlanLimits["features"]): { hasAccess: boolean; isLoading: boolean } {
  const limits = usePlanLimits();
  return {
    hasAccess: limits.features[feature],
    isLoading: limits.isLoading,
  };
}
