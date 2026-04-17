#!/usr/bin/env node

const args = process.argv.slice(2);

function getArg(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function getEnvKey() {
  return process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY || process.env.NVIDIA_BUILD_API_KEY || "";
}

function normalizeWhitespace(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function compressRagChunk(chunkText, maxChars) {
  const lines = normalizeWhitespace(chunkText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const selectedLineIndexes = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("[IMAGE:")) continue;
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

  const orderedLines = [...selectedLineIndexes].sort((a, b) => a - b).map((lineIndex) => lines[lineIndex]);
  const compressedLines = [];
  let charCount = 0;
  for (const line of orderedLines) {
    const candidate = line.replace(/\s+/g, " ");
    const extra = compressedLines.length > 0 ? 1 : 0;
    if (charCount + candidate.length + extra > maxChars) break;
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

async function getRagContext(query) {
  const ragApiUrl = process.env.RAG_API_URL || "http://127.0.0.1:8080";
  const params = new URLSearchParams({
    q: query,
    limit: "20",
    min_matches: "1",
  });

  try {
    const response = await fetch(`${ragApiUrl}/api/search?${params}`);
    if (!response.ok) {
      console.warn(`RAG search failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return null;

    const imageResults = results.filter((result) => typeof result?.text === "string" && result.text.includes("[IMAGE:"));
    const prioritizedResults = (imageResults.length > 0 ? imageResults : results).slice(0, 3);
    if (prioritizedResults.length === 0) return null;

    const contextBlocks = prioritizedResults.map((result, index) => {
      const originalFilename = String(result.original_filename || "unknown");
      const chunkIndex = String(result.chunk_index || index + 1);
      const pageStart = String(result.page_start || "?");
      const pageEnd = String(result.page_end || "?");
      const compressedText = compressRagChunk(String(result.text || ""), 550);

      return [
        `Result ${index + 1}: ${originalFilename} | chunk ${chunkIndex} | pages ${pageStart}-${pageEnd}`,
        compressedText,
      ].filter(Boolean).join("\n");
    });

    return [
      "RAG context below is OCR/image-derived evidence.",
      ...contextBlocks,
    ].join("\n\n");
  } catch (error) {
    console.warn(`RAG context unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function main() {
  const provider = getArg("provider", "nvidia");
  const model = getArg("model", "meta/llama-3.1-70b-instruct");
  const message = getArg("message", "Hi");

  if (provider !== "nvidia") {
    throw new Error("This local runner currently only validates the NVIDIA path.");
  }

  const apiKey = getEnvKey();
  if (!apiKey) {
    throw new Error("Set NVIDIA_API_KEY, NGC_API_KEY, or NVIDIA_BUILD_API_KEY in your shell.");
  }

  const ragContext = await getRagContext(message);
  const systemPrompt = ragContext
    ? `You are a helpful AI troubleshooting assistant.\n\n${ragContext}`
    : "You are a helpful AI troubleshooting assistant.";

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0,
      max_tokens: 128,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(text);
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(text);
  const output = parsed?.choices?.[0]?.message?.content ?? "";
  console.log(output);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
