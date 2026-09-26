import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Authentication service is temporarily unavailable." }, { status: 503 });
  }
}
