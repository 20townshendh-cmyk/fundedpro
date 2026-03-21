import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@fundedpro/db";
import { getWebEnv } from "../../../../lib/env";
import { getStripeClient } from "../../../../lib/stripe";
import { finalizePaidOrder } from "../../../../lib/trader";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const env = getWebEnv();

  if (!stripe || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: "stripe-not-configured" }, { status: 400 });
  }

  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing-signature" }, { status: 400 });
  }

  const body = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const orderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : null;
      const userId = typeof session.metadata?.userId === "string" ? session.metadata.userId : null;

      if (orderId && userId) {
        await finalizePaidOrder({
          db: getDb(),
          orderId,
          actorUserId: userId
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe-webhook-error", error);
    return NextResponse.json({ error: "invalid-webhook" }, { status: 400 });
  }
}
