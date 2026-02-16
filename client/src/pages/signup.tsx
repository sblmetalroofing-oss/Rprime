import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, Mail, Phone, Lock, ArrowRight, Check } from "lucide-react";

export default function Signup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const signupMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/auth/signup-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create account");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.needsVerification) {
        toast({ title: "Check your email!", description: "We sent you a verification code." });
        navigate(`/auth?verify=${encodeURIComponent(data.email)}`);
      } else {
        toast({ title: "Account created! Logging you in..." });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    
    if (formData.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    
    signupMutation.mutate(formData);
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const features = [
    "Job management & scheduling",
    "Quotes & invoices",
    "Customer CRM",
    "Roof inspection reports",
    "Team collaboration",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding */}
        <div className="text-white space-y-6 p-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Start your free trial</h1>
            <p className="text-xl text-slate-300">
              14 days free. No credit card required.
            </p>
          </div>
          
          <div className="space-y-3 pt-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-slate-200">{feature}</span>
              </div>
            ))}
          </div>
          
          <div className="pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Trusted by trades businesses across Australia
            </p>
          </div>
        </div>

        {/* Right side - Form */}
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Get started with RPrime for your business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  data-testid="input-business-name"
                  placeholder="Your Company Pty Ltd"
                  value={formData.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerName" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Your Name
                </Label>
                <Input
                  id="ownerName"
                  data-testid="input-owner-name"
                  placeholder="John Smith"
                  value={formData.ownerName}
                  onChange={(e) => updateField("ownerName", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    data-testid="input-phone"
                    placeholder="0400 000 000"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="input-password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Confirm
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    data-testid="input-confirm-password"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
                data-testid="button-signup"
                disabled={signupMutation.isPending}
              >
                {signupMutation.isPending ? (
                  "Creating account..."
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Log in
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
