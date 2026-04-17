#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOST = process.env.CHAT_PROXY_HOST || "127.0.0.1";
const PORT = Number(process.env.CHAT_PROXY_PORT || "8787");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY || process.env.NVIDIA_BUILD_API_KEY;
const RAG_API_URL = process.env.RAG_API_URL || "http://127.0.0.1:8080";
const REPO_ROOT = process.cwd();
const RAG_ROOT = path.join(REPO_ROOT, "rag-pipeline", "rag");
const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || "meta/llama-3.2-11b-vision-instruct";
const ANSWER_MODEL = process.env.NVIDIA_ANSWER_MODEL || "meta/llama-3.1-70b-instruct";
const NVIDIA_MODELS = new Set([
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.3-70b-instruct",
]);
const MAX_CONTEXT_RESULTS = 5;
const MAX_IMAGE_DIMENSION = 1400;
const VISION_IMAGE_LIMIT_PER_RESULT = 3;
const CHUNK_CHAR_LIMIT = 1200;
const DEBUG_STORE_DIR = path.join(REPO_ROOT, "var");
const DEBUG_STORE_FILE = path.join(DEBUG_STORE_DIR, "chat-debug-sessions.jsonl");

function normalizeWhitespace(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function ensureDebugStore() {
  fs.mkdirSync(DEBUG_STORE_DIR, { recursive: true });
}

function appendDebugRecord(record) {
  ensureDebugStore();
  fs.appendFileSync(DEBUG_STORE_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

function ensureDebugSessionId(sessionId) {
  if (sessionId && String(sessionId).trim()) {
    return String(sessionId).trim();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readDebugRecords() {
  if (!fs.existsSync(DEBUG_STORE_FILE)) {
    return [];
  }

  const lines = fs.readFileSync(DEBUG_STORE_FILE, "utf8").split("\n").filter(Boolean);
  const records = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // Skip malformed lines.
    }
  }
  return records;
}

function isGreetingOnlyQuery(query) {
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

function compressRagChunk(chunkText, maxChars) {
  const lines = normalizeWhitespace(chunkText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const selected = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("[IMAGE:")) continue;
    for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i += 1) {
      selected.add(i);
    }
  }

  if (selected.size === 0) {
    for (let i = 0; i < Math.min(lines.length, 14); i += 1) selected.add(i);
  }

  const compressed = [];
  let chars = 0;
  for (const lineIndex of [...selected].sort((a, b) => a - b)) {
    const candidate = lines[lineIndex].replace(/\s+/g, " ");
    const extra = compressed.length > 0 ? 1 : 0;
    if (chars + candidate.length + extra > maxChars) break;
    compressed.push(candidate);
    chars += candidate.length + extra;
  }

  if (compressed.length === 0) return normalizeWhitespace(chunkText).slice(0, maxChars);
  if (compressed.length < lines.length) compressed.push("...");
  return compressed.join("\n");
}

function extractImagePaths(chunkText) {
  const matches = [...String(chunkText || "").matchAll(/\[IMAGE:\s*([^\]]+)\]/g)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

function resolveImagePath(imagePath) {
  if (!imagePath) return null;
  const resolved = path.resolve(RAG_ROOT, imagePath);
  if (!resolved.startsWith(path.resolve(RAG_ROOT))) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

function toDataUrlFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const source = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${source.toString("base64")}`;
}

function downscaleImage(filePath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-img-"));
  const outputPath = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}.jpg`);

  try {
    execFileSync("sips", ["-Z", String(MAX_IMAGE_DIMENSION), "-s", "format", "jpeg", filePath, "--out", outputPath], {
      stdio: "ignore",
    });
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch {
    // Fall back to the original file if local image resizing is unavailable.
  }

  return filePath;
}

function buildVisionMessage(imagePaths, chunkText) {
  const content = [
    {
      type: "text",
      text:
        "Read this chunk and its images carefully. Focus on diagram flow, labels, arrows, decision points, and any OCR text visible in the image. Return a compact but precise summary. If the image and text disagree, prefer the image and mention the mismatch.",
    },
    {
      type: "text",
      text: `Chunk text:\n${compressRagChunk(chunkText, CHUNK_CHAR_LIMIT)}`,
    },
  ];

  for (const imagePath of imagePaths.slice(0, VISION_IMAGE_LIMIT_PER_RESULT)) {
    const resolved = resolveImagePath(imagePath);
    if (!resolved) continue;
    const optimizedPath = downscaleImage(resolved);
    content.push({
      type: "image_url",
      image_url: {
        url: toDataUrlFromFile(optimizedPath),
      },
    });
  }

  return content;
}

async function summarizeChunkWithVision(apiKey, chunk) {
  const imagePaths = extractImagePaths(chunk.text || "");
  if (imagePaths.length === 0) {
    return compressRagChunk(chunk.text || "", CHUNK_CHAR_LIMIT);
  }

  console.log("vision summarize chunk", {
    images: imagePaths.length,
    chunk: chunk.chunk_index,
    file: chunk.original_filename,
  });

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: "You are an OCR and diagram extraction assistant. Summarize the visual flow precisely and compactly." },
        {
          role: "user",
          content: buildVisionMessage(imagePaths, chunk.text || ""),
        },
      ],
      temperature: 0,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("vision upstream error", response.status, errorText);
    return compressRagChunk(chunk.text || "", CHUNK_CHAR_LIMIT);
  }

  const payload = await response.json();
  const summary = payload?.choices?.[0]?.message?.content || "";
  return summary ? String(summary).trim() : compressRagChunk(chunk.text || "", CHUNK_CHAR_LIMIT);
}

