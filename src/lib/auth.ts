import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const SESSION_COOKIE = "nexus_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionKey());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const [user] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) return null;

    const subscriptionValid =
      user.isActive &&
      user.subscriptionExpiresAt !== null &&
      user.subscriptionExpiresAt.getTime() > Date.now();

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      isActive: subscriptionValid,
      subscriptionStatus: subscriptionValid
        ? "active"
        : user.subscriptionStatus === "pending"
          ? "pending"
          : user.isActive
            ? "expired"
            : "inactive",
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
    };
  } catch {
    return null;
  }
}