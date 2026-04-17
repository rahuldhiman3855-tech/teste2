import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { TroubleshootSidebar } from "@/components/TroubleshootSidebar";
import { addSessionId, getStoredSessionIds } from "@/components/ChatHistory";

const CURRENT_SESSION_KEY = "current_chat_session_id";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatDebugPayload } from "@/lib/chatDebug";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: File[];
  rating?: number;
  followUpQuestion?: string;
  relatedResources?: Array<{ title: string; url: string }>;
  chatLogId?: string; // Database ID for tracking feedback
  debugPayload?: ChatDebugPayload;
}

const CHAT_URL = import.meta.env.VITE_CHAT_FUNCTION_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  temperature,
  maxTokens,
  conversationMemory,
  provider,
  model,
  sessionId,
  onDelta,
  onDebug,
  onDone,
  onError,
}: {
  messages: { role: "user" | "assistant"; content: string }[];
  temperature: number;
  maxTokens: number;
  conversationMemory: number;
  provider: string;
  model: string;
  sessionId?: string | null;
  onDelta: (deltaText: string) => void;
  onDebug: (debugPayload: ChatDebugPayload) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  // Limit messages to conversation memory setting
  const limitedMessages = messages.slice(-conversationMemory);

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
      body: JSON.stringify({ 
      messages: limitedMessages,
      temperature,
      max_tokens: maxTokens,
      provider,
      model,
      session_id: sessionId,
    }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    onError(errorData.error || `Request failed with status ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.debug) {
          onDebug(parsed.debug as ChatDebugPayload);
          continue;
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

const IndexContent = () => {
  const { config, loading: configLoading } = useAgentConfig();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toggleSidebar } = useSidebar();
  const { setTheme, theme } = useTheme();

  // Create new chat session
  const createNewSession = async () => {
    // End current session if exists
    if (sessionId) {
      await supabase.from('chat_sessions').update({
        is_active: false,
        session_end: new Date().toISOString(),
      }).eq('id', sessionId);
    }

    try {
      const { data, error } = await supabase.from('chat_sessions').insert([{
        user_id: user?.id || null,
        session_start: new Date().toISOString(),
        is_active: true,
        total_messages: 0,
      }]).select('id').single();
      
      if (error) {
        console.error("Error creating session:", error);
        return;
      }
      const newSessionId = data?.id || null;
      setSessionId(newSessionId);
      if (newSessionId) {
        addSessionId(newSessionId);
        localStorage.setItem(CURRENT_SESSION_KEY, newSessionId);
      }
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: config.welcome_message,
      }]);
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };

  const ensureSessionId = async () => {
    if (sessionId) {
      return sessionId;
    }

    try {
      const { data, error } = await supabase.from('chat_sessions').insert([{
        user_id: user?.id || null,
        session_start: new Date().toISOString(),
        is_active: true,
        total_messages: 0,
      }]).select('id').single();

      if (error || !data?.id) {
        console.error("Error creating session:", error);
        return null;
      }

      setSessionId(data.id);
      addSessionId(data.id);
      localStorage.setItem(CURRENT_SESSION_KEY, data.id);
      return data.id;
    } catch (err) {
      console.error("Error ensuring session:", err);
      return null;
    }
  };

  // Load session messages
  const loadSession = async (loadSessionId: string) => {
    try {
      const { data: logs, error } = await supabase
        .from('chat_logs')
        .select('id, user_message, ai_response, provider, model, rag_context, retrieved_chunks, context_images, debug_payload')
        .eq('session_id', loadSessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error loading session:", error);
        return;
      }

      // Convert logs to messages
      const loadedMessages: Message[] = [];
      logs?.forEach((log, index) => {
        loadedMessages.push({
          id: `user-${index}`,
          role: "user",
          content: log.user_message,
        });
        loadedMessages.push({
          id: `assistant-${index}`,
          role: "assistant",
          content: log.ai_response,
          chatLogId: log.id,
          rating: 0,
          debugPayload: (log.debug_payload as ChatDebugPayload) || {
            session_id: loadSessionId,
            provider: log.provider || undefined,
            model: log.model || undefined,
            rag_context: log.rag_context || null,
            retrieved_chunks: (log.retrieved_chunks as ChatDebugPayload["retrieved_chunks"]) || [],
            context_images: (log.context_images as ChatDebugPayload["context_images"]) || [],
            source: "supabase",
          },
        });
      });

      // End current session if different
      if (sessionId && sessionId !== loadSessionId) {
        await supabase.from('chat_sessions').update({
          is_active: false,
          session_end: new Date().toISOString(),
        }).eq('id', sessionId);
      }

      setSessionId(loadSessionId);
      localStorage.setItem(CURRENT_SESSION_KEY, loadSessionId);
      setMessages(loadedMessages.length > 0 ? loadedMessages : [{
        id: "welcome",
        role: "assistant",
        content: config.welcome_message,
      }]);

      // Mark session as active
      await supabase.from('chat_sessions').update({
        is_active: true,
      }).eq('id', loadSessionId);
    } catch (err) {
      console.error("Error loading session:", err);
    }
  };

  // Restore or create chat session on mount
  useEffect(() => {
    const restoreOrCreateSession = async () => {
      const savedSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
      const storedIds = getStoredSessionIds();
      
      // Try to restore previous session if it exists
      if (savedSessionId && storedIds.includes(savedSessionId)) {
        await loadSession(savedSessionId);
      } else {
        await createNewSession();
      }
    };
    
    restoreOrCreateSession();
    
    // End session on unmount
    return () => {
      if (sessionId) {
        supabase.from('chat_sessions').update({
          is_active: false,
          session_end: new Date().toISOString(),
        }).eq('id', sessionId).then(() => {});
      }
    };
  }, [user?.id]);

  // Set initial welcome message when config loads
  useEffect(() => {
    if (!configLoading && config.welcome_message) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: config.welcome_message,
        },
      ]);
    }
  }, [configLoading, config.welcome_message]);

  // Categorize message into topic
  const categorizeMessage = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    const topicKeywords: Record<string, string[]> = {
      'Technical Issues': ['error', 'bug', 'issue', 'problem', 'fix', 'broken', 'not working', 'crash', 'fail'],
      'How To': ['how to', 'how do', 'how can', 'steps', 'guide', 'tutorial', 'explain', 'show me'],
      'Account & Login': ['login', 'password', 'account', 'sign in', 'register', 'forgot', 'access'],
      'Features': ['feature', 'functionality', 'can it', 'does it', 'support', 'capability'],
      'Pricing': ['price', 'cost', 'plan', 'subscription', 'billing', 'payment', 'free'],
      'Integration': ['integrate', 'api', 'connect', 'sync', 'import', 'export', 'webhook'],
      'General Inquiry': ['what is', 'tell me', 'help', 'information', 'about'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        return topic;
      }
    }
    return 'Other';
  };

  // Calculate confidence score based on response quality
  const calculateConfidence = (response: string): number => {
    const responseLength = response.length;
    const hasCode = response.includes('```');
    const hasList = response.includes('\n-') || response.includes('\n•') || response.includes('\n1.');
    const hasHeadings = response.includes('#');
    
    let confidence = 40 + Math.min(30, responseLength / 50);
    if (hasCode) confidence += 15;
    if (hasList) confidence += 10;
    if (hasHeadings) confidence += 5;
    
    return Math.min(100, Math.round(confidence));
  };

  // Log feedback to database
  const logFeedbackToDatabase = async (chatLogId: string, rating: 'thumbs_up' | 'thumbs_down') => {
    try {
      const { error } = await supabase.from('chat_feedback').insert([{
        chat_log_id: chatLogId,
        user_id: user?.id || null,
        rating,
      }]);
      
      if (error) {
        console.error("Error logging feedback:", error);
      }
    } catch (err) {
      console.error("Error logging feedback:", err);
    }
  };

  const logChatToDatabase = async (
    userMessage: string,
    aiResponse: string,
    startTime: number,
    effectiveSessionId: string | null,
    debugPayload?: ChatDebugPayload | null
  ) => {
    try {
      const responseTimeMs = Date.now() - startTime;
      const topic = categorizeMessage(userMessage);
      const confidenceScore = calculateConfidence(aiResponse);
      
      const { data, error } = await supabase.from('chat_logs').insert([{
        user_id: user?.id || null,
        user_message: userMessage,
        ai_response: aiResponse,
        response_time_ms: responseTimeMs,
        topic,
        confidence_score: confidenceScore,
        session_id: effectiveSessionId,
        provider: debugPayload?.provider || config.llm_provider || null,
        model: debugPayload?.model || config.llm_model || null,
        rag_context: debugPayload?.rag_context || null,
        retrieved_chunks: debugPayload?.retrieved_chunks || [],
        context_images: debugPayload?.context_images || [],
        debug_payload: debugPayload || {},
      }]).select('id').single();
      
      if (error) {
        console.error("Error logging chat:", error);
        return null;
      }
      
      // Update session message count
      if (effectiveSessionId) {
        await supabase.from('chat_sessions')
          .update({ total_messages: messages.filter(m => m.role === 'user').length + 1 })
          .eq('id', effectiveSessionId);
      }
      
      return data?.id;
    } catch (err) {
      console.error("Error logging chat:", err);
      return null;
    }
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    const effectiveSessionId = await ensureSessionId();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      files,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    const startTime = Date.now();
    let assistantContent = "";
    let debugPayload: ChatDebugPayload | null = null;
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id === "streaming") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [
          ...prev,
          { id: "streaming", role: "assistant", content: assistantContent },
        ];
      });
    };
    const updateDebug = (payload: ChatDebugPayload) => {
      debugPayload = payload;
    };

    // Prepare messages for API (exclude files, welcome message metadata)
    const apiMessages = [...messages.filter(m => m.id !== "welcome"), userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await streamChat({
        messages: apiMessages,
        temperature: config.temperature,
        maxTokens: config.max_response_tokens,
        conversationMemory: config.conversation_memory,
        provider: config.llm_provider,
        model: config.llm_model,
        sessionId: effectiveSessionId,
        onDelta: updateAssistant,
        onDebug: updateDebug,
        onDone: async () => {
          // Log chat to database and get the ID
          const chatLogId = await logChatToDatabase(content, assistantContent, startTime, effectiveSessionId, debugPayload);
          
          setMessages((prev) =>
            prev.map((m) =>
              m.id === "streaming"
                ? {
                    ...m,
                    id: (Date.now() + 1).toString(),
                    rating: 0,
                    chatLogId: chatLogId || undefined,
                    debugPayload: debugPayload || undefined,
                  }
                : m
            )
          );
          setIsTyping(false);
        },
        onError: (error) => {
          toast.error(error);
          setIsTyping(false);
        },
      });
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      setIsTyping(false);
    }
  };

  const handleRating = async (messageId: string, delta: number) => {
    // Find the message to get chatLogId
    const message = messages.find(m => m.id === messageId);
    
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.role === "assistant"
          ? { ...msg, rating: (msg.rating || 0) + delta }
          : msg
      )
    );

    // Log feedback to database if we have a chatLogId
    if (message?.chatLogId) {
      const rating = delta > 0 ? 'thumbs_up' : 'thumbs_down';
      await logFeedbackToDatabase(message.chatLogId, rating);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => inputRef.current?.focus(),
    },
    {
      key: "b",
      ctrlKey: true,
      action: () => toggleSidebar(),
    },
    {
      key: "d",
      ctrlKey: true,
      action: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      key: "n",
      ctrlKey: true,
      action: () => {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: config.welcome_message,
          },
        ]);
      },
    },
    {
      key: "?",
      ctrlKey: true,
      action: () => setShowShortcuts(true),
    },
    {
      key: "Escape",
      action: () => setShowShortcuts(false),
    },
  ]);

  return (
    <>
      <div className="flex min-h-screen w-full bg-background">
        <TroubleshootSidebar 
          onQuickAction={handleQuickAction}
          currentSessionId={sessionId}
          onSelectSession={loadSession}
          onNewChat={createNewSession}
        />
        
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2">
            <SidebarTrigger />
            <ChatHeader 
              onShowShortcuts={() => setShowShortcuts(true)} 
              onClearChat={() => {
                setMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content: config.welcome_message,
                  },
                ]);
              }}
            />
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="container max-w-4xl mx-auto">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  files={message.files}
                  rating={message.rating}
                  followUpQuestion={message.followUpQuestion}
                  relatedResources={message.relatedResources}
                  debugPayload={message.debugPayload}
                  onRating={(delta) => handleRating(message.id, delta)}
                  onFollowUpClick={handleSendMessage}
                />
              ))}
              {isTyping && messages[messages.length - 1]?.role !== "assistant" && <TypingIndicator />}
            </div>
          </main>

          <ChatInput 
            ref={inputRef}
            onSendMessage={handleSendMessage} 
            disabled={isTyping} 
          />
        </SidebarInset>
      </div>

      <KeyboardShortcutsDialog 
        open={showShortcuts} 
        onOpenChange={setShowShortcuts} 
      />
    </>
  );
};

const Index = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <IndexContent />
    </SidebarProvider>
  );
};

export default Index;
