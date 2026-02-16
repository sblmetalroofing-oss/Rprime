import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  MapPin, 
  Calendar, 
  ChevronRight,
  Trash2,
  Copy,
  X,
  FileText,
  Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, Link } from "wouter";
import * as api from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateShort, getTodayInput } from "@/lib/date-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";

export default function Reports() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { canDelete } = usePermissions();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: api.fetchReports
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    }
  });

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = searchQuery === "" || 
        (report.customerName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (report.address?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (report.suburb?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (report.id?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter !== "all" && report.date) {
        const reportDate = new Date(report.date);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dateFilter === "today") matchesDate = daysDiff === 0;
        else if (dateFilter === "week") matchesDate = daysDiff <= 7;
        else if (dateFilter === "month") matchesDate = daysDiff <= 30;
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reports, searchQuery, statusFilter, dateFilter]);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      drafts: reports.filter(r => r.status === 'draft').length,
      submitted: reports.filter(r => r.status === 'submitted').length,
      completed: reports.filter(r => r.status === 'completed').length
    };
  }, [reports]);

  const deleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this report?")) {
      deleteMutation.mutate(id);
    }
  };

  const duplicateReport = async (report: api.Report, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `RPT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const duplicated = {
      ...report,
      id: newId,
      status: 'draft' as const,
      date: getTodayInput(),
      customerName: `${report.customerName || 'New'} (Copy)`
    };
    
    const created = await api.createReport(duplicated);
    if (created) {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setLocation(`/report/${created.id}`);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || dateFilter !== "all";

  return (
    <Layout>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">
            Inspection Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLoading ? 'Loading...' : `${stats.total} reports total - ${stats.drafts} drafts, ${stats.submitted} submitted, ${stats.completed} completed`}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow active:scale-95" 
          onClick={() => setStatusFilter("all")}
          role="button"
          aria-label="Show all reports"
        >
          <CardContent className="p-3 sm:p-4 text-center">
            {isLoading ? (
              <Skeleton className="h-6 sm:h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold" data-testid="stat-total-reports">{stats.total}</p>
            )}
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow active:scale-95 ${statusFilter === 'draft' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
          role="button"
          aria-label="Filter by draft reports"
          aria-pressed={statusFilter === 'draft'}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            {isLoading ? (
              <Skeleton className="h-6 sm:h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-amber-600" data-testid="stat-draft-reports">{stats.drafts}</p>
            )}
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow active:scale-95 ${statusFilter === 'submitted' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setStatusFilter(statusFilter === 'submitted' ? 'all' : 'submitted')}
          role="button"
          aria-label="Filter by submitted reports"
          aria-pressed={statusFilter === 'submitted'}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            {isLoading ? (
              <Skeleton className="h-6 sm:h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-blue-600" data-testid="stat-submitted-reports">{stats.submitted}</p>
            )}
            <p className="text-xs text-muted-foreground">Submitted</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow active:scale-95 ${statusFilter === 'completed' ? 'ring-2 ring-primary' : ''}`} 
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          role="button"
          aria-label="Filter by completed reports"
          aria-pressed={statusFilter === 'completed'}
        >
          <CardContent className="p-3 sm:p-4 text-center">
            {isLoading ? (
              <Skeleton className="h-6 sm:h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-green-600" data-testid="stat-completed-reports">{stats.completed}</p>
            )}
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input 
            placeholder="Search reports..." 
            className="pl-10 bg-card h-11 sm:h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-reports"
            aria-label="Search reports"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] bg-card h-11 sm:h-10" data-testid="select-status-filter" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[140px] bg-card h-11 sm:h-10" data-testid="select-date-filter" aria-label="Filter by date">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters} 
            className="text-muted-foreground" 
            data-testid="button-clear-filters"
            aria-label="Clear all filters"
          >
            <X className="h-4 w-4 mr-1" aria-hidden="true" /> Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && !isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredReports.length} of {reports.length} reports
        </p>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-11 w-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </Card>
            ))}
          </>
        ) : filteredReports.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters ? "No reports found matching your filters." : "No reports yet. Create reports from within a Job."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            ) : (
              <Link href="/jobs">
                <Button>
                  Go to Jobs
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card 
              key={report.id} 
              className="group cursor-pointer hover:shadow-md transition-all"
              onClick={() => setLocation(`/report/${report.id}`)}
              data-testid={`card-report-${report.id}`}
              role="button"
              aria-label={`Open report for ${report.customerName || 'New Client'}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{report.customerName || 'New Client'}</h3>
                        <Badge 
                          variant={report.status === 'completed' ? 'secondary' : report.status === 'submitted' ? 'default' : 'outline'} 
                          className="uppercase text-[10px]"
                        >
                          {report.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{report.address || 'No address'}{report.suburb ? `, ${report.suburb}` : ''}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                          {formatDateShort(report.date) || 'No date'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Estimate</p>
                      <p className="font-mono font-medium text-sm">
                        {report.totalEstimates > 0 
                          ? `$${report.totalEstimates.toLocaleString()}` 
                          : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary h-8 w-8"
                        onClick={(e) => duplicateReport(report, e)}
                        aria-label={`Duplicate report for ${report.customerName || 'New Client'}`}
                        data-testid={`button-duplicate-${report.id}`}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      {canDelete && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={(e) => deleteReport(report.id, e)}
                          aria-label={`Delete report for ${report.customerName || 'New Client'}`}
                          data-testid={`button-delete-${report.id}`}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </Layout>
  );
}
