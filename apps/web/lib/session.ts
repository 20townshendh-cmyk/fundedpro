import { SignJWT, jwtVerify } from "jose";
import { getWebEnv } from "./env";

const SESSION_COOKIE = "fundedpro_session";

function getSecret() {
  return new TextEncoder().encode(getWebEnv().nextAuthSecret);
}

export type SessionPayload = {
  userId: string;
  role: "TRADER" | "ADMIN";
  email: string;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify<SessionPayload>(token, getSecret());
  return result.payload;
}

export { SESSION_COOKIE };
