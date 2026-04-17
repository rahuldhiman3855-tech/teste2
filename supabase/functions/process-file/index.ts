import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { source_id } = await req.json();

    if (!source_id) {
      return new Response(
        JSON.stringify({ error: "source_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file source details
    const { data: fileSource, error: fileError } = await supabase
      .from("file_sources")
      .select("*")
      .eq("source_id", source_id)
      .single();

    if (fileError || !fileSource) {
      console.error("File source not found:", fileError);
      return new Response(
        JSON.stringify({ error: "File source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as running
    await supabase
      .from("knowledge_sources")
      .update({ status: "running", error_message: null })
      .eq("id", source_id);

    await supabase
      .from("file_sources")
      .update({ indexing_status: "running" })
      .eq("source_id", source_id);

    console.log(`Processing file: ${fileSource.file_name} (${fileSource.file_type})`);

    let extractedContent = "";

    try {
      // Download the file
      const fileUrl = fileSource.file_url;
      const fileResponse = await fetch(fileUrl);

      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }

      const fileType = fileSource.file_type.toLowerCase();

      if (["txt", "csv", "log", "md", "json", "xml", "yaml", "yml"].includes(fileType)) {
        // Text-based files: read directly
        extractedContent = await fileResponse.text();
      } else if (fileType === "pdf") {
        // PDF: extract text using basic parsing
        const arrayBuffer = await fileResponse.arrayBuffer();
        extractedContent = extractTextFromPdfBuffer(new Uint8Array(arrayBuffer));
      } else if (["docx", "doc"].includes(fileType)) {
        // DOCX: extract from XML inside zip
        const arrayBuffer = await fileResponse.arrayBuffer();
        extractedContent = await extractTextFromDocx(new Uint8Array(arrayBuffer));
      } else {
        // Unsupported format: store basic metadata
        extractedContent = `[File: ${fileSource.file_name}] (${fileSource.file_type.toUpperCase()}, ${fileSource.file_size} bytes) - Content extraction not supported for this file type. The file is available at: ${fileSource.file_url}`;
      }

      // Truncate if very large (max ~500KB of text)
      const MAX_CONTENT_LENGTH = 500000;
      if (extractedContent.length > MAX_CONTENT_LENGTH) {
        extractedContent = extractedContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]";
      }

      // Update with extracted content and mark as completed
      await supabase
        .from("file_sources")
        .update({
          content_extracted: extractedContent,
          indexing_status: "completed",
        })
        .eq("source_id", source_id);

      await supabase
        .from("knowledge_sources")
        .update({
          status: "completed",
          last_indexed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", source_id);

      // Log audit
      await supabase.from("source_audit_logs").insert({
        source_id,
        action: "indexing_completed",
        details: {
          file_name: fileSource.file_name,
          content_length: extractedContent.length,
          file_type: fileSource.file_type,
        },
      });

      console.log(`Successfully processed ${fileSource.file_name}: ${extractedContent.length} chars extracted`);

      return new Response(
        JSON.stringify({
          success: true,
          content_length: extractedContent.length,
          file_name: fileSource.file_name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processingError) {
      const errorMessage = processingError instanceof Error ? processingError.message : "Unknown processing error";
      console.error(`Processing error for ${fileSource.file_name}:`, errorMessage);

      // Mark as failed
      await supabase
        .from("file_sources")
        .update({ indexing_status: "failed" })
        .eq("source_id", source_id);

      await supabase
        .from("knowledge_sources")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", source_id);

      await supabase.from("source_audit_logs").insert({
        source_id,
        action: "indexing_failed",
        details: { error: errorMessage, file_name: fileSource.file_name },
      });

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Process file function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Basic PDF text extraction.
 * Handles simple text streams by looking for text operators (Tj, TJ, ').
 */
function extractTextFromPdfBuffer(data: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(data);
  const extractedParts: string[] = [];

  // Find all stream...endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const streamContent = match[1];

    // Look for text between BT and ET markers
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let textMatch;

    while ((textMatch = btEtRegex.exec(streamContent)) !== null) {
      const textBlock = textMatch[1];

      // Extract text from Tj operator: (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(textBlock)) !== null) {
        extractedParts.push(decodePdfString(tjMatch[1]));
      }

      // Extract text from TJ operator: [(text) num (text)] TJ
      const tjArrayRegex = /\[((?:\([^)]*\)|[^])*?)\]\s*TJ/g;
      let tjArrMatch;
      while ((tjArrMatch = tjArrayRegex.exec(textBlock)) !== null) {
        const arrayContent = tjArrMatch[1];
        const innerRegex = /\(([^)]*)\)/g;
        let innerMatch;
        const parts: string[] = [];
        while ((innerMatch = innerRegex.exec(arrayContent)) !== null) {
          parts.push(decodePdfString(innerMatch[1]));
        }
        extractedParts.push(parts.join(""));
      }

      // Extract text from ' operator: (text) '
      const quoteRegex = /\(([^)]*)\)\s*'/g;
      let quoteMatch;
      while ((quoteMatch = quoteRegex.exec(textBlock)) !== null) {
        extractedParts.push(decodePdfString(quoteMatch[1]));
      }
    }
  }

  if (extractedParts.length === 0) {
    return "[PDF file - text extraction returned no content. The PDF may contain scanned images or use complex encoding.]";
  }

  return extractedParts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Basic DOCX text extraction.
 * DOCX files are ZIP archives containing XML. We look for word/document.xml
 * and extract text from <w:t> elements.
 */
async function extractTextFromDocx(data: Uint8Array): Promise<string> {
  const documentXml = await findFileInZip(data, "word/document.xml");

  if (!documentXml) {
    return "[DOCX file - could not find document.xml in archive]";
  }

  const xmlText = new TextDecoder().decode(documentXml);

  // Extract text from <w:t> tags
  const textParts: string[] = [];
  const paragraphRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
  let paraMatch;

  while ((paraMatch = paragraphRegex.exec(xmlText)) !== null) {
    const paraContent = paraMatch[1];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    const paraTexts: string[] = [];

    while ((tMatch = textRegex.exec(paraContent)) !== null) {
      paraTexts.push(tMatch[1]);
    }

    if (paraTexts.length > 0) {
      textParts.push(paraTexts.join(""));
    }
  }

  if (textParts.length === 0) {
    return "[DOCX file - no text content found]";
  }

  return textParts.join("\n").trim();
}

/**
 * Minimal ZIP file parser to extract a single file by name.
 * Only handles uncompressed (stored) entries and deflate.
 */
async function findFileInZip(data: Uint8Array, targetFile: string): Promise<Uint8Array | null> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length - 4) {
    const sig = view.getUint32(offset, true);

    if (sig !== 0x04034b50) break; // Not a local file header

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = data.slice(offset + 30, offset + 30 + nameLen);
    const fileName = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;

    if (fileName === targetFile) {
      const fileData = data.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        // Stored (uncompressed)
        return fileData;
      } else if (compressionMethod === 8) {
        // Deflate
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();

          const chunks: Uint8Array[] = [];
          writer.write(fileData);
          writer.close();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
          const result = new Uint8Array(totalLen);
          let pos = 0;
          for (const chunk of chunks) {
            result.set(chunk, pos);
            pos += chunk.length;
          }
          return result;
        } catch {
          return null;
        }
      }

      return null;
    }

    offset = dataStart + compressedSize;
  }

  return null;
}