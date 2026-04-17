import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_RAG_API_URL = "http://127.0.0.1:8080";
const RAG_SEARCH_LIMIT = 20;
const RAG_IMAGE_RESULT_LIMIT = 3;
const RAG_CONTEXT_CHAR_LIMIT = 1800;
const RAG_CONTEXT_RESULT_CHAR_LIMIT = 550;
const NVIDIA_ALLOWED_MODELS = new Set([
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.3-70b-instruct",
]);

function normalizeWhitespace(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function getLatestUserMessage(messages: Array<{ role: string; content: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && message.content?.trim()) {
      return message.content.trim();
    }
  }

  return "";
}

function isGreetingOnlyQuery(query: string) {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return true;

  const greetingOnlyPatterns = [
    /^hi$/,
    /^hello$/,
    /^hey$/,
    /^yo$/,
    /^good (morning|afternoon|evening)$/,
    /^(hi|hello|hey)( there)?$/,
    /^(hi|hello|hey)( there)?( assistant| bot)?$/,
    /^how are you$/,
    /^what'?s up$/,
  ];

  return greetingOnlyPatterns.some((pattern) => pattern.test(normalized)) || normalized.length <= 4;
}

function compressRagChunk(chunkText: string, maxChars: number) {
  const lines = normalizeWhitespace(chunkText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  const selectedLineIndexes = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("[IMAGE:")) {
      continue;
    }

    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length - 1, index + 2);
    for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
      selectedLineIndexes.add(lineIndex);
    }
  }

  if (selectedLineIndexes.size === 0) {
    const maxLines = Math.min(lines.length, 14);
    for (let index = 0; index < maxLines; index += 1) {
      selectedLineIndexes.add(index);
    }
  }

  const orderedLines = [...selectedLineIndexes]
    .sort((a, b) => a - b)
    .map((lineIndex) => lines[lineIndex]);

  const compressedLines: string[] = [];
  let charCount = 0;
  for (const line of orderedLines) {
    const candidate = line.replace(/\s+/g, " ");
    const extra = compressedLines.length > 0 ? 1 : 0;
    if (charCount + candidate.length + extra > maxChars) {
      break;
    }

    compressedLines.push(candidate);
    charCount += candidate.length + extra;
  }

  if (compressedLines.length === 0) {
    return normalizeWhitespace(chunkText).slice(0, maxChars);
  }

  if (compressedLines.length < lines.length) {
    compressedLines.push("...");
  }

  return compressedLines.join("\n");
}

