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

async function buildRagContext(query: string) {
  if (!query.trim()) {
    return null;
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
      return null;
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) {
      return null;
    }

    const imageResults = results.filter((result) => typeof result?.text === "string" && result.text.includes("[IMAGE:"));
    const prioritizedResults = (imageResults.length > 0 ? imageResults : results).slice(0, RAG_IMAGE_RESULT_LIMIT);
    if (prioritizedResults.length === 0) {
      return null;
    }

    const contextBlocks = prioritizedResults.map((result: Record<string, unknown>, index: number) => {
      const originalFilename = String(result.original_filename || "unknown");
      const chunkIndex = String(result.chunk_index || index + 1);
      const pageStart = String(result.page_start || "?");
      const pageEnd = String(result.page_end || "?");
      const matchedTerms = Array.isArray(result.matched_terms) ? result.matched_terms.join(", ") : "";
      const compressedText = compressRagChunk(String(result.text || ""), RAG_CONTEXT_RESULT_CHAR_LIMIT);

      return [
        `Result ${index + 1}: ${originalFilename} | chunk ${chunkIndex} | pages ${pageStart}-${pageEnd}`,
        matchedTerms ? `Matched terms: ${matchedTerms}` : null,
        compressedText ? compressedText : null,
      ]
        .filter(Boolean)
        .join("\n");
    });

    const contextText = [
      "RAG context below is OCR/image-derived evidence. Use it first for grounded answers about diagrams, flowcharts, and screenshots.",
      "Only rely on the retrieved context when it supports the answer. If the answer is not visible in the context, say so plainly.",
      ...contextBlocks,
    ].join("\n\n");

    return contextText.length > RAG_CONTEXT_CHAR_LIMIT
      ? contextText.slice(0, RAG_CONTEXT_CHAR_LIMIT)
      : contextText;
  } catch (error) {
    console.warn("RAG context unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, temperature, max_tokens, model, provider } = await req.json();
    const selectedProvider = (provider || "lovable").toLowerCase();
    const latestUserMessage = getLatestUserMessage(messages);

    // Fetch system prompt from agent_config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const ragContext = isGreetingOnlyQuery(latestUserMessage) ? null : await buildRagContext(latestUserMessage);
    const augmentedSystemPrompt = ragContext
      ? `${systemPrompt}\n\n${ragContext}`
      : systemPrompt;

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

    return new Response(response.body, {
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
