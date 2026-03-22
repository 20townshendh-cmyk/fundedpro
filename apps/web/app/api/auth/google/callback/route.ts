import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@fundedpro/db";
import { getDb } from "@fundedpro/db";
import { setSession } from "../../../../../lib/auth";
import { verifyGoogleCallback } from "../../../../../lib/google-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
  }

  const googleUser = await verifyGoogleCallback({ code, state }, request.nextUrl.origin);

  if (!googleUser) {
    return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
  }

  const db = getDb();
  let result = await db.query<{ id: string; email: string; role: Role }>(
    `
      SELECT "id", "email", "role"
      FROM "User"
      WHERE "googleSubject" = $1 OR "email" = $2
      LIMIT 1;
    `,
    [googleUser.googleSubject, googleUser.email]
  );

  let user = result.rows[0];

  if (!user) {
    const passwordHash = await hash(randomUUID(), 10);
    result = await db.query<{ id: string; email: string; role: Role }>(
      `
        INSERT INTO "User" (
          "id", "email", "googleSubject", "fullName", "passwordHash",
          "emailVerifiedAt", "role", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), 'TRADER', NOW(), NOW())
        RETURNING "id", "email", "role";
      `,
      [randomUUID(), googleUser.email, googleUser.googleSubject, googleUser.fullName, passwordHash]
    );

    user = result.rows[0];
  } else {
    await db.query(
      `
        UPDATE "User"
        SET "googleSubject" = COALESCE("googleSubject", $1),
            "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()),
            "updatedAt" = NOW()
        WHERE "id" = $2;
      `,
      [googleUser.googleSubject, user.id]
    );
  }

  if (!user) {
    return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
  }

  await setSession(user);
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
