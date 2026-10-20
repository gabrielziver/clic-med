import { handleOptions, json } from "../_shared/http.ts";
import { authenticatedUser, stripe, supabaseAdmin } from "../_shared/server.ts";

const appUrl = Deno.env.get("APP_URL") || "https://clic-med.vercel.app";
const priceId = Deno.env.get("STRIPE_PRICE_ID")!;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const user = await authenticatedUser(request);
    if (!user?.email) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const { data: existing } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("stripe_customer_id, status, livemode")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.livemode ? existing.stripe_customer_id : null;
    if (customerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
        const current = subscriptions.data.find((item) => ["trialing", "active", "past_due", "unpaid", "paused", "incomplete"].includes(item.status));
        if (current) {
          const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl}/?billing=return` });
          return json({ url: portal.url, destination: "portal" });
        }
      } catch (error) {
        const stripeError = error as { code?: string };
        if (stripeError.code !== "resource_missing") throw error;
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    await supabaseAdmin.from("stripe_subscriptions").upsert({
      user_id: user.id,
      email: user.email.toLowerCase(),
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      stripe_price_id: null,
      livemode: true,
      status: "checkout_pending",
      current_period_end: null,
      trial_end: null,
      cancel_at_period_end: false,
      last_event_created: 0,
    }, { onConflict: "user_id" });

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      locale: "pt-BR",
      custom_text: {
        submit: {
          message: "Você começa com 3 dias grátis. Depois, a assinatura é de R$ 67 por mês e pode ser cancelada a qualquer momento.",
        },
      },
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=canceled`,
      metadata: { supabase_user_id: user.id, email: user.email.toLowerCase() },
      subscription_data: {
        trial_period_days: 3,
        metadata: { supabase_user_id: user.id, email: user.email.toLowerCase() },
      },
    }, { idempotencyKey: `checkout-${user.id}-${Math.floor(Date.now() / 300000)}` });

    return json({ url: checkout.url, destination: "checkout" });
  } catch (error) {
    console.error("create-checkout-session", error);
    return json({ error: "Não foi possível abrir o pagamento. Tente novamente." }, 500);
  }
});
