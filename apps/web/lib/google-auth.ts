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

function buildGoogleRedirectUri(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}

export async function beginGoogleAuth(baseUrl?: string) {
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
    redirect_uri: buildGoogleRedirectUri(baseUrl || env.appUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function verifyGoogleCallback(input: { code: string; state: string }, baseUrl?: string) {
  const env = getWebEnv();
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (!env.googleClientId || !env.googleClientSecret || !expectedState || expectedState !== input.state) {
    console.error("google-callback-invalid-state-or-config", {
      hasClientId: !!env.googleClientId,
      hasClientSecret: !!env.googleClientSecret,
      hasExpectedState: !!expectedState,
      stateMatches: expectedState === input.state,
      appUrl: env.appUrl,
      baseUrl
    });
    return null;
  }

  const redirectUri = buildGoogleRedirectUri(baseUrl || env.appUrl);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => "");
    console.error("google-token-exchange-failed", {
      status: tokenResponse.status,
      redirectUri,
      body: errorBody
    });
    return null;
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokens.id_token) {
    console.error("google-token-missing-id-token", { redirectUri });
    return null;
  }

  let verified;

  try {
    verified = await jwtVerify<GoogleIdTokenPayload>(tokens.id_token, GOOGLE_JWKS, {
      issuer: "https://accounts.google.com",
      audience: env.googleClientId
    });
  } catch (error) {
    console.error("google-id-token-verify-failed", error);
    return null;
  }

  const payload = verified.payload;

  if (!payload.sub || !payload.email || !payload.email_verified) {
    console.error("google-id-token-missing-required-fields", {
      hasSub: !!payload.sub,
      hasEmail: !!payload.email,
      emailVerified: payload.email_verified ?? false
    });
    return null;
  }

  return {
    googleSubject: payload.sub,
    email: payload.email.toLowerCase(),
    fullName: payload.name?.trim() || payload.email.split("@")[0]
  };
}
