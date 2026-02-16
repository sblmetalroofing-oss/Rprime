import { Link } from "wouter";
import { MobileLayout } from "@/components/mobile-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  Settings, 
  FileText, 
  Truck, 
  ShoppingCart,
  LayoutDashboard,
  TrendingUp,
  Users,
  PenTool,
  LogOut,
  Package,
  Bug,
  CreditCard,
  HardHat
} from "lucide-react";

interface MenuItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function MenuItem({ href, icon, label }: MenuItemProps) {
  return (
    <Link href={href}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
          <div className="text-primary">{icon}</div>
          <span className="text-sm font-medium text-center">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MobileMore() {
  const { logout, isLoggingOut } = useAuth();
  const { features } = usePlanLimits();
  const { isSuperAdmin, canViewFinancials, canAccessSettings } = usePermissions();

  return (
    <MobileLayout title="More">
      <div className="p-4 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Your Account</h2>
          <div className="grid grid-cols-2 gap-3">
            {canAccessSettings && (
              <MenuItem 
                href="/settings" 
                icon={<Settings className="h-6 w-6" />} 
                label="Settings" 
              />
            )}
            {canAccessSettings && (
              <MenuItem 
                href="/billing" 
                icon={<CreditCard className="h-6 w-6" />} 
                label="Billing" 
              />
            )}
            <Card 
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="text-red-500">
                  <LogOut className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-center text-red-500">
                  {isLoggingOut ? "Logging out..." : "Log Out"}
                </span>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Shortcuts</h2>
          <div className="grid grid-cols-2 gap-3">
            <MenuItem 
              href="/" 
              icon={<LayoutDashboard className="h-6 w-6" />} 
              label="Dashboard" 
            />
            <MenuItem 
              href="/crew-dashboard" 
              icon={<HardHat className="h-6 w-6" />} 
              label="My Work" 
            />
            <MenuItem 
              href="/reports" 
              icon={<FileText className="h-6 w-6" />} 
              label="Reports" 
            />
            {canViewFinancials && (
              <MenuItem 
                href="/purchase-orders" 
                icon={<ShoppingCart className="h-6 w-6" />} 
                label="Purchase Orders" 
              />
            )}
            <MenuItem 
              href="/suppliers" 
              icon={<Truck className="h-6 w-6" />} 
              label="Suppliers" 
            />
            <MenuItem 
              href="/customers" 
              icon={<Users className="h-6 w-6" />} 
              label="Customers" 
            />
            {features.leads && (
              <MenuItem 
                href="/leads" 
                icon={<TrendingUp className="h-6 w-6" />} 
                label="Leads" 
              />
            )}
            {canViewFinancials && (
              <MenuItem 
                href="/rflash" 
                icon={<PenTool className="h-6 w-6" />} 
                label="RFlash" 
              />
            )}
            {features.products && (
              <MenuItem 
                href="/products" 
                icon={<Package className="h-6 w-6" />} 
                label="Products" 
              />
            )}
            {isSuperAdmin && (
              <MenuItem 
                href="/feedback" 
                icon={<Bug className="h-6 w-6" />} 
                label="Feedback" 
              />
            )}
          </div>
        </section>
      </div>
    </MobileLayout>
  );
}
