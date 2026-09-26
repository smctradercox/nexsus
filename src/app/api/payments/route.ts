import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { payments, users } from "@/lib/db/schema";
import { hasSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

type TelegramPhotoResponse = {
  ok: boolean;
  description?: string;
  result?: { photo?: Array<{ file_id: string }> };
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to view payments." }, { status: 401 });

    const history = await getDb().select({
      id: payments.id,
      status: payments.status,
      createdAt: payments.createdAt,
      reviewedAt: payments.reviewedAt,
    }).from(payments).where(eq(payments.userId, user.id)).orderBy(desc(payments.createdAt)).limit(10);

    return NextResponse.json({ payments: history });
  } catch (error) {
    console.error("Payment history lookup failed", error);
    return NextResponse.json({ error: "Payment service is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before submitting a receipt." }, { status: 401 });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !adminChatId) {
    return NextResponse.json({ error: "Payment verification is not configured yet." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const receipt = form?.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return NextResponse.json({ error: "Choose a payment screenshot." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(receipt.type) || receipt.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: "Use a PNG or JPG image up to 4 MB." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [pending] = await db.select({ id: payments.id }).from(payments)
      .where(and(eq(payments.userId, user.id), eq(payments.status, "pending"))).limit(1);
    if (pending) return NextResponse.json({ error: "A receipt is already awaiting review." }, { status: 409 });

    const [payment] = await db.insert(payments).values({
      userId: user.id,
      receiptUrl: "telegram:uploading",
    }).returning({ id: payments.id });

    const uploadedAt = new Date();
    const formData = new FormData();
    formData.set("chat_id", adminChatId);
    formData.set("caption", [
      "NEXUS payment receipt",
      `User: ${user.username}`,
      "Amount: $80 USDT (TRC-20)",
      `Submitted: ${uploadedAt.toISOString()}`,
      `Review: ${new URL("/?view=admin", process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).toString()}`,
      `Payment ID: ${payment.id}`,
    ].join("\n"));
    formData.set("photo", new Blob([await receipt.arrayBuffer()], { type: receipt.type }), receipt.name);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    const telegram = await telegramResponse.json() as TelegramPhotoResponse;
    const telegramFileId = telegram.result?.photo?.at(-1)?.file_id;
    if (!telegramResponse.ok || !telegram.ok || !telegramFileId) {
      await db.delete(payments).where(eq(payments.id, payment.id));
      console.error("Telegram receipt delivery failed", telegram.description ?? telegramResponse.status);
      return NextResponse.json({ error: "Receipt delivery failed. Please try again." }, { status: 502 });
    }

    await db.update(payments).set({ receiptUrl: `telegram:${telegramFileId}` })
      .where(eq(payments.id, payment.id));
    await db.update(users).set({ subscriptionStatus: "pending" }).where(eq(users.id, user.id));

    return NextResponse.json({ payment: { id: payment.id, status: "pending" } }, { status: 201 });
  } catch (error) {
    console.error("Receipt submission failed", error);
    return NextResponse.json({ error: "Receipt submission is temporarily unavailable." }, { status: 503 });
  }
}