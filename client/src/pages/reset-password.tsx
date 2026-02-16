import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import logoUrl from "@assets/sbl-logo.png";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({ title: "Invalid link", description: "This password reset link is invalid.", variant: "destructive" });
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }
    
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
        return;
      }
      
      setIsSuccess(true);
      toast({ title: "Password reset!", description: "You can now sign in with your new password." });
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        <Card className="w-full max-w-md shadow-2xl border-primary/5 animate-in zoom-in duration-500">
          <CardHeader className="space-y-4 text-center pb-8">
            <div className="flex justify-center mb-2">
              <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-heading text-primary">Password Reset!</CardTitle>
              <CardDescription>Your password has been successfully reset.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/auth')} 
              className="w-full font-medium h-12" 
              size="lg"
              data-testid="button-go-to-login"
            >
              Go to Sign In
            </Button>
          </CardContent>
          <CardFooter className="text-center text-sm text-muted-foreground justify-center pt-6">
            &copy; 2025 SBL Roofing Pty Ltd
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <Card className="w-full max-w-md shadow-2xl border-primary/5 animate-in zoom-in duration-500">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex justify-center mb-2">
            <div className="h-20 w-20 bg-primary/5 rounded-3xl flex items-center justify-center p-4">
              <img src={logoUrl} alt="SBL Logo" className="object-contain w-full h-full" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-heading text-primary">Set New Password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                  data-testid="input-confirm-new-password"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full font-medium h-12" 
              size="lg"
              disabled={isSubmitting || !token}
              data-testid="button-reset-password"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reset Password
            </Button>
          </CardContent>
        </form>
        
        <CardFooter className="text-center text-sm text-muted-foreground justify-center pt-6">
          &copy; 2025 SBL Roofing Pty Ltd
        </CardFooter>
      </Card>
    </div>
  );
}