async function fetchSystemPrompt() {
  const fallback = "You are a helpful AI troubleshooting assistant. Help users diagnose and solve technical issues. Be clear, concise, and provide actionable solutions.";
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_config?key=eq.system_prompt&select=key,value`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!response.ok) return fallback;
    const data = await response.json();
    const value = data?.[0]?.value;
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      return value.prompt || value.value || JSON.stringify(value);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

async function buildRagContext(query) {
  if (!query.trim() || isGreetingOnlyQuery(query)) {
    return {
      contextText: null,
      retrievedChunks: [],
      contextImages: [],
    };
  }

  try {
    const response = await fetch(
      `${RAG_API_URL}/api/search?` +
        new URLSearchParams({
          q: query,
          limit: "20",
          min_matches: "1",
        }).toString()
    );
    if (!response.ok) {
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

    const scoredResults = results
      .map((result) => ({
        ...result,
        score:
          (Array.isArray(result?.matched_terms) ? result.matched_terms.length : 0) * 10 +
          (typeof result?.text === "string" && result.text.includes("[IMAGE:") ? 50 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const prioritized = scoredResults.slice(0, MAX_CONTEXT_RESULTS);
    if (prioritized.length === 0) {
      return {
        contextText: null,
        retrievedChunks: [],
        contextImages: [],
      };
    }

    const contextParts = [];
    const retrievedChunks = [];
    let totalChars = 0;

    for (let index = 0; index < prioritized.length; index += 1) {
      const result = prioritized[index];
      const header = `Result ${index + 1}: ${String(result.original_filename || "unknown")} | chunk ${String(result.chunk_index || index + 1)} | pages ${String(result.page_start || "?")}-${String(result.page_end || "?")}`;
      const matchedTerms = Array.isArray(result.matched_terms) ? result.matched_terms.join(", ") : "";
      const imagePaths = extractImagePaths(String(result.text || ""));
      const hasImages = imagePaths.length > 0;
      const visualSummary = hasImages ? await summarizeChunkWithVision(NVIDIA_API_KEY, result) : "";
      const compressedText = compressRagChunk(String(result.text || ""), CHUNK_CHAR_LIMIT);
      retrievedChunks.push({
        result_index: index + 1,
        document_id: String(result.document_id || ""),
        original_filename: String(result.original_filename || "unknown"),
        chunk_index: Number(result.chunk_index || index + 1),
        page_start: Number(result.page_start || 0),
        page_end: Number(result.page_end || 0),
        matched_terms: Array.isArray(result.matched_terms) ? result.matched_terms : [],
        score: Number(result.score || 0),
        occurrences: Number(result.occurrences || 0),
        text: String(result.text || ""),
        compressed_text: compressedText,
        image_paths: imagePaths,
        visual_summary: visualSummary || "",
      });
      const block = [
        header,
        matchedTerms ? `Matched terms: ${matchedTerms}` : null,
        hasImages ? `Image count in chunk: ${imagePaths.length}` : null,
        visualSummary ? `Vision summary: ${visualSummary}` : null,
        compressedText ? `Chunk text: ${compressedText}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      if (totalChars + block.length > 12000) {
        break;
      }

      contextParts.push(block);
      totalChars += block.length;
    }

    const contextImages = [...new Set(retrievedChunks.flatMap((chunk) => chunk.image_paths))].map((path) => ({
      path,
      url: `${RAG_API_URL}/api/assets/${path}`,
    }));

    return {
      contextText: [
      "RAG context below is OCR/image-derived evidence. Use image summaries before text summaries when they conflict.",
      "Prioritize diagrams, charts, screenshots, and flow structure over generic text.",
      ...contextParts,
      ].join("\n\n"),
      retrievedChunks,
      contextImages,
    };
  } catch {
    return {
      contextText: null,
      retrievedChunks: [],
      contextImages: [],
    };
  }
}

