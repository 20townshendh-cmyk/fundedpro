import Stripe from "stripe";
import { getWebEnv } from "./env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const env = getWebEnv();

  if (!env.stripeSecretKey || !env.hasRealStripe) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey, {
      apiVersion: "2026-02-25.clover"
    });
  }

  return stripeClient;
}
