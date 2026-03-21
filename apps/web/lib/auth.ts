"use server";

import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@fundedpro/db";
import { getDb } from "@fundedpro/db";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "./session";
import { ensureDemoTradingWorkspaceForUser } from "./demo-trading/bootstrap";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email/service";
import { getWebEnv } from "./env";

const EMAIL_VERIFICATION_WINDOW_MINUTES = 10;
const PASSWORD_RESET_WINDOW_MINUTES = 10;

const authSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  firstName: z.string().min(1).max(40).optional(),
  lastName: z.string().min(1).max(40).optional(),
  title: z.string().min(1).optional(),
  dateOfBirth: z.string().min(10).max(10).optional(),
  country: z.string().min(1).optional(),
  phoneCountry: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).max(24).optional(),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  confirmPassword: z.string().min(8).optional()
});

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  next: z.string().optional()
});

function getSafeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function isValidPhoneNumber(input: { phoneCountry: string | undefined; phoneNumber: string | undefined }) {
  if (!input.phoneCountry || !input.phoneNumber) {
    return false;
  }

  const match = input.phoneCountry.match(/^\w{2}:\+(\d{1,3})$/);

  if (!match) {
    return false;
  }

  const countryCode = match[1];
  const localDigits = input.phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
  const combinedDigits = `${countryCode}${localDigits}`;

  if (localDigits.length < 6 || localDigits.length > 12) {
    return false;
  }

  if (combinedDigits.length < 8 || combinedDigits.length > 15) {
    return false;
  }

  if (/^(\d)\1+$/.test(localDigits)) {
    return false;
  }

  return true;
}

function isAtLeast16(dateOfBirth: string | undefined) {
  if (!dateOfBirth) {
    return false;
  }

  const match = dateOfBirth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const birthDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getDate() !== day ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getFullYear() !== year
  ) {
    return false;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day);

  if (beforeBirthday) {
    age -= 1;
  }

  return age >= 18;
}

function db() {
  return getDb();
}

function buildSignupRedirect(error: string, formData: FormData): never {
  const params = new URLSearchParams({ error });
  const preservedFields = [
    "firstName",
    "lastName",
    "title",
    "dateOfBirth",
    "country",
    "email",
    "phoneCountry",
    "phoneNumber",
    "referralCode"
  ] as const;

  for (const field of preservedFields) {
    const value = formData.get(field);
    if (typeof value === "string" && value.trim()) {
      params.set(field, value);
    }
  }

  redirect(`/signup?${params.toString()}`);
}

function buildSignupFieldRedirect(error: string, field: string, formData: FormData): never {
  const params = new URLSearchParams({ error, field });
  const preservedFields = [
    "firstName",
    "lastName",
    "title",
    "dateOfBirth",
    "country",
    "email",
    "phoneCountry",
    "phoneNumber",
    "referralCode"
  ] as const;

  for (const preservedField of preservedFields) {
    const value = formData.get(preservedField);
    if (typeof value === "string" && value.trim()) {
      params.set(preservedField, value);
    }
  }

  redirect(`/signup?${params.toString()}`);
}

export async function setSession(
  user: { id: string; email: string; role: Role },
  options?: { rememberMe?: boolean }
) {
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: options?.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24
  });
}