async function handleChat(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;

  const { messages, temperature, max_tokens, model, provider, session_id } = JSON.parse(body || "{}");
  const selectedProvider = String(provider || "nvidia").toLowerCase();
  const latestUserMessage = [...(messages || [])].reverse().find((message) => message?.role === "user" && message.content?.trim())?.content?.trim() || "";
  const effectiveSessionId = ensureDebugSessionId(session_id);

  console.log("chat request", {
    provider: selectedProvider,
    model,
    message: latestUserMessage,
    rag: !isGreetingOnlyQuery(latestUserMessage),
  });

  if (selectedProvider !== "nvidia") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Local proxy only supports NVIDIA." }));
    return;
  }

  if (!NVIDIA_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "NVIDIA_API_KEY is not configured" }));
    return;
  }

  const allowedModel = NVIDIA_MODELS.has(model) ? model : ANSWER_MODEL;
  const systemPrompt = await fetchSystemPrompt();
  const ragContextBundle = await buildRagContext(latestUserMessage);
  const augmentedSystemPrompt = ragContextBundle.contextText ? `${systemPrompt}\n\n${ragContextBundle.contextText}` : systemPrompt;
  const debugPayload = {
    session_id: effectiveSessionId,
    source: "local",
    provider: selectedProvider,
    model: allowedModel,
    query: latestUserMessage,
    rag_used: !!ragContextBundle.contextText,
    rag_context: ragContextBundle.contextText,
    retrieved_chunks: ragContextBundle.retrievedChunks,
    context_images: ragContextBundle.contextImages,
  };

  const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: allowedModel,
      messages: [
        { role: "system", content: augmentedSystemPrompt },
        ...(messages || []),
      ],
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 2048,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    console.error("nvidia upstream error", upstream.status, errorText);
    res.writeHead(upstream.status || 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: errorText || "AI gateway error" }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  res.write(`data: ${JSON.stringify({ debug: debugPayload })}\n\n`);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    res.write(decoded);
    buffer += decoded;

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") {
        newlineIndex = buffer.indexOf("\n");
        continue;
      }
      if (!line.startsWith("data: ")) {
        newlineIndex = buffer.indexOf("\n");
        continue;
      }

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        newlineIndex = buffer.indexOf("\n");
        continue;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (typeof content === "string") {
          assistantText += content;
        }
      } catch {
        // Ignore parse issues and forward the raw line.
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }
  appendDebugRecord({
    created_at: new Date().toISOString(),
    session_id: effectiveSessionId,
    messages: messages || [],
    assistant_response: assistantText,
    debug_payload: debugPayload,
  });
  res.end();
}

function buildDebugSessionSummaries() {
  const records = readDebugRecords();
  const grouped = new Map();

  for (const record of records) {
    const sessionId = String(record.session_id || "");
    if (!sessionId) continue;
    const existing = grouped.get(sessionId) || [];
    existing.push(record);
    grouped.set(sessionId, existing);
  }

  return [...grouped.entries()]
    .map(([sessionId, sessionRecords]) => {
      const sorted = [...sessionRecords].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        session_id: sessionId,
        source: "local",
        turn_count: sorted.length,
        session_start: first?.created_at || null,
        session_end: last?.created_at || null,
        preview: String(first?.messages?.find((message) => message?.role === "user")?.content || "New conversation").slice(0, 160),
        last_activity_at: last?.created_at || null,
      };
    })
    .sort((a, b) => new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime());
}

function buildDebugSessionDetail(sessionId) {
  const records = readDebugRecords().filter((record) => String(record.session_id || "") === sessionId);
  const sorted = [...records].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  if (sorted.length === 0) {
    return null;
  }

  return {
    session: {
      id: sessionId,
      source: "local",
      total_messages: sorted.length * 2,
      session_start: sorted[0].created_at || null,
      session_end: sorted[sorted.length - 1].created_at || null,
      is_active: false,
      metadata: null,
    },
    logs: sorted.map((record, index) => ({
      id: `${sessionId}-${index}`,
      session_id: sessionId,
      created_at: record.created_at,
      user_message: String(record.messages?.find((message) => message?.role === "user")?.content || ""),
      ai_response: String(record.assistant_response || ""),
      provider: record.debug_payload?.provider || "nvidia",
      model: record.debug_payload?.model || ANSWER_MODEL,
      rag_context: record.debug_payload?.rag_context || null,
      retrieved_chunks: record.debug_payload?.retrieved_chunks || [],
      context_images: record.debug_payload?.context_images || [],
      debug_payload: record.debug_payload || {},
      user_id: null,
      response_time_ms: null,
      topic: null,
      confidence_score: null,
    })),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/functions/v1/chat") {
    handleChat(req, res).catch((error) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/functions/v1/debug/sessions") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ sessions: buildDebugSessionSummaries() }));
    return;
  }

  const sessionMatch = url.pathname.match(/^\/functions\/v1\/debug\/sessions\/([^/]+)$/);
  if (req.method === "GET" && sessionMatch) {
    const payload = buildDebugSessionDetail(decodeURIComponent(sessionMatch[1]));
    if (!payload) {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`Chat proxy running at http://${HOST}:${PORT}/functions/v1/chat`);
});
