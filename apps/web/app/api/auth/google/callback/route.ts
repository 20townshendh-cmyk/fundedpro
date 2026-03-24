import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@fundedpro/db";
import { getDb } from "@fundedpro/db";
import { setSession } from "../../../../../lib/auth";
import { sendWelcomeEmail } from "../../../../../lib/email/service";
import { verifyGoogleCallback } from "../../../../../lib/google-auth";

function isMissingGoogleSubjectColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('column "googleSubject" does not exist');
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
    }

    const googleUser = await verifyGoogleCallback({ code, state });

    if (!googleUser) {
      return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
    }

    const db = getDb();
    let createdNewUser = false;
    let result;

    try {
      result = await db.query<{ id: string; email: string; role: Role }>(
        `
          SELECT "id", "email", "role"
          FROM "User"
          WHERE "googleSubject" = $1 OR "email" = $2
          LIMIT 1;
        `,
        [googleUser.googleSubject, googleUser.email]
      );
    } catch (error) {
      if (!isMissingGoogleSubjectColumn(error)) {
        throw error;
      }

      result = await db.query<{ id: string; email: string; role: Role }>(
        `
          SELECT "id", "email", "role"
          FROM "User"
          WHERE "email" = $1
          LIMIT 1;
        `,
        [googleUser.email]
      );
    }

    let user = result.rows[0];

    if (!user) {
      const passwordHash = await hash(randomUUID(), 10);

      try {
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
      } catch (error) {
        if (!isMissingGoogleSubjectColumn(error)) {
          throw error;
        }

        result = await db.query<{ id: string; email: string; role: Role }>(
          `
            INSERT INTO "User" (
              "id", "email", "fullName", "passwordHash",
              "emailVerifiedAt", "role", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, NOW(), 'TRADER', NOW(), NOW())
            RETURNING "id", "email", "role";
          `,
          [randomUUID(), googleUser.email, googleUser.fullName, passwordHash]
        );
      }

      user = result.rows[0];
      createdNewUser = true;
    } else {
      try {
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
      } catch (error) {
        if (!isMissingGoogleSubjectColumn(error)) {
          throw error;
        }

        await db.query(
          `
            UPDATE "User"
            SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()),
                "updatedAt" = NOW()
            WHERE "id" = $1;
          `,
          [user.id]
        );
      }
    }

    if (!user) {
      return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
    }

    if (createdNewUser) {
      const welcomeName = googleUser.fullName || googleUser.email.split("@")[0] || "Trader";

      try {
        await sendWelcomeEmail({
          to: googleUser.email,
          fullName: welcomeName
        });
      } catch (error) {
        console.error("google-welcome-email-failed", { email: googleUser.email, error });
      }
    }

    await setSession(user);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("google-callback-failed", error);
    return NextResponse.redirect(new URL("/signup?error=google-failed", request.url));
  }
}
