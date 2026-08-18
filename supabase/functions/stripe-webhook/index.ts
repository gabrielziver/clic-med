import Stripe from "npm:stripe@18.5.0";
import { stripe, supabaseAdmin } from "../_shared/server.ts";

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function isoFromUnix(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function customerEmail(customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.email || null;
}

async function userIdByEmail(email: string | null | undefined) {
  if (!email) return null;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id || null;
}

async function syncSubscription(subscription: Stripe.Subscription, eventCreated: number, livemode: boolean, fallbackEmail?: string | null) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data: existing } = await supabaseAdmin
    .from("stripe_subscriptions")
    .select("user_id, email, stripe_customer_id, last_event_created")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (existing && Number(existing.last_event_created) > eventCreated) return;
  const userId = subscription.metadata?.supabase_user_id || existing?.user_id;
  const email = subscription.metadata?.email || existing?.email || fallbackEmail || await customerEmail(customerId);
  if (!email) throw new Error(`Missing email mapping for Stripe customer ${customerId}`);
  const resolvedUserId = userId || await userIdByEmail(String(email));

  const firstItem = subscription.items.data[0];
  const periodEnd = (firstItem as Stripe.SubscriptionItem & { current_period_end?: number }).current_period_end
    || (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
    || subscription.trial_end;

  const conflictTarget = existing?.stripe_customer_id ? "stripe_customer_id" : resolvedUserId ? "user_id" : "stripe_customer_id";
  const { error } = await supabaseAdmin.from("stripe_subscriptions").upsert({
    user_id: resolvedUserId,
    email: String(email).toLowerCase(),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: firstItem?.price?.id || null,
    livemode,
    status: subscription.status,
    current_period_end: isoFromUnix(periodEnd),
    trial_end: isoFromUnix(subscription.trial_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    last_event_created: eventCreated,
  }, { onConflict: conflictTarget });
  if (error) throw error;
}

async function syncFromInvoice(invoice: Stripe.Invoice, eventCreated: number, livemode: boolean) {
  const legacySubscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  const value = parentSubscription || legacySubscription;
  const subscriptionId = typeof value === "string" ? value : value?.id;
  if (!subscriptionId) return;
  await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId), eventCreated, livemode);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error("stripe-webhook-signature", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        if (checkout.mode === "subscription" && checkout.subscription) {
          const subscriptionId = typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId), event.created, event.livemode, checkout.customer_details?.email);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object as Stripe.Subscription, event.created, event.livemode);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await syncFromInvoice(event.data.object as Stripe.Invoice, event.created, event.livemode);
        break;
      default:
        break;
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("stripe-webhook-handler", event.id, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
});
