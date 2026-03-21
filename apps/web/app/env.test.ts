import { afterEach, describe, expect, it, vi } from "vitest";
import { getWebEnv, resetWebEnvForTests } from "../lib/env";

describe("web env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetWebEnvForTests();
  });

  it("flags placeholder stripe values as not ready", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTAUTH_SECRET", "dev-secret");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_placeholder");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder");

    const env = getWebEnv();

    expect(env.hasRealStripe).toBe(false);
    expect(env.openAiApiKey).toBe(null);
  });

  it("flags real stripe values as ready", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTAUTH_SECRET", "dev-secret");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_real");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_real");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_real");

    const env = getWebEnv();

    expect(env.hasRealStripe).toBe(true);
  });

  it("requires a real session secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_SECRET", "change-me");

    expect(() => getWebEnv()).toThrow("NEXTAUTH_SECRET must be configured in production.");
  });
});
