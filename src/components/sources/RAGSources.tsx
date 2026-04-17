import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { useRag } from '@/hooks/useRag';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export function RAGSources() {
  const { documents, stats, loading, isAvailable, error, refresh, addDocument, deleteDocument } = useRag();
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ragBaseUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8080';

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (file.type !== 'application/pdf') {
          toast({
            title: 'Unsupported file',
            description: `${file.name} is not a PDF.`,
            variant: 'destructive',
          });
          continue;
        }

        await addDocument(file);
      }
      toast({
        title: 'Uploaded',
        description: `${files.length} file(s) sent to the RAG pipeline`,
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (documentId: string, filename: string) => {
    const confirmed = window.confirm(`Delete ${filename} from the RAG pipeline?`);
    if (!confirmed) return;
    await deleteDocument(documentId);
  };

  if (!isAvailable && !loading) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900">
            <AlertCircle className="h-5 w-5" />
            RAG Pipeline Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="text-yellow-800">
          <p className="mb-4">
            {error || 'The RAG pipeline service is not available. Make sure it is running on the configured URL.'}
          </p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="border-yellow-200 hover:bg-yellow-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>RAG Pipeline Actions</CardTitle>
            <CardDescription>Upload PDFs directly into the local RAG service or open the pipeline UI</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(ragBaseUrl, '_blank', 'noopener,noreferrer')}
            >
              Open Pipeline
            </Button>
            <Button
              size="sm"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Upload PDFs
                </>
              )}
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={handleUploadChange}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Indexed Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="text-muted-foreground">-</span> : stats?.document_count || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Chunks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="text-muted-foreground">-</span> : stats?.total_chunks || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="text-muted-foreground">-</span> : stats?.total_images || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Indexed PDfs</CardTitle>
            <CardDescription>PDFs processed by the RAG pipeline</CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                <span>Refresh</span>
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No PDFs indexed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {doc.original_filename}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {doc.page_count} pages • {doc.chunk_count} chunks
                      {doc.image_count > 0 && ` • ${doc.image_count} images`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Indexed {format(new Date(doc.created_at_epoch * 1000), 'PPp')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant="outline" className="whitespace-nowrap">
                      {doc.extraction_method}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc.id, doc.original_filename)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
