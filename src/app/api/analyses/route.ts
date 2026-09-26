import { randomUUID } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

const prompt = `Analyze only what is clearly visible in this trading chart image. Assess support and resistance, market structure, liquidity, trendlines, and candlestick patterns. Never invent prices or claim certainty when labels are unreadable. Return only JSON matching this shape: {"marketBias":"Bullish|Bearish|Neutral","supportLevels":["visible level"],"resistanceLevels":["visible level"],"entryZone":null,"stopLoss":null,"takeProfit":[],"technicalSummary":"...","strategyAdvice":"..."}. Use null for an unclear entry or stop; use empty arrays when levels cannot be read. This is educational chart analysis, not financial advice.`;

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
      .orderBy(desc(analyses.createdAt)).limit(20);

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI analysis is not configured yet." }, { status: 503 });

    const form = await request.formData();
    const chart = form.get("chart");
    if (!(chart instanceof File) || chart.size === 0) {
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
    if (dailyCount.value >= 20) {
      return NextResponse.json({ error: "Daily analysis limit reached. Try again tomorrow." }, { status: 429 });
    }

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const generated = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: chart.type, data: image.toString("base64") } },
    ]);
    const parsedResult = responseSchema.safeParse(JSON.parse(generated.response.text()));
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