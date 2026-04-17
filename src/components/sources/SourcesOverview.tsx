import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Globe, FileText, Link2, RefreshCw, Trash2, 
  CheckCircle2, XCircle, Clock, Loader2, AlertCircle 
} from "lucide-react";
import { useSources, KnowledgeSource } from "@/hooks/useSources";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const sourceTypeIcons = {
  web_crawler: Globe,
  file: FileText,
  integration: Link2,
};

const statusConfig = {
  idle: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  pending: { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
};

export function SourcesOverview() {
  const { sources, auditLogs, loading, toggleSource, deleteSource, triggerReindex, fetchAuditLogs } = useSources();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteSource(pendingDeleteId);
    }
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  };

  const stats = {
    total: sources.length,
    enabled: sources.filter(s => s.is_enabled).length,
    running: sources.filter(s => s.status === 'running').length,
    failed: sources.filter(s => s.status === 'failed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* All Sources List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>All Sources</CardTitle>
            <CardDescription>Manage your knowledge sources</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Globe className="h-8 w-8 mb-2" />
                  <p>No sources configured yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => {
                    const Icon = sourceTypeIcons[source.source_type];
                    const StatusIcon = statusConfig[source.status].icon;
                    const isRunning = source.status === 'running';
                    
                    return (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${statusConfig[source.status].bg}`}>
                            <Icon className={`h-4 w-4 ${statusConfig[source.status].color}`} />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {source.name}
                              <Badge variant="outline" className="text-xs">
                                {source.source_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <StatusIcon className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} />
                              {source.status}
                              {source.last_indexed_at && (
                                <span className="ml-2">
                                  • Last indexed: {format(new Date(source.last_indexed_at), 'MMM d, HH:mm')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={source.is_enabled}
                            onCheckedChange={(checked) => toggleSource(source.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => triggerReindex(source.id)}
                            disabled={isRunning}
                          >
                            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(source.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>Recent source activity</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="p-2 rounded-md bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </div>
                        {Object.keys(log.details).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this source? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
