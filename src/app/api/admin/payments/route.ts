import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { payments, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!admin.isAdmin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const queue = await getDb().select({
      id: payments.id,
      username: users.username,
      receiptFileId: payments.receiptUrl,
      status: payments.status,
      createdAt: payments.createdAt,
    }).from(payments).innerJoin(users, eq(payments.userId, users.id))
      .where(eq(payments.status, "pending")).orderBy(asc(payments.createdAt)).limit(100);

    return NextResponse.json({ payments: queue });
  } catch (error) {
    console.error("Admin payment queue failed", error);
    return NextResponse.json({ error: "Admin service is temporarily unavailable." }, { status: 503 });
  }
}