import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getWebEnv } from "./env";

const ALGORITHM = "aes-256-gcm";

function getCredentialKey() {
  const secret = getWebEnv().tradingCredentialSecret;

  return createHash("sha256").update(secret).digest();
}

export function encryptTradingPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getCredentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptTradingPassword(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  try {
    const buffer = Buffer.from(payload, "base64");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv(ALGORITHM, getCredentialKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return payload;
  }
}
