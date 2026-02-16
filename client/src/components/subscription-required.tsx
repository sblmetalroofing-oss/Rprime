import { useLocation } from "wouter";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Sparkles, Check } from "lucide-react";

interface SubscriptionRequiredProps {
  children: React.ReactNode;
}

const PLANS = [
  {
    name: "Starter",
    price: 29,
    features: ["Up to 3 crew members", "Jobs & Scheduling", "Quotes & Invoices", "Customer Management", "Inspection Reports"],
  },
  {
    name: "Professional",
    price: 59,
    popular: true,
    features: ["Up to 10 crew members", "Everything in Starter", "Advanced Scheduling", "Purchase Orders", "Lead Pipeline", "Product Catalog"],
  },
  {
    name: "Business",
    price: 99,
    features: ["Unlimited crew", "Everything in Professional", "Team Chat", "Custom Branding", "API Access", "Priority Support"],
  },
];

export function SubscriptionRequired({ children }: SubscriptionRequiredProps) {
  const [, navigate] = useLocation();
  const { needsUpgrade, trial, subscriptionStatus, isLoading } = usePlanLimits();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!needsUpgrade) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="subscription-required-title">
            {trial.isExpired ? "Your Trial Has Expired" : "Subscription Required"}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {trial.isExpired 
              ? "Your 14-day free trial has ended. Choose a plan to continue using RPrime."
              : "Subscribe to a plan to access RPrime."}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => (
            <Card 
              key={plan.name} 
              className={plan.popular ? "border-primary shadow-lg scale-105" : ""}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center text-sm py-1 rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/billing")}
            data-testid="choose-plan-button"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Choose a Plan
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            All plans include a 14-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
