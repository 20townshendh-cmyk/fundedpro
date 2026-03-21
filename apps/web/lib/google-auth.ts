import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getWebEnv } from "./env";

const GOOGLE_STATE_COOKIE = "fundedpro_google_state";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

type GoogleTokenResponse = {
  access_token: string;
  id_token: string;
};

type GoogleIdTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function beginGoogleAuth() {
  const env = getWebEnv();

  if (!env.googleClientId || !env.googleClientSecret) {
    return null;
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: 60 * 10
  });

  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: `${env.appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function verifyGoogleCallback(input: { code: string; state: string }) {
  const env = getWebEnv();
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (!env.googleClientId || !env.googleClientSecret || !expectedState || expectedState !== input.state) {
    return null;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: `${env.appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return null;
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokens.id_token) {
    return null;
  }

  const verified = await jwtVerify<GoogleIdTokenPayload>(tokens.id_token, GOOGLE_JWKS, {
    issuer: "https://accounts.google.com",
    audience: env.googleClientId
  });

  const payload = verified.payload;

  if (!payload.sub || !payload.email || !payload.email_verified) {
    return null;
  }

  return {
    googleSubject: payload.sub,
    email: payload.email.toLowerCase(),
    fullName: payload.name?.trim() || payload.email.split("@")[0]
  };
}
