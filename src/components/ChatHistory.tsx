import { useState, useEffect } from "react";
import { format } from "date-fns";
import { MessageSquare, Clock, Trash2, Pin, PinOff, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const SESSIONS_STORAGE_KEY = "chat_session_ids";
const PINNED_SESSIONS_KEY = "pinned_session_ids";

interface ChatSession {
  id: string;
  session_start: string;
  total_messages: number;
  is_active: boolean;
  preview?: string;
  isPinned?: boolean;
}

interface ChatHistoryProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

// Store session IDs in localStorage for anonymous users
export function getStoredSessionIds(): string[] {
  try {
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addSessionId(sessionId: string) {
  const ids = getStoredSessionIds();
  if (!ids.includes(sessionId)) {
    ids.unshift(sessionId);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(ids.slice(0, 50)));
  }
}

export function removeSessionId(sessionId: string) {
  const ids = getStoredSessionIds().filter(id => id !== sessionId);
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(ids));
}

function getPinnedSessionIds(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function togglePinnedSession(sessionId: string): boolean {
  const pinned = getPinnedSessionIds();
  const isPinned = pinned.includes(sessionId);
  
  if (isPinned) {
    localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify(pinned.filter(id => id !== sessionId)));
    return false;
  } else {
    localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify([sessionId, ...pinned]));
    return true;
  }
}

function removePinnedSession(sessionId: string) {
  const pinned = getPinnedSessionIds().filter(id => id !== sessionId);
  localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify(pinned));
}

export function ChatHistory({ currentSessionId, onSelectSession, onNewChat, onDeleteSession }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionIds = getStoredSessionIds();
        const pinnedIds = getPinnedSessionIds();
        
        if (sessionIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: sessionsData, error: sessionsError } = await supabase
          .from('chat_sessions')
          .select('id, session_start, total_messages, is_active')
          .in('id', sessionIds)
          .order('session_start', { ascending: false })
          .limit(20);

        if (sessionsError) {
          console.error("Error fetching sessions:", sessionsError);
          setLoading(false);
          return;
        }

        const sessionsWithPreviews = await Promise.all(
          (sessionsData || []).map(async (session) => {
            const { data: logData } = await supabase
              .from('chat_logs')
              .select('user_message')
              .eq('session_id', session.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();

            return {
              ...session,
              preview: logData?.user_message?.slice(0, 50) || 'New conversation',
              isPinned: pinnedIds.includes(session.id),
            };
          })
        );

        // Sort: pinned first, then by date
        sessionsWithPreviews.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.session_start).getTime() - new Date(a.session_start).getTime();
        });

        setSessions(sessionsWithPreviews);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [currentSessionId]);

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!pendingDeleteId) return;
    
    const isCurrentSession = pendingDeleteId === currentSessionId;
    
    try {
      await supabase.from('chat_logs').delete().eq('session_id', pendingDeleteId);
      await supabase.from('chat_sessions').delete().eq('id', pendingDeleteId);
      removeSessionId(pendingDeleteId);
      removePinnedSession(pendingDeleteId);
      
      setSessions(prev => prev.filter(s => s.id !== pendingDeleteId));
      
      // If we deleted the current session, notify parent and start new chat
      if (isCurrentSession) {
        onDeleteSession?.(pendingDeleteId);
        onNewChat();
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
    
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  };

  const confirmClearAllHistory = async () => {
    try {
      const sessionIds = getStoredSessionIds();
      
      // Delete all chat logs and sessions
      for (const sessionId of sessionIds) {
        await supabase.from('chat_logs').delete().eq('session_id', sessionId);
        await supabase.from('chat_sessions').delete().eq('id', sessionId);
      }
      
      // Clear localStorage
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      localStorage.removeItem(PINNED_SESSIONS_KEY);
      
      setSessions([]);
      onNewChat();
    } catch (err) {
      console.error("Error clearing history:", err);
    }
    
    setClearAllDialogOpen(false);
  };

  const handleTogglePin = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = togglePinnedSession(sessionId);
    
    setSessions(prev => {
      const updated = prev.map(s => 
        s.id === sessionId ? { ...s, isPinned: newPinned } : s
      );
      // Re-sort after pin toggle
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.session_start).getTime() - new Date(a.session_start).getTime();
      });
    });
  };

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2">
        <Button 
          onClick={onNewChat} 
          variant="outline" 
          className="w-full justify-start gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No chat history yet
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession(session.id);
                  }
                }}
                className={`relative w-full text-left p-3 pr-16 rounded-lg transition-colors ${
                  currentSessionId === session.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {session.isPinned && (
                        <Pin className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate">{session.preview}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(session.session_start), "MMM d, h:mm a")}</span>
                      {session.total_messages > 0 && (
                        <span className="text-muted-foreground/60">• {session.total_messages} msgs</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleTogglePin(session.id, e)}
                    title={session.isPinned ? "Unpin" : "Pin"}
                  >
                    {session.isPinned ? (
                      <PinOff className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Pin className="h-3.5 w-3.5 text-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleDeleteClick(session.id, e)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {sessions.length > 0 && (
        <div className="p-2 border-t border-border">
          <Button 
            onClick={() => setClearAllDialogOpen(true)} 
            variant="ghost" 
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash className="h-4 w-4" />
            Clear All History
          </Button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all chat history? This will remove {sessions.length} conversation{sessions.length !== 1 ? 's' : ''} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAllHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
