import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedSummons {
  title: string;
  month: string;
  content: string;
}

function extractTextFromPDF(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const textChunks: string[] = [];

  // Extract text from BT...ET blocks (standard PDF text objects)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];

    // Match Tj, TJ, ' and " operators
    // Tj: (text)Tj
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(block)) !== null) {
      textChunks.push(decodePDFString(m[1]));
    }

    // TJ: [(text) num (text)]TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(block)) !== null) {
      const inner = m[1];
      const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let sm;
      while ((sm = strRegex.exec(inner)) !== null) {
        textChunks.push(decodePDFString(sm[1]));
      }
    }

    // ' operator: (text)'
    const apostropheRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*'/g;
    while ((m = apostropheRegex.exec(block)) !== null) {
      textChunks.push(decodePDFString(m[1]));
    }
  }

  // Also try to extract from stream objects for compressed content
  // Look for plain text strings outside BT/ET that might be in uncompressed streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    const streamContent = streamMatch[1];
    // Only process if it looks like it contains text operators
    if (streamContent.includes("Tj") || streamContent.includes("TJ")) {
      const tjR = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
      let sm;
      while ((sm = tjR.exec(streamContent)) !== null) {
        textChunks.push(decodePDFString(sm[1]));
      }
    }
  }

  const joined = textChunks
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return joined;
}

function decodePDFString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

function parseContent(text: string): ParsedSummons {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const monthPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i;

  let title = "";
  let month = "";

  // Find month anywhere in first 30 lines
  for (const line of lines.slice(0, 30)) {
    const m = line.match(monthPattern);
    if (m && !month) {
      month = m[0].replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  if (!month) {
    const m = text.match(monthPattern);
    if (m) month = m[0].replace(/\b\w/g, c => c.toUpperCase());
  }

  if (!month) {
    const now = new Date();
    month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  // Pick a reasonable title from early lines
  for (const line of lines.slice(0, 15)) {
    if (line.length > 4 && line.length < 140 && !line.match(/^(dear|to:|from:|\d+$)/i)) {
      title = line;
      break;
    }
  }

  if (!title) title = `Summons — ${month}`;

  const content = lines.join("\n").trim();
  return { title, month, content };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let rawText = "";
    let isPDF = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileName = file.name.toLowerCase();
      const buffer = await file.arrayBuffer();

      if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
        isPDF = true;
        rawText = extractTextFromPDF(buffer);
      } else {
        rawText = new TextDecoder().decode(buffer);
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.text) {
        rawText = body.text;
      } else if (body.storagePath) {
        const { data, error } = await supabase.storage
          .from("summons-uploads")
          .download(body.storagePath);

        if (error || !data) {
          return new Response(JSON.stringify({ error: "File not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const arrBuf = await data.arrayBuffer();
        const fileName = body.storagePath.toLowerCase();
        if (fileName.endsWith(".pdf")) {
          isPDF = true;
          rawText = extractTextFromPDF(arrBuf);
        } else {
          rawText = new TextDecoder().decode(arrBuf);
        }
      }
    }

    if (!rawText || !rawText.trim()) {
      const errorMsg = isPDF
        ? "Could not extract text from this PDF. It may use compressed streams or be image-based. Please use the manual entry option."
        : "No text content found in the uploaded file.";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseContent(rawText);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-summons error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
