import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getLocalChatDebugBaseUrl,
  getRagAssetUrl,
  getSupabaseChatDebugBaseUrl,
  type ChatDebugPayload,
  type DebugChunk,
} from "@/lib/chatDebug";

type DebugSource = "supabase" | "local";

interface SessionSummary {
  session_id: string;
  source: DebugSource;
  turn_count: number;
  session_start: string | null;
  session_end: string | null;
  preview: string;
  last_activity_at: string | null;
  user_id?: string | null;
  total_messages?: number;
  is_active?: boolean;
}

interface SessionDetailLog {
  id: string;
  created_at: string;
  user_message: string;
  ai_response: string;
  provider?: string | null;
  model?: string | null;
  rag_context?: string | null;
  retrieved_chunks?: DebugChunk[];
  context_images?: Array<{ path: string; url?: string }>;
  debug_payload?: ChatDebugPayload;
}

interface SessionDetail {
  session: {
    id: string;
    user_id?: string | null;
    session_start?: string | null;
    session_end?: string | null;
    total_messages?: number;
    is_active?: boolean;
    metadata?: unknown;
  };
  logs: SessionDetailLog[];
}

const sources: Array<{ key: DebugSource; label: string }> = [
  { key: "supabase", label: "Supabase" },
  { key: "local", label: "Local Proxy" },
];

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function buildSourceBaseUrl(source: DebugSource) {
  return source === "supabase" ? getSupabaseChatDebugBaseUrl() : getLocalChatDebugBaseUrl();
}

function DebugSessionContent({ detail }: { detail: SessionDetail }) {
  if (!detail.logs.length) {
    return <p className="text-sm text-muted-foreground">No logs found.</p>;
  }

  return (
    <div className="space-y-4">
      {detail.logs.map((log, index) => (
        <Card key={log.id}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">Turn {index + 1}</CardTitle>
              <Badge variant="outline">{log.provider || "n/a"}</Badge>
              <Badge variant="outline">{log.model || "n/a"}</Badge>
              <Badge variant="secondary">{format(new Date(log.created_at), "PPp")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">User</div>
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{log.user_message}</pre>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Assistant</div>
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{log.ai_response}</pre>
            </div>
            {log.rag_context && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Context</div>
                <pre className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-xs overflow-x-auto">
                  {log.rag_context}
                </pre>
              </div>
            )}
            {log.retrieved_chunks && log.retrieved_chunks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Chunks</div>
                <div className="space-y-3">
                  {log.retrieved_chunks.map((chunk, chunkIndex) => (
                    <div key={`${log.id}-chunk-${chunkIndex}`} className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{chunk.original_filename || "unknown"}</Badge>
                        <Badge variant="outline">Chunk {chunk.chunk_index}</Badge>
                        <Badge variant="secondary">Pages {chunk.page_start}-{chunk.page_end}</Badge>
                      </div>
                      {chunk.matched_terms?.length ? (
                        <p className="text-xs text-muted-foreground">Matched terms: {chunk.matched_terms.join(", ")}</p>
                      ) : null}
                      {chunk.visual_summary ? (
                        <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">{chunk.visual_summary}</pre>
                      ) : null}
                      {chunk.compressed_text ? (
                        <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">{chunk.compressed_text}</pre>
                      ) : (
                        <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">{chunk.text}</pre>
                      )}
                      {chunk.image_paths?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {chunk.image_paths.map((imagePath) => (
                            <div key={imagePath} className="rounded-md border p-2">
                              <div className="text-[11px] text-muted-foreground break-all mb-2">{imagePath}</div>
                              <img
                                src={getRagAssetUrl(imagePath)}
                                alt={imagePath}
                                className="max-h-56 w-full object-contain rounded"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {log.context_images && log.context_images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {log.context_images.map((image) => (
                  <div key={image.path} className="rounded-md border p-2">
                    <div className="text-[11px] text-muted-foreground break-all mb-2">{image.path}</div>
                    <img src={image.url || getRagAssetUrl(image.path)} alt={image.path} className="max-h-56 w-full object-contain rounded" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Debug() {
  const [activeSource, setActiveSource] = useState<DebugSource>("supabase");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(() => buildSourceBaseUrl(activeSource), [activeSource]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const data = await fetchJson(`${baseUrl}/sessions`);
      setSessions((data.sessions || []).map((session: SessionSummary) => ({ ...session, source: activeSource })));
      setSelectedSessionId(data.sessions?.[0]?.session_id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions([]);
      setSelectedSessionId(null);
      setDetail(null);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadDetail = async (sessionId: string) => {
    setLoadingDetail(true);
    try {
      const data = await fetchJson(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}`);
      setDetail(data as SessionDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session detail");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [activeSource]);

  useEffect(() => {
    if (selectedSessionId) {
      loadDetail(selectedSessionId);
    } else {
      setDetail(null);
    }
  }, [selectedSessionId, activeSource]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Debug</h1>
          <p className="text-muted-foreground">Dev-only chat/session inspection</p>
        </div>
        <Button variant="outline" onClick={loadSessions} disabled={loadingSessions}>
          {loadingSessions ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Tabs value={activeSource} onValueChange={(value) => setActiveSource(value as DebugSource)}>
        <TabsList>
          {sources.map((source) => (
            <TabsTrigger key={source.key} value={source.key}>
              {source.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[75vh] pr-3">
              <div className="space-y-2">
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions found.</p>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.session_id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.session_id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedSessionId === session.session_id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{session.preview}</span>
                        <Badge variant="outline">{session.turn_count} turns</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{session.session_id}</span>
                        {session.last_activity_at ? <span>• {format(new Date(session.last_activity_at), "PPp")}</span> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Detail</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{activeSource}</Badge>
                    <Badge variant="outline">{detail.session.id}</Badge>
                    <Badge variant="secondary">{detail.session.total_messages || 0} total messages</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p>Start: {detail.session.session_start ? format(new Date(detail.session.session_start), "PPp") : "n/a"}</p>
                    <p>End: {detail.session.session_end ? format(new Date(detail.session.session_end), "PPp") : "n/a"}</p>
                  </div>
                </div>
                <DebugSessionContent detail={detail} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a session to inspect context, chunks, and images.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
