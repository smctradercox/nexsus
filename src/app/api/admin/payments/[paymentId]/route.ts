import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { payments, users } from "@/lib/db/schema";
import { hasSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> | { paymentId: string } }
) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const admin = await getCurrentUser();
  if (!admin) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }

  // دعم Next.js 14 و 15 لفك params
  const resolvedParams = await params;
  const paymentId = resolvedParams.paymentId;

  try {
    const db = getDb();

    // 1. جلب بيانات الدفعة
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Payment has already been reviewed." }, { status: 409 });
    }

    const now = new Date();

    // 2. تحديث حالة الدفعة
    await db
      .update(payments)
      .set({ status: parsed.data.status, reviewedAt: now })
      .where(eq(payments.id, payment.id));

    if (parsed.data.status === "approved") {
      // حساب 30 يوم من الآن لتجنب مشاكل SQL Type Casting
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await db
        .update(users)
        .set({
          isActive: true,
          subscriptionStatus: "active",
          subscriptionExpiresAt: expiresAt,
        })
        .where(eq(users.id, payment.userId));
    } else {
      await db
        .update(users)
        .set({
          isActive: false,
          subscriptionStatus: "inactive",
        })
        .where(eq(users.id, payment.userId));
    }

    return NextResponse.json({
      payment: { paymentId: payment.id, status: parsed.data.status },
    });
  } catch (error) {
    console.error("Payment review failed", error);
    return NextResponse.json(
      { error: "Payment review is temporarily unavailable." },
      { status: 500 }
    );
  }
}