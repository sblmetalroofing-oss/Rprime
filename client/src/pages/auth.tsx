import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { LogIn, Loader2, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import rprimeLogoUrl from "@assets/rprime-header-logo.png";
import archBgUrl from "@assets/stock_images/modern_architecture__3371bede.jpg";
import { useToast } from "@/hooks/use-toast";

type AuthView = 'main' | 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [view, setView] = useState<AuthView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  useEffect(() => {
    const savedCredentials = localStorage.getItem('rprime_remember');
    if (savedCredentials) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials);
        setEmail(savedEmail || '');
        setPassword(savedPassword || '');
        setRememberMe(true);
      } catch (e) {
        localStorage.removeItem('rprime_remember');
      }
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error');
    const verifyEmail = urlParams.get('verify');
    const inviteParam = urlParams.get('invite');
    const emailParam = urlParams.get('email');
    
    if (errorMessage) {
      toast({ 
        title: "Login Error", 
        description: decodeURIComponent(errorMessage), 
        variant: "destructive" 
      });
      window.history.replaceState({}, '', '/auth');
    }
    
    if (verifyEmail) {
      setPendingEmail(decodeURIComponent(verifyEmail));
      setView('verify');
      window.history.replaceState({}, '', '/auth');
    }
    
    if (inviteParam) {
      setInviteToken(inviteParam);
      if (emailParam) {
        setEmail(decodeURIComponent(emailParam));
      }
      setView('signup');
      fetch(`/api/crew-members/invite/${inviteParam}`)
        .then(res => res.json())
        .then(data => {
          if (data.organizationName) {
            setInviteOrgName(data.organizationName);
          }
        })
        .catch(() => {});
    }
  }, [toast]);

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.needsVerification) {
          setPendingEmail(data.email);
          setView('verify');
          toast({ title: "Verification required", description: "Please verify your email to continue." });
        } else {
          toast({ title: "Login failed", description: data.error, variant: "destructive" });
        }
        return;
      }
      
      if (rememberMe) {
        localStorage.setItem('rprime_remember', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('rprime_remember');
      }
      
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      window.location.href = "/";
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ title: "Signup failed", description: data.error, variant: "destructive" });
        return;
      }
      
      setPendingEmail(data.email);
      setView('verify');
      toast({ title: "Check your email", description: "We sent you a 6-digit verification code." });
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: verificationCode }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ title: "Verification failed", description: data.error, variant: "destructive" });
        return;
      }
      
      toast({ title: "Email verified!", description: "You can now sign in with your account." });
      setView('login');
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return;
      }
      
      toast({ title: "Code sent", description: "Check your email for the new verification code." });
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      await res.json();
      
      toast({ title: "Check your email", description: "If an account exists, you'll receive a password reset link." });
      setView('login');
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderMainView = () => (
    <>
      <CardContent className="space-y-4">
        <Button 
          onClick={() => setView('login')} 
          className="w-full font-medium h-12 bg-white text-slate-900 hover:bg-slate-100" 
          size="lg"
          data-testid="button-email-login"
        >
          <Mail className="mr-2 h-5 w-5" />
          Sign In with Email
        </Button>
        
        <Button 
          onClick={() => setView('signup')} 
          variant="outline"
          className="w-full font-medium h-12 border-slate-600 text-white hover:bg-slate-800 hover:text-white" 
          size="lg"
          data-testid="button-email-signup"
        >
          <User className="mr-2 h-5 w-5" />
          Create Account
        </Button>
        
        <div className="relative">
          <Separator className="my-4 bg-slate-700" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-xs text-slate-500">
            OR
          </span>
        </div>
        
        <Button 
          onClick={handleGoogleLogin} 
          variant="secondary"
          className="w-full font-medium h-12 bg-slate-800 text-white hover:bg-slate-700" 
          size="lg"
          data-testid="button-login-google"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign In with Google
        </Button>
      </CardContent>
    </>
  );

  const renderLoginView = () => (
    <form onSubmit={handleLocalLogin}>
      <CardContent className="space-y-4">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setView('main')}
          className="mb-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-email"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember" 
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="border-slate-600 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              data-testid="checkbox-remember"
            />
            <Label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer">
              Remember me
            </Label>
          </div>
          <Button 
            type="button"
            variant="link" 
            className="text-sm text-slate-400 hover:text-white p-0 h-auto"
            onClick={() => setView('forgot')}
            data-testid="link-forgot-password"
          >
            Forgot password?
          </Button>
        </div>
        
        <Button 
          type="submit" 
          className="w-full font-medium h-12 bg-white text-slate-900 hover:bg-slate-100" 
          size="lg"
          disabled={isSubmitting}
          data-testid="button-submit-login"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sign In
        </Button>
        
        <div className="pt-4 text-center">
          <Separator className="my-4 bg-slate-700" />
          <p className="text-sm text-slate-400 mb-3">New to RPrime?</p>
          <Button 
            type="button"
            variant="outline"
            className="w-full font-medium h-12 border-slate-600 text-white hover:bg-slate-800 hover:text-white"
            onClick={() => setLocation('/signup')}
            data-testid="link-signup-org"
          >
            Create a Business Account
          </Button>
        </div>
      </CardContent>
    </form>
  );

  const renderSignupView = () => (
    <form onSubmit={handleSignup}>
      <CardContent className="space-y-4">
        {!inviteToken && (
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            onClick={() => setView('main')}
            className="mb-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        )}
        
        {inviteOrgName && (
          <div className="text-center mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400">You've been invited to join</p>
            <p className="font-semibold text-white text-lg">{inviteOrgName}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
            <Input
              id="firstName"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-firstname"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Smith"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-lastname"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signupEmail" className="text-slate-300">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="signupEmail"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 ${inviteToken ? 'opacity-75 cursor-not-allowed' : ''}`}
              required
              readOnly={!!inviteToken}
              data-testid="input-signup-email"
            />
          </div>
          {inviteToken && (
            <p className="text-xs text-slate-500">This email is linked to your invitation</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signupPassword" className="text-slate-300">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="signupPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              minLength={8}
              data-testid="input-signup-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-confirm-password"
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full font-medium h-12 bg-white text-slate-900 hover:bg-slate-100" 
          size="lg"
          disabled={isSubmitting}
          data-testid="button-submit-signup"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {inviteToken ? 'Join Team' : 'Create Account'}
        </Button>
      </CardContent>
    </form>
  );

  const renderVerifyView = () => (
    <form onSubmit={handleVerify}>
      <CardContent className="space-y-4">
        <div className="text-center mb-4">
          <p className="text-sm text-slate-400">
            We sent a 6-digit code to
          </p>
          <p className="font-medium text-white">{pendingEmail}</p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="code" className="text-slate-300">Verification Code</Label>
          <Input
            id="code"
            type="text"
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-14 text-center text-2xl tracking-widest bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            maxLength={6}
            required
            data-testid="input-verification-code"
          />
          <p className="text-xs text-slate-500 text-center">
            Code expires in 15 minutes
          </p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full font-medium h-12 bg-white text-slate-900 hover:bg-slate-100" 
          size="lg"
          disabled={isSubmitting || verificationCode.length !== 6}
          data-testid="button-verify"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verify Email
        </Button>
        
        <div className="text-center">
          <Button 
            type="button"
            variant="link" 
            className="text-sm text-slate-400 hover:text-white"
            onClick={handleResendCode}
            disabled={isSubmitting}
            data-testid="button-resend-code"
          >
            Didn't receive the code? Resend
          </Button>
        </div>
      </CardContent>
    </form>
  );

  const renderForgotView = () => (
    <form onSubmit={handleForgotPassword}>
      <CardContent className="space-y-4">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => setView('login')}
          className="mb-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        
        <div className="text-center mb-4">
          <p className="text-sm text-slate-400">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="forgotEmail" className="text-slate-300">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="forgotEmail"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              data-testid="input-forgot-email"
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full font-medium h-12 bg-white text-slate-900 hover:bg-slate-100" 
          size="lg"
          disabled={isSubmitting}
          data-testid="button-send-reset"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send Reset Link
        </Button>
      </CardContent>
    </form>
  );

  const getTitle = () => {
    switch (view) {
      case 'login': return 'Welcome Back';
      case 'signup': return inviteToken ? 'Join Your Team' : 'Create Account';
      case 'verify': return 'Verify Email';
      case 'forgot': return 'Reset Password';
      default: return 'RPrime Portal';
    }
  };

  const getDescription = () => {
    switch (view) {
      case 'login': return 'Sign in to your account';
      case 'signup': return 'Create your account';
      case 'verify': return 'Enter the code we sent you';
      case 'forgot': return 'We\'ll help you recover access';
      default: return 'Your job management portal.';
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${archBgUrl})` }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <Card className="w-full max-w-md shadow-2xl border-slate-700/50 animate-in zoom-in duration-500 relative z-10 bg-slate-900 text-white">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="h-40 w-40 rounded-3xl flex items-center justify-center">
              <img src={rprimeLogoUrl} alt="RPrime" className="object-contain w-full h-full" />
            </div>
          </div>
          <div className="space-y-2">
            {view !== 'main' && (
              <CardTitle className="text-2xl font-heading text-white">
                {getTitle()}
              </CardTitle>
            )}
            <CardDescription className="text-slate-400">{getDescription()}</CardDescription>
          </div>
        </CardHeader>
        
        {view === 'main' && renderMainView()}
        {view === 'login' && renderLoginView()}
        {view === 'signup' && renderSignupView()}
        {view === 'verify' && renderVerifyView()}
        {view === 'forgot' && renderForgotView()}
        
        <CardFooter className="text-center text-sm text-slate-500 justify-center pt-6">
          &copy; 2026 RPrime
        </CardFooter>
      </Card>
    </div>
  );
}
