import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { MobileLayout } from "@/components/mobile-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Plus, FileText, ChevronRight, Star } from "lucide-react";
import type { DocumentTheme } from "@shared/schema";

export default function DocumentThemes() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/document-themes");
      if (response.ok) {
        const data = await response.json();
        setThemes(data);
      }
    } catch (error) {
      console.error("Error loading themes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load document themes"
      });
    } finally {
      setLoading(false);
    }
  };

  const currentThemes = themes.filter(t => t.isArchived !== 'true');
  const archivedThemes = themes.filter(t => t.isArchived === 'true');

  const content = (
    <div className="space-y-4">
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/settings" data-testid="breadcrumb-settings">Settings</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">Document Themes</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/settings")}
            className="h-11 w-11"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Document Themes</h1>
        </div>
        <Button 
          onClick={() => setLocation("/theme-editor/new")}
          className="h-11"
          data-testid="button-add-theme"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "archived")}>
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="current" className="h-9" data-testid="tab-current">Current</TabsTrigger>
          <TabsTrigger value="archived" className="h-9" data-testid="tab-archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading themes...
              </CardContent>
            </Card>
          ) : currentThemes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No document themes yet</p>
                <Button onClick={() => setLocation("/theme-editor/new")}>
                  Create First Theme
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y">
              {currentThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setLocation(`/theme-editor/${theme.id}`)}
                  data-testid={`theme-row-${theme.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: theme.themeColor || '#0891b2' }}
                    />
                    <span className="font-medium">{theme.name}</span>
                    {theme.isDefault === 'true' && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {archivedThemes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No archived themes
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y">
              {archivedThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 opacity-60"
                  onClick={() => setLocation(`/theme-editor/${theme.id}`)}
                  data-testid={`theme-row-archived-${theme.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: theme.themeColor || '#0891b2' }}
                    />
                    <span className="font-medium">{theme.name}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-blue-600">ℹ️</span> The default document theme can't be archived. 
            To archive this document theme you must first make another document theme the default.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <MobileLayout title="Document Themes" backHref="/settings">
        <div className="p-4">
          {content}
        </div>
      </MobileLayout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-6 px-4">
        {content}
      </div>
    </Layout>
  );
}
