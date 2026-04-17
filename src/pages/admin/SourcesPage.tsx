import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, FileText, Link2, Database, BookOpen } from "lucide-react";
import { WebCrawlerSources } from "@/components/sources/WebCrawlerSources";
import { FileSources } from "@/components/sources/FileSources";
import { IntegrationSources } from "@/components/sources/IntegrationSources";
import { SourcesOverview } from "@/components/sources/SourcesOverview";
import { RAGSources } from "@/components/sources/RAGSources";

export default function SourcesPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Knowledge Sources</h1>
        <p className="text-muted-foreground mt-1">
          Manage the knowledge sources that power your AI agent
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="web-crawler" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Web Crawler
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="rag" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            RAG Pipeline
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SourcesOverview />
        </TabsContent>

        <TabsContent value="web-crawler" className="space-y-4">
          <WebCrawlerSources />
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <FileSources />
        </TabsContent>

        <TabsContent value="rag" className="space-y-4">
          <RAGSources />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <IntegrationSources />
        </TabsContent>
      </Tabs>
    </div>
  );
}
