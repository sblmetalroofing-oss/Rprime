import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, LogOut, Mail } from "lucide-react";

export default function Unauthorized() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Not Authorized</CardTitle>
          <CardDescription className="text-base">
            Your account is not set up to access this application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="font-medium" data-testid="text-user-email">{user?.email || "Unknown"}</p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Please contact your administrator to get access. They need to add your email address to the crew members list in Settings.
          </p>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out & Try Another Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
