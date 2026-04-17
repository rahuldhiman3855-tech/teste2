import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Link2, Plus, RefreshCw, Trash2, 
  CheckCircle2, XCircle, Clock, Loader2, Eye, EyeOff,
  Zap, Users, Ticket, FileBox
} from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { format } from "date-fns";

const statusConfig = {
  idle: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Idle" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", label: "Syncing" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Synced" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Pending" },
};

const integrationTypes = [
  { 
    id: 'salesforce', 
    name: 'Salesforce', 
    icon: Users, 
    color: 'bg-blue-500',
    objects: ['Account', 'Contact', 'Lead', 'Opportunity', 'Case']
  },
  { 
    id: 'hubspot', 
    name: 'HubSpot', 
    icon: Zap, 
    color: 'bg-orange-500',
    objects: ['Contacts', 'Companies', 'Deals', 'Tickets']
  },
  { 
    id: 'zendesk', 
    name: 'Zendesk', 
    icon: Ticket, 
    color: 'bg-green-500',
    objects: ['Tickets', 'Users', 'Organizations', 'Articles']
  },
  { 
    id: 'notion', 
    name: 'Notion', 
    icon: FileBox, 
    color: 'bg-gray-800',
    objects: ['Pages', 'Databases', 'Blocks']
  },
  { 
    id: 'intercom', 
    name: 'Intercom', 
    icon: Users, 
    color: 'bg-blue-600',
    objects: ['Conversations', 'Contacts', 'Companies', 'Articles']
  },
  { 
    id: 'freshdesk', 
    name: 'Freshdesk', 
    icon: Ticket, 
    color: 'bg-teal-500',
    objects: ['Tickets', 'Contacts', 'Companies', 'Solutions']
  },
];

export function IntegrationSources() {
  const { integrations, loading, createIntegrationSource, toggleSource, deleteSource, triggerReindex } = useSources();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<typeof integrationTypes[0] | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    auth_type: "api_key",
    api_key: "",
    selected_objects: [] as string[],
    sync_frequency: "daily" as const,
  });

  const handleIntegrationSelect = (integrationId: string) => {
    const integration = integrationTypes.find(i => i.id === integrationId);
    setSelectedIntegration(integration || null);
    setFormData({
      ...formData,
      name: integration?.name || "",
      selected_objects: [],
    });
  };

  const handleObjectToggle = (objectName: string) => {
    setFormData(prev => ({
      ...prev,
      selected_objects: prev.selected_objects.includes(objectName)
        ? prev.selected_objects.filter(o => o !== objectName)
        : [...prev.selected_objects, objectName]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntegration) return;

    await createIntegrationSource({
      name: formData.name || selectedIntegration.name,
      integration_type: selectedIntegration.id,
      auth_type: formData.auth_type,
      auth_credentials: formData.auth_type === 'api_key' ? { api_key: formData.api_key } : undefined,
      selected_objects: formData.selected_objects,
      sync_frequency: formData.sync_frequency,
    });

    setFormData({
      name: "",
      auth_type: "api_key",
      api_key: "",
      selected_objects: [],
      sync_frequency: "daily",
    });
    setSelectedIntegration(null);
    setDialogOpen(false);
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              App Integrations
            </CardTitle>
            <CardDescription>
              Connect CRM, Helpdesk, and other apps to sync data
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Integration</DialogTitle>
                <DialogDescription>
                  Connect an external app to sync data
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Select Integration</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {integrationTypes.map((integration) => {
                        const Icon = integration.icon;
                        const isSelected = selectedIntegration?.id === integration.id;
                        return (
                          <button
                            key={integration.id}
                            type="button"
                            onClick={() => handleIntegrationSelect(integration.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className={`p-2 rounded-md ${integration.color}`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-medium">{integration.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedIntegration && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="name">Connection Name</Label>
                        <Input
                          id="name"
                          placeholder={`My ${selectedIntegration.name}`}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="auth_type">Authentication Method</Label>
                        <Select
                          value={formData.auth_type}
                          onValueChange={(value) => setFormData({ ...formData, auth_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="oauth">OAuth (Coming Soon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.auth_type === 'api_key' && (
                        <div className="grid gap-2">
                          <Label htmlFor="api_key">API Key</Label>
                          <div className="relative">
                            <Input
                              id="api_key"
                              type={showApiKey ? "text" : "password"}
                              placeholder="Enter your API key"
                              value={formData.api_key}
                              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Select Objects to Sync</Label>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
                          {selectedIntegration.objects.map((obj) => (
                            <div key={obj} className="flex items-center space-x-2">
                              <Checkbox
                                id={obj}
                                checked={formData.selected_objects.includes(obj)}
                                onCheckedChange={() => handleObjectToggle(obj)}
                              />
                              <label
                                htmlFor={obj}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {obj}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="frequency">Sync Frequency</Label>
                        <Select
                          value={formData.sync_frequency}
                          onValueChange={(value: any) => setFormData({ ...formData, sync_frequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!selectedIntegration}>
                    Connect Integration
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {integrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Link2 className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-medium">No integrations connected</h3>
                <p className="text-sm">Connect your CRM or helpdesk to sync data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.map((integration) => {
                  const source = integration.knowledge_source;
                  const status = source?.status || 'idle';
                  const StatusIcon = statusConfig[status].icon;
                  const isRunning = status === 'running';
                  const integrationType = integrationTypes.find(i => i.id === integration.integration_type);
                  const Icon = integrationType?.icon || Link2;

                  return (
                    <Card key={integration.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${integrationType?.color || 'bg-muted'}`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{source?.name || integrationType?.name}</h4>
                                <Badge variant="outline" className={statusConfig[status].bg}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${isRunning ? 'animate-spin' : ''} ${statusConfig[status].color}`} />
                                  {statusConfig[status].label}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span className="capitalize">{integration.integration_type}</span>
                                <span>•</span>
                                <span>Sync: {integration.sync_frequency}</span>
                                <span>•</span>
                                <span>{integration.records_synced} records</span>
                              </div>
                              {integration.selected_objects.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {integration.selected_objects.map((obj, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {obj}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {integration.last_sync_at && (
                                <p className="text-xs text-muted-foreground">
                                  Last synced: {format(new Date(integration.last_sync_at), 'MMM d, yyyy HH:mm')}
                                </p>
                              )}
                              {source?.error_message && (
                                <p className="text-xs text-destructive">{source.error_message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={source?.is_enabled ?? true}
                              onCheckedChange={(checked) => source && toggleSource(source.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => source && triggerReindex(source.id)}
                              disabled={isRunning}
                            >
                              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => source && deleteSource(source.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
