#!/usr/bin/env node

const PROXY_URL = process.env.CHAT_PROXY_URL || "http://127.0.0.1:8787/functions/v1/chat";
const RAG_API_URL = process.env.RAG_API_URL || "http://127.0.0.1:8080";
const PROVIDER = "nvidia";
const MODEL = process.env.NVIDIA_ANSWER_MODEL || "meta/llama-3.1-70b-instruct";
const QUERIES = [
  "Describe the flow diagram in the document.",
  "Why does this process branch here?",
  "What do the arrows mean in this screenshot?",
  "Summarize the architecture diagram.",
  "What decision points are shown?",
  "Which step comes after the highlighted box?",
  "Explain the OCR text and flow together.",
  "What is this screen showing?",
  "How does this workflow proceed?",
  "Why is this done like this in the diagram?",
];

function normalizeWhitespace(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

async function searchRag(query) {
  const response = await fetch(
    `${RAG_API_URL}/api/search?` +
      new URLSearchParams({
        q: query,
        limit: "20",
        min_matches: "1",
      }).toString()
  );

  if (!response.ok) {
    return { results: [], error: `HTTP ${response.status}` };
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return { results, error: null };
}

function parseSseChatContent(rawText) {
  const events = rawText.split(/\n\n+/);
  const chunks = [];

  for (const event of events) {
    const lines = event.split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? "";
        if (delta) chunks.push(String(delta));
      } catch {
        // Ignore partial/non-JSON stream fragments.
      }
    }
  }

  return normalizeWhitespace(chunks.join(""));
}

async function askProxy(query) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: PROVIDER,
      model: MODEL,
      temperature: 0.2,
      max_tokens: 512,
      messages: [{ role: "user", content: query }],
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return { ok: false, answer: "", error: rawText || `HTTP ${response.status}` };
  }

  return { ok: true, answer: parseSseChatContent(rawText), error: null };
}

function scoreGrounding(answer, ragResults) {
  const imageHitCount = ragResults.filter((result) => typeof result?.text === "string" && result.text.includes("[IMAGE:")).length;
  const answerText = answer.toLowerCase();
  const visualSignals = ["diagram", "flow", "screenshot", "ocr", "image", "arrow", "box", "node", "decision", "label"];
  const visualSignalCount = visualSignals.filter((token) => answerText.includes(token)).length;

  let score = 0;
  if (imageHitCount > 0) score += 2;
  if (imageHitCount >= 3) score += 1;
  if (visualSignalCount >= 2) score += 1;
  if (visualSignalCount >= 4) score += 1;

  return {
    score,
    imageHitCount,
    visualSignalCount,
    grounded: score >= 3,
  };
}

async function main() {
  const rows = [];

  for (let index = 0; index < QUERIES.length; index += 1) {
    const query = QUERIES[index];
    const rag = await searchRag(query);
    const result = await askProxy(query);
    const topImageResults = rag.results
      .filter((item) => typeof item?.text === "string" && item.text.includes("[IMAGE:"))
      .slice(0, 3)
      .map((item) => String(item.original_filename || "unknown"));
    const score = scoreGrounding(result.answer, rag.results);

    rows.push({
      query,
      ragResults: rag.results.length,
      imageResults: score.imageHitCount,
      topImageFiles: topImageResults,
      answerOk: result.ok,
      answer: result.answer.slice(0, 260),
      grounded: score.grounded,
      groundingScore: score.score,
      visualSignals: score.visualSignalCount,
      error: rag.error || result.error || null,
    });
  }

  const groundedCount = rows.filter((row) => row.grounded).length;
  const imageCoveredCount = rows.filter((row) => row.imageResults > 0).length;

  console.log("# Local Image Grounding Report");
  console.log("");
  console.log(`Proxy: ${PROXY_URL}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Queries tested: ${rows.length}`);
  console.log(`Queries with image-bearing RAG hits: ${imageCoveredCount}/${rows.length}`);
  console.log(`Answers scored as image-grounded: ${groundedCount}/${rows.length}`);
  console.log("");
  console.log("| # | Query | Image hits | Grounded | Score | Answer excerpt |");
  console.log("|---|---|---:|---|---:|---|");
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const excerpt = row.answer.replace(/\|/g, "\\|");
    console.log(
      `| ${index + 1} | ${row.query.replace(/\|/g, "\\|")} | ${row.imageResults} | ${row.grounded ? "yes" : "no"} | ${row.groundingScore} | ${excerpt || "(empty)"} |`
    );
  }

  console.log("");
  console.log("## Notes");
  console.log("- `Grounded` is a heuristic score based on image-bearing retrieval plus visual language in the answer.");
  console.log("- The strongest signal is when the RAG hit set includes image chunks and the answer references diagram/flow/OCR details.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
