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

function normalizeWhitespace(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
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
  if (!query.trim() || isGreetingOnlyQuery(query)) return null;

  try {
    const response = await fetch(
      `${RAG_API_URL}/api/search?` +
        new URLSearchParams({
          q: query,
          limit: "20",
          min_matches: "1",
        }).toString()
    );
    if (!response.ok) return null;

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return null;

    const scoredResults = results
      .map((result) => ({
        ...result,
        score:
          (Array.isArray(result?.matched_terms) ? result.matched_terms.length : 0) * 10 +
          (typeof result?.text === "string" && result.text.includes("[IMAGE:") ? 50 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const prioritized = scoredResults.slice(0, MAX_CONTEXT_RESULTS);
    if (prioritized.length === 0) return null;

    const contextParts = [];
    let totalChars = 0;

    for (let index = 0; index < prioritized.length; index += 1) {
      const result = prioritized[index];
      const header = `Result ${index + 1}: ${String(result.original_filename || "unknown")} | chunk ${String(result.chunk_index || index + 1)} | pages ${String(result.page_start || "?")}-${String(result.page_end || "?")}`;
      const matchedTerms = Array.isArray(result.matched_terms) ? result.matched_terms.join(", ") : "";
      const imagePaths = extractImagePaths(String(result.text || ""));
      const hasImages = imagePaths.length > 0;
      const visualSummary = hasImages ? await summarizeChunkWithVision(NVIDIA_API_KEY, result) : "";
      const compressedText = compressRagChunk(String(result.text || ""), CHUNK_CHAR_LIMIT);
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

    return [
      "RAG context below is OCR/image-derived evidence. Use image summaries before text summaries when they conflict.",
      "Prioritize diagrams, charts, screenshots, and flow structure over generic text.",
      ...contextParts,
    ].join("\n\n");
  } catch {
    return null;
  }
}

async function handleChat(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;

  const { messages, temperature, max_tokens, model, provider } = JSON.parse(body || "{}");
  const selectedProvider = String(provider || "nvidia").toLowerCase();
  const latestUserMessage = [...(messages || [])].reverse().find((message) => message?.role === "user" && message.content?.trim())?.content?.trim() || "";

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
  const ragContext = await buildRagContext(latestUserMessage);
  const augmentedSystemPrompt = ragContext ? `${systemPrompt}\n\n${ragContext}` : systemPrompt;

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
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value, { stream: true }));
  }
  res.end();
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`Chat proxy running at http://${HOST}:${PORT}/functions/v1/chat`);
});
