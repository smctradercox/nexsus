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

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username) || !/^\d{6}$/.test(password)) {
      return NextResponse.json({ error: "Username must be 3-32 letters, numbers, or underscores, and password must be 6 digits." }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "Username is already in use." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({ username, passwordHash }).returning({ id: users.id });
    await createSession(user.id);
    return NextResponse.json({ ok: true }, { status: 201 });

  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Registration service is temporarily unavailable." }, { status: 503 });
  }
}