export async function signupAction(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const phoneCountry = String(formData.get("phoneCountry") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const rawEmail = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!firstName) buildSignupFieldRedirect("missing-field", "firstName", formData);
  if (!lastName) buildSignupFieldRedirect("missing-field", "lastName", formData);
  if (!title) buildSignupFieldRedirect("missing-field", "title", formData);
  if (!dateOfBirth) buildSignupFieldRedirect("missing-field", "dateOfBirth", formData);
  if (!country) buildSignupFieldRedirect("missing-field", "country", formData);
  if (!rawEmail) buildSignupFieldRedirect("missing-field", "email", formData);
  if (!phoneCountry) buildSignupFieldRedirect("missing-field", "phoneCountry", formData);
  if (!phoneNumber) buildSignupFieldRedirect("missing-field", "phoneNumber", formData);
  if (!password) buildSignupFieldRedirect("missing-field", "password", formData);
  if (!confirmPassword) buildSignupFieldRedirect("missing-field", "confirmPassword", formData);

  const emailCheck = z.email().safeParse(rawEmail);
  if (!emailCheck.success) buildSignupFieldRedirect("invalid-field", "email", formData);
  if (password.length < 8) buildSignupFieldRedirect("invalid-field", "password", formData);
  if (confirmPassword.length < 8) buildSignupFieldRedirect("invalid-field", "confirmPassword", formData);

  const email = emailCheck.data.toLowerCase();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!fullName) {
    buildSignupFieldRedirect("missing-field", "firstName", formData);
  }

  if (confirmPassword !== password) {
    buildSignupFieldRedirect("password-mismatch", "confirmPassword", formData);
  }

  if (!isAtLeast16(dateOfBirth)) {
    buildSignupFieldRedirect("under-18", "dateOfBirth", formData);
  }

  if (!isValidPhoneNumber({ phoneCountry, phoneNumber })) {
    buildSignupFieldRedirect("invalid-phone", "phoneNumber", formData);
  }

  const existingUser = await db().query<{
    id: string;
    emailVerifiedAt: string | null;
    emailVerificationSentAt: string | null;
  }>(
    'SELECT "id", "emailVerifiedAt", "emailVerificationSentAt" FROM "User" WHERE "email" = $1 LIMIT 1',
    [email]
  );

  const existingAccount = existingUser.rows[0];

  if (existingAccount) {
    const verificationSentAt = existingAccount.emailVerificationSentAt
      ? new Date(existingAccount.emailVerificationSentAt)
      : null;
    const expired =
      !existingAccount.emailVerifiedAt &&
      verificationSentAt &&
      Date.now() - verificationSentAt.getTime() > EMAIL_VERIFICATION_WINDOW_MINUTES * 60 * 1000;

    if (expired) {
      await db().query('DELETE FROM "User" WHERE "id" = $1', [existingAccount.id]);
    } else {
      buildSignupRedirect("email-exists", formData);
    }
  }

  const passwordHash = await hash(password, 10);
  const userId = randomUUID();
  const verificationToken = randomUUID();
  const result = await db().query<{ id: string; email: string; role: Role }>(
    `
      INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "emailVerificationToken", "emailVerificationSentAt", "role", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), 'TRADER', NOW(), NOW())
      RETURNING "id", "email", "role";
    `,
    [userId, email, fullName, passwordHash, verificationToken]
  );

  const createdUser = result.rows[0];

  if (!createdUser) {
    redirect("/signup?error=signup-failed");
  }

  try {
    await sendVerificationEmail({
      to: createdUser.email,
      fullName,
      verificationUrl: `${getWebEnv().appUrl}/verify-email?token=${verificationToken}`
    });
  } catch (error) {
    console.error("verification-email-failed", error);
  }

  await ensureDemoTradingWorkspaceForUser(createdUser.id);
  redirect(`/signup/check-email?email=${encodeURIComponent(createdUser.email)}`);
}

