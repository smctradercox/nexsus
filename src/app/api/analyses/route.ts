import { randomUUID } from "node:crypto";
import dns from "node:dns";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { hasSameOrigin } from "@/lib/http";
import { removeChartImage, storeChartImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

dns.setDefaultResultOrder("ipv4first");

const MAX_CHART_BYTES = 4 * 1024 * 1024;
const chartTypes = new Set(["image/jpeg", "image/png"]);
const responseSchema = z.object({
  marketBias: z.enum(["Bullish", "Bearish", "Neutral"]),
  supportLevels: z.array(z.string()).max(6),
  resistanceLevels: z.array(z.string()).max(6),
  entryZone: z.string().nullable(),
  stopLoss: z.string().nullable(),
  takeProfit: z.array(z.string()).max(5),
  technicalSummary: z.string().min(1).max(1600),
  strategyAdvice: z.string().min(1).max(1600),
});

const prompt = `You are an expert ICT, Smart Money Concepts (SMC), and Price Action technical analyst. Analyze only what is clearly visible in this trading chart image. Guidelines: 1. Strategy Integration: Analyze market structure (BOS, CHoCH), Order Blocks (OB), Fair Value Gaps (FVG), Liquidity Sweeps (BSL/SSL), Support & Resistance, and Candlestick Price Action patterns. 2. Fixed Risk-to-Reward (1:3): Calculate Stop Loss (SL) based on invalidation structures (above/below Order Block or Swing High/Low). Take Profit (TP) MUST be calculated to ensure a strict 1:3 Risk-to-Reward Ratio (TP distance = 3x SL distance). 3. Precision: Never invent prices. If labels/levels are unreadable, set entryZone or stopLoss to null and takeProfit to empty array. 4. Language Requirement: Write technicalSummary and strategyAdvice strictly in clear, professional Arabic using standard SMC/Price Action trading terminology (e.g., كسر هيكل, منطقة طلب, سحب سيولة, إدارة مخاطر). Return ONLY a JSON matching this exact shape: {"marketBias":"Bullish|Bearish|Neutral","supportLevels":["visible level"],"resistanceLevels":["visible level"],"entryZone":"exact price or zone","stopLoss":"exact SL price","takeProfit":["TP1 price (1:3 R:R)"],"technicalSummary":"SMC & Price Action structural analysis in Arabic","strategyAdvice":"Execution steps & 1:3 R:R risk management advice in Arabic"}. This is educational chart analysis, not financial advice.`;

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
const geminiModels = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"];
function isUploadedImage(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value === "object" &&
    typeof value.arrayBuffer === "function" && typeof value.size === "number" && typeof value.type === "string";
}

function hasImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to view analyses." }, { status: 401 });

    const history = await getDb().select({
      id: analyses.id,
      result: analyses.aiResponseJson,
      createdAt: analyses.createdAt,
    }).from(analyses).where(eq(analyses.userId, user.id))
      .orderBy(desc(analyses.createdAt)).limit(30);

    return NextResponse.json({ analyses: history });
  } catch (error) {
    console.error("Analysis history lookup failed", error);
    return NextResponse.json({ error: "Analysis history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to analyze charts." }, { status: 401 });
    if (!user.isActive) return NextResponse.json({ error: "An active subscription is required." }, { status: 403 });

    const apiKey = process.env.GEMINI_API_KEY?.trim().replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "");
    if (!apiKey) return NextResponse.json({ error: "AI analysis is not configured yet." }, { status: 503 });

    const form = await request.formData();
    const chart = form.get("chart");
    if (!isUploadedImage(chart) || chart.size === 0) {
      return NextResponse.json({ error: "Choose a chart screenshot." }, { status: 400 });
    }
    if (!chartTypes.has(chart.type) || chart.size > MAX_CHART_BYTES) {
      return NextResponse.json({ error: "Use a PNG or JPG image up to 4 MB." }, { status: 400 });
    }

    const image = Buffer.from(await chart.arrayBuffer());
    if (!hasImageSignature(image, chart.type)) {
      return NextResponse.json({ error: "The uploaded file is not a valid PNG or JPG image." }, { status: 400 });
    }

    const db = getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dailyCount] = await db.select({ value: count() }).from(analyses)
      .where(and(eq(analyses.userId, user.id), gte(analyses.createdAt, since)));
    if (dailyCount.value >= 30) {
      return NextResponse.json({ error: "Daily analysis limit reached (30/30). Try again tomorrow." }, { status: 429 });
    }

    let generatedText = "";
    let lastGeminiError = "";
    for (const model of geminiModels) {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: chart.type, data: image.toString("base64") } },
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        cache: "no-store",
      });
      const geminiData = await geminiResponse.json() as GeminiResponse;
      if (geminiResponse.ok) {
        generatedText = geminiData.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
        if (generatedText) break;
      }
      lastGeminiError = `${geminiResponse.status} ${geminiData.error?.message ?? "unknown error"}`;
      if (geminiResponse.status !== 429 && geminiResponse.status !== 500 && geminiResponse.status !== 503) break;
    }
    if (!generatedText) {
      console.error("Gemini request failed across fallback models", lastGeminiError);
      return NextResponse.json({ error: "The AI provider is temporarily busy. Please retry in a moment." }, { status: 502 });
    }
    const jsonText = generatedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsedResult = responseSchema.safeParse(JSON.parse(jsonText));
    if (!parsedResult.success) {
      return NextResponse.json({ error: "The AI returned an unreadable analysis. Please retry with a clearer chart." }, { status: 502 });
    }

    const imageKey = `charts/${user.id}/${randomUUID()}.${chart.type === "image/png" ? "png" : "jpg"}`;
    await storeChartImage(imageKey, image, chart.type);
    try {
      const [analysis] = await db.insert(analyses).values({
        userId: user.id,
        imageUrl: imageKey,
        aiResponseJson: parsedResult.data,
      }).returning({ id: analyses.id, createdAt: analyses.createdAt });
      return NextResponse.json({ analysis: { ...analysis, result: parsedResult.data } }, { status: 201 });
    } catch (error) {
      await removeChartImage(imageKey).catch((cleanupError) => console.error("Chart cleanup failed", cleanupError));
      throw error;
    }
  } catch (error) {
    console.error("Chart analysis failed", error);
    return NextResponse.json({ error: "Chart analysis is temporarily unavailable." }, { status: 502 });
  }
}