import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Globe, Plus, RefreshCw, Trash2, Settings, 
  CheckCircle2, XCircle, Clock, Loader2, Eye, EyeOff 
} from "lucide-react";
import { useSources } from "@/hooks/useSources";
import { format } from "date-fns";

const statusConfig = {
  idle: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Idle" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Completed" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Pending" },
};

export function WebCrawlerSources() {
  const { webCrawlers, loading, createWebCrawlerSource, toggleSource, deleteSource, triggerReindex } = useSources();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    seed_url: "",
    crawl_entire_domain: false,
    crawl_depth: 2,
    include_patterns: "",
    exclude_patterns: "",
    crawl_frequency: "manual" as const,
    auth_type: "",
    username: "",
    password: "",
    headers: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let authCredentials: Record<string, any> | undefined;
    if (formData.auth_type === 'basic') {
      authCredentials = { username: formData.username, password: formData.password };
    } else if (formData.auth_type === 'headers') {
      try {
        authCredentials = JSON.parse(formData.headers);
      } catch {
        authCredentials = { custom: formData.headers };
      }
    }

    await createWebCrawlerSource({
      name: formData.name || formData.seed_url,
      seed_url: formData.seed_url,
      crawl_entire_domain: formData.crawl_entire_domain,
      crawl_depth: formData.crawl_depth,
      include_patterns: formData.include_patterns.split('\n').filter(Boolean),
      exclude_patterns: formData.exclude_patterns.split('\n').filter(Boolean),
      crawl_frequency: formData.crawl_frequency,
      auth_type: formData.auth_type || undefined,
      auth_credentials: authCredentials,
    });

    setFormData({
      name: "",
      seed_url: "",
      crawl_entire_domain: false,
      crawl_depth: 2,
      include_patterns: "",
      exclude_patterns: "",
      crawl_frequency: "manual",
      auth_type: "",
      username: "",
      password: "",
      headers: "",
    });
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
              <Globe className="h-5 w-5" />
              Web Crawler Sources
            </CardTitle>
            <CardDescription>
              Add websites to crawl and index for your AI agent
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Web Crawler
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Web Crawler Source</DialogTitle>
                <DialogDescription>
                  Configure a new website to crawl and index
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Source Name (optional)</Label>
                    <Input
                      id="name"
                      placeholder="My Website"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="seed_url">Seed URL *</Label>
                    <Input
                      id="seed_url"
                      type="url"
                      placeholder="https://example.com"
                      value={formData.seed_url}
                      onChange={(e) => setFormData({ ...formData, seed_url: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="crawl_domain">Crawl Entire Domain</Label>
                      <p className="text-xs text-muted-foreground">
                        Crawl all pages on this domain, not just the seed URL
                      </p>
                    </div>
                    <Switch
                      id="crawl_domain"
                      checked={formData.crawl_entire_domain}
                      onCheckedChange={(checked) => setFormData({ ...formData, crawl_entire_domain: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Crawl Depth: {formData.crawl_depth}</Label>
                    <Slider
                      value={[formData.crawl_depth]}
                      onValueChange={([value]) => setFormData({ ...formData, crawl_depth: value })}
                      min={1}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      How deep to follow links from the seed URL
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="include_patterns">Include URL Patterns (one per line)</Label>
                    <Textarea
                      id="include_patterns"
                      placeholder="/docs/*&#10;/blog/*"
                      value={formData.include_patterns}
                      onChange={(e) => setFormData({ ...formData, include_patterns: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="exclude_patterns">Exclude URL Patterns (one per line)</Label>
                    <Textarea
                      id="exclude_patterns"
                      placeholder="/admin/*&#10;/login/*"
                      value={formData.exclude_patterns}
                      onChange={(e) => setFormData({ ...formData, exclude_patterns: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="frequency">Crawl Frequency</Label>
                    <Select
                      value={formData.crawl_frequency}
                      onValueChange={(value: any) => setFormData({ ...formData, crawl_frequency: value })}
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

                  <div className="grid gap-2">
                    <Label htmlFor="auth_type">Authentication (optional)</Label>
                    <Select
                      value={formData.auth_type}
                      onValueChange={(value) => setFormData({ ...formData, auth_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No authentication" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="headers">Custom Headers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.auth_type === 'basic' && (
                    <div className="grid gap-4 p-4 border rounded-lg">
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.auth_type === 'headers' && (
                    <div className="grid gap-2">
                      <Label htmlFor="headers">Custom Headers (JSON)</Label>
                      <Textarea
                        id="headers"
                        placeholder='{"Authorization": "Bearer token123"}'
                        value={formData.headers}
                        onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                        rows={3}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Crawler</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {webCrawlers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Globe className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-medium">No web crawlers configured</h3>
                <p className="text-sm">Add a web crawler to start indexing websites</p>
              </div>
            ) : (
              <div className="space-y-4">
                {webCrawlers.map((crawler) => {
                  const source = crawler.knowledge_source;
                  const status = source?.status || 'idle';
                  const StatusIcon = statusConfig[status].icon;
                  const isRunning = status === 'running';

                  return (
                    <Card key={crawler.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{source?.name || crawler.seed_url}</h4>
                              <Badge variant="outline" className={statusConfig[status].bg}>
                                <StatusIcon className={`h-3 w-3 mr-1 ${isRunning ? 'animate-spin' : ''} ${statusConfig[status].color}`} />
                                {statusConfig[status].label}
                              </Badge>
                            </div>
                            <a 
                              href={crawler.seed_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              {crawler.seed_url}
                            </a>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>Depth: {crawler.crawl_depth}</span>
                              <span>•</span>
                              <span>Frequency: {crawler.crawl_frequency}</span>
                              <span>•</span>
                              <span>Pages: {crawler.pages_crawled}</span>
                              {crawler.crawl_entire_domain && (
                                <>
                                  <span>•</span>
                                  <Badge variant="secondary" className="text-xs">Full Domain</Badge>
                                </>
                              )}
                            </div>
                            {crawler.last_crawl_at && (
                              <p className="text-xs text-muted-foreground">
                                Last crawled: {format(new Date(crawler.last_crawl_at), 'MMM d, yyyy HH:mm')}
                              </p>
                            )}
                            {source?.error_message && (
                              <p className="text-xs text-destructive">{source.error_message}</p>
                            )}
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
