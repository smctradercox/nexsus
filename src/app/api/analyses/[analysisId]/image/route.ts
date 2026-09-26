import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { signChartImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { analysisId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const [analysis] = await getDb().select({ imageUrl: analyses.imageUrl, userId: analyses.userId }).from(analyses)
      .where(eq(analyses.id, params.analysisId)).limit(1);
    if (!analysis || (analysis.userId !== user.id && !user.isAdmin)) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const signedUrl = await signChartImage(analysis.imageUrl);
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("Chart image access failed", error);
    return NextResponse.json({ error: "Chart image is temporarily unavailable." }, { status: 503 });
  }
}