function extractImagePaths(chunkText: string) {
  return [...String(chunkText || "").matchAll(/\[IMAGE:\s*([^\]]+)\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

async function buildRagContext(query: string) {
  if (!query.trim()) {
    return {
      contextText: null,
      retrievedChunks: [],
      contextImages: [],
    };
  }

  const ragApiUrl = Deno.env.get("RAG_API_URL") || DEFAULT_RAG_API_URL;
  const params = new URLSearchParams({
    q: query,
    limit: String(RAG_SEARCH_LIMIT),
    min_matches: "1",
  });

  try {
    const response = await fetch(`${ragApiUrl}/api/search?${params.toString()}`);
    if (!response.ok) {
      console.warn("RAG search failed:", response.status);
      return {
        contextText: null,
        retrievedChunks: [],
        contextImages: [],
      };
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) {
      return {
        contextText: null,
        retrievedChunks: [],
        contextImages: [],
      };
    }

    const imageResults = results.filter((result) => typeof result?.text === "string" && result.text.includes("[IMAGE:"));
    const prioritizedResults = (imageResults.length > 0 ? imageResults : results).slice(0, RAG_IMAGE_RESULT_LIMIT);
    if (prioritizedResults.length === 0) {
      return {
        contextText: null,
        retrievedChunks: [],
        contextImages: [],
      };
    }

    const retrievedChunks = prioritizedResults.map((result: Record<string, unknown>, index: number) => {
      const originalFilename = String(result.original_filename || "unknown");
      const chunkIndex = String(result.chunk_index || index + 1);
      const pageStart = String(result.page_start || "?");
      const pageEnd = String(result.page_end || "?");
      const matchedTerms = Array.isArray(result.matched_terms) ? result.matched_terms.join(", ") : "";
      const compressedText = compressRagChunk(String(result.text || ""), RAG_CONTEXT_RESULT_CHAR_LIMIT);
      const imagePaths = extractImagePaths(String(result.text || ""));

      return {
        result_index: index + 1,
        document_id: String(result.document_id || ""),
        original_filename: originalFilename,
        chunk_index: Number(result.chunk_index || index + 1),
        page_start: Number(result.page_start || 0),
        page_end: Number(result.page_end || 0),
        matched_terms: Array.isArray(result.matched_terms) ? result.matched_terms : [],
        score: Number(result.score || 0),
        occurrences: Number(result.occurrences || 0),
        text: String(result.text || ""),
        compressed_text: compressedText,
        image_paths: imagePaths,
      };
    });

    const contextImages = [...new Set(retrievedChunks.flatMap((chunk) => chunk.image_paths))].map((path) => ({
      path,
      url: `${ragApiUrl}/api/assets/${path}`,
    }));

    const contextBlocks = retrievedChunks.map((chunk) => {
      return [
        `Result ${chunk.result_index}: ${chunk.original_filename} | chunk ${chunk.chunk_index} | pages ${chunk.page_start}-${chunk.page_end}`,
        chunk.matched_terms.length ? `Matched terms: ${chunk.matched_terms.join(", ")}` : null,
        chunk.image_paths.length ? `Image paths: ${chunk.image_paths.join(", ")}` : null,
        chunk.compressed_text ? chunk.compressed_text : null,
      ]
        .filter(Boolean)
        .join("\n");
    });

    const contextText = [
      "RAG context below is OCR/image-derived evidence. Use it first for grounded answers about diagrams, flowcharts, and screenshots.",
      "Only rely on the retrieved context when it supports the answer. If the answer is not visible in the context, say so plainly.",
      ...contextBlocks,
    ].join("\n\n");

    return {
      contextText: contextText.length > RAG_CONTEXT_CHAR_LIMIT
        ? contextText.slice(0, RAG_CONTEXT_CHAR_LIMIT)
        : contextText,
      retrievedChunks,
      contextImages,
    };
  } catch (error) {
    console.warn("RAG context unavailable:", error instanceof Error ? error.message : String(error));
    return {
      contextText: null,
      retrievedChunks: [],
      contextImages: [],
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === "GET" && requestUrl.pathname.includes("/debug/")) {
      if (requestUrl.pathname.endsWith("/debug/sessions")) {
        const [{ data: sessions }, { data: logs }] = await Promise.all([
          supabase
            .from("chat_sessions")
            .select("id, user_id, session_start, session_end, total_messages, is_active, metadata")
            .order("session_start", { ascending: false })
            .limit(200),
          supabase
            .from("chat_logs")
            .select("id, session_id, user_id, user_message, ai_response, created_at, provider, model, rag_context, retrieved_chunks, context_images, debug_payload, response_time_ms, topic, confidence_score")
            .order("created_at", { ascending: false })
            .limit(1000),
        ]);

        const groupedLogs = new Map<string, Array<Record<string, unknown>>>();
        for (const log of logs || []) {
          const sessionId = String(log.session_id || "");
          if (!sessionId) continue;
          const existing = groupedLogs.get(sessionId) || [];
          existing.push(log);
          groupedLogs.set(sessionId, existing);
        }

        const sessionsPayload = (sessions || []).map((session) => {
          const sessionLogs = (groupedLogs.get(session.id) || []).sort(
            (a, b) => new Date(String(a.created_at || "")).getTime() - new Date(String(b.created_at || "")).getTime()
          );
          const firstTurn = sessionLogs.find((log) => String(log.user_message || "").trim());
          const lastTurn = sessionLogs[sessionLogs.length - 1];
          return {
            session_id: session.id,
            user_id: session.user_id,
            session_start: session.session_start,
            session_end: session.session_end,
            is_active: session.is_active,
            total_messages: session.total_messages,
            turn_count: sessionLogs.length,
            preview: String(firstTurn?.user_message || "New conversation").slice(0, 160),
            last_activity_at: String(lastTurn?.created_at || session.session_start),
          };
        });

        return new Response(JSON.stringify({ sessions: sessionsPayload }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionMatch = requestUrl.pathname.match(/\/debug\/sessions\/([^/]+)$/);
      if (sessionMatch) {
        const sessionId = decodeURIComponent(sessionMatch[1]);
        const [{ data: session }, { data: logs }] = await Promise.all([
          supabase
            .from("chat_sessions")
            .select("id, user_id, session_start, session_end, total_messages, is_active, metadata")
            .eq("id", sessionId)
            .maybeSingle(),
          supabase
            .from("chat_logs")
            .select("id, session_id, user_id, user_message, ai_response, created_at, provider, model, rag_context, retrieved_chunks, context_images, debug_payload, response_time_ms, topic, confidence_score")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true }),
        ]);

        if (!session) {
          return new Response(JSON.stringify({ error: "Session not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ session, logs: logs || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { messages, temperature, max_tokens, model, provider, session_id } = await req.json();
    const selectedProvider = (provider || "lovable").toLowerCase();
    const latestUserMessage = getLatestUserMessage(messages);

    const { data: configData } = await supabase
      .from("agent_config")
      .select("key, value")
      .eq("key", "system_prompt")
      .single();

    // The value is stored as JSONB, so it's already parsed by Supabase
    // If it's a string, use it directly; if it's an object with a value property, extract it
    let systemPrompt = "You are a helpful AI troubleshooting assistant. Help users diagnose and solve technical issues. Be clear, concise, and provide actionable solutions.";
    
    if (configData?.value) {
      if (typeof configData.value === 'string') {
        systemPrompt = configData.value;
      } else if (typeof configData.value === 'object' && configData.value !== null) {
        // Handle case where value might be stored as { prompt: "..." } or similar
        systemPrompt = (configData.value as Record<string, unknown>).prompt as string || 
                       (configData.value as Record<string, unknown>).value as string || 
                       JSON.stringify(configData.value);
      }
    }

    const ragContextBundle = isGreetingOnlyQuery(latestUserMessage)
      ? { contextText: null, retrievedChunks: [], contextImages: [] }
      : await buildRagContext(latestUserMessage);

    const augmentedSystemPrompt = ragContextBundle.contextText
      ? `${systemPrompt}\n\n${ragContextBundle.contextText}`
      : systemPrompt;

    const debugPayload = {
      session_id: session_id ?? null,
      source: "supabase",
      provider: selectedProvider,
      model: model || "google/gemini-2.5-flash",
      query: latestUserMessage,
      rag_used: !!ragContextBundle.contextText,
      rag_context: ragContextBundle.contextText,
      retrieved_chunks: ragContextBundle.retrievedChunks,
      context_images: ragContextBundle.contextImages,
    };

    // Normalize model name to include provider prefix if missing
    let normalizedModel = model || "google/gemini-2.5-flash";
    if (selectedProvider !== "nvidia" && normalizedModel && !normalizedModel.includes("/")) {
      // Add google/ prefix for gemini models without a prefix
      if (normalizedModel.startsWith("gemini")) {
        normalizedModel = `google/${normalizedModel}`;
      } else if (normalizedModel.startsWith("gpt")) {
        normalizedModel = `openai/${normalizedModel}`;
      }
    }

    if (selectedProvider === "nvidia" && !NVIDIA_ALLOWED_MODELS.has(normalizedModel)) {
      normalizedModel = "meta/llama-3.1-8b-instruct";
    }

    const upstreamUrl =
      selectedProvider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions";

    const upstreamApiKey =
      selectedProvider === "nvidia"
        ? Deno.env.get("NVIDIA_API_KEY") || Deno.env.get("NGC_API_KEY") || Deno.env.get("NVIDIA_BUILD_API_KEY")
        : Deno.env.get("LOVABLE_API_KEY");

    if (!upstreamApiKey) {
      throw new Error(
        selectedProvider === "nvidia"
          ? "NVIDIA_API_KEY or NGC_API_KEY is not configured"
          : "LOVABLE_API_KEY is not configured"
      );
    }

    console.log("Chat request:", { 
      messageCount: messages.length, 
      temperature, 
      max_tokens, 
      provider: selectedProvider,
      model: normalizedModel 
    });

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: normalizedModel,
        messages: [
          { role: "system", content: augmentedSystemPrompt },
          ...messages,
        ],
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ debug: debugPayload })}\n\n`));
        if (!response.body) {
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
