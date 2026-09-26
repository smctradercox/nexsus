import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { payments, users } from "@/lib/db/schema";
import { hasSameOrigin } from "@/lib/http";

const decisionSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function PATCH(request: Request, { params }: { params: { paymentId: string } }) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });

  try {
    const result = await getDb().transaction(async (tx) => {
      const [payment] = await tx.select().from(payments)
        .where(eq(payments.id, params.paymentId)).for("update").limit(1);
      if (!payment) return { error: "Payment not found.", statusCode: 404 } as const;
      if (payment.status !== "pending") return { error: "Payment has already been reviewed.", statusCode: 409 } as const;

      const now = new Date();
      await tx.update(payments).set({ status: parsed.data.status, reviewedAt: now })
        .where(eq(payments.id, payment.id));

      if (parsed.data.status === "approved") {
        await tx.update(users).set({
          isActive: true,
          subscriptionStatus: "active",
          subscriptionExpiresAt: sql`GREATEST(COALESCE(${users.subscriptionExpiresAt}, ${now}), ${now}) + INTERVAL '30 days'`,
        }).where(eq(users.id, payment.userId));
      } else {
        await tx.update(users).set({ subscriptionStatus: "inactive" })
          .where(eq(users.id, payment.userId));
      }

      return { paymentId: payment.id, status: parsed.data.status } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.statusCode });
    return NextResponse.json({ payment: result });
  } catch (error) {
    console.error("Payment review failed", error);
    return NextResponse.json({ error: "Payment review is temporarily unavailable." }, { status: 503 });
  }
}