export async function resendVerificationEmailAction(formData: FormData) {
  const emailValue = String(formData.get("email") ?? "").trim();
  const emailCheck = z.email().safeParse(emailValue);

  if (!emailCheck.success) {
    redirect("/signup/check-email?error=invalid-email");
  }

  const email = emailCheck.data.toLowerCase();
  const result = await db().query<{
    id: string;
    email: string;
    fullName: string;
    emailVerifiedAt: string | null;
  }>(
    'SELECT "id", "email", "fullName", "emailVerifiedAt" FROM "User" WHERE "email" = $1 LIMIT 1',
    [email]
  );
  const user = result.rows[0];

  if (user && !user.emailVerifiedAt) {
    const verificationToken = randomUUID();

    await db().query(
      `
        UPDATE "User"
        SET "emailVerificationToken" = $1,
            "emailVerificationSentAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = $2
      `,
      [verificationToken, user.id]
    );

    try {
      await sendVerificationEmail({
        to: user.email,
        fullName: user.fullName,
        verificationUrl: `${getWebEnv().appUrl}/verify-email?token=${verificationToken}`
      });
    } catch (error) {
      console.error("verification-email-resend-failed", error);
    }
  }

  redirect(`/signup/check-email?resent=1&email=${encodeURIComponent(email)}`);
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined
  });
  const rememberMe = formData.get("rememberMe") === "on";

  if (!parsed.success) {
    redirect("/login?error=invalid-credentials");
  }

  const result = await db().query<{
    id: string;
    email: string;
    role: Role;
    passwordHash: string;
    emailVerifiedAt: string | null;
  }>('SELECT "id", "email", "role", "passwordHash", "emailVerifiedAt" FROM "User" WHERE "email" = $1 LIMIT 1', [
    parsed.data.email
  ]);

  const user = result.rows[0];

  if (!user) {
    redirect("/login?error=invalid-credentials");
  }

  const isValid = await compare(parsed.data.password, user.passwordHash);

  if (!isValid) {
    redirect("/login?error=invalid-credentials");
  }

  if (!user.emailVerifiedAt) {
    redirect("/login?error=verify-email");
  }

  await setSession(user, { rememberMe });
  redirect(getSafeNextPath(parsed.data.next));
}

export async function forgotPasswordAction(formData: FormData) {
  const emailValue = String(formData.get("email") ?? "").trim();
  const emailCheck = z.email().safeParse(emailValue);

  if (!emailCheck.success) {
    redirect("/forgot-password?error=invalid-email");
  }

  const email = emailCheck.data.toLowerCase();
  const result = await db().query<{ id: string; fullName: string; email: string }>(
    'SELECT "id", "fullName", "email" FROM "User" WHERE "email" = $1 LIMIT 1',
    [email]
  );
  const user = result.rows[0];

  if (user) {
    const resetToken = randomUUID();
    await db().query(
      `
        UPDATE "User"
        SET "passwordResetToken" = $1,
            "passwordResetSentAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = $2
      `,
      [resetToken, user.id]
    );

    try {
      await sendPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        resetUrl: `${getWebEnv().appUrl}/reset-password?token=${resetToken}`
      });
    } catch (error) {
      console.error("password-reset-email-failed", error);
    }
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    redirect("/forgot-password?error=invalid-reset");
  }

  if (password.length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password-too-short`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password-mismatch`);
  }

  const result = await db().query<{ id: string; passwordResetSentAt: string | null }>(
    'SELECT "id", "passwordResetSentAt" FROM "User" WHERE "passwordResetToken" = $1 LIMIT 1',
    [token]
  );
  const user = result.rows[0];

  if (!user || !user.passwordResetSentAt) {
    redirect("/forgot-password?error=invalid-reset");
  }

  const expired =
    Date.now() - new Date(user.passwordResetSentAt).getTime() >
    PASSWORD_RESET_WINDOW_MINUTES * 60 * 1000;

  if (expired) {
    await db().query(
      'UPDATE "User" SET "passwordResetToken" = NULL, "passwordResetSentAt" = NULL, "updatedAt" = NOW() WHERE "id" = $1',
      [user.id]
    );
    redirect("/forgot-password?error=expired-reset");
  }

  const passwordHash = await hash(password, 10);
  await db().query(
    `
      UPDATE "User"
      SET "passwordHash" = $1,
          "passwordResetToken" = NULL,
          "passwordResetSentAt" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = $2
    `,
    [passwordHash, user.id]
  );

  redirect("/login?reset=1");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
