import { handleOptions, json } from "../_shared/http.ts";
import { stripe } from "../_shared/server.ts";

const appUrl = Deno.env.get("APP_URL") || "https://clic-med.vercel.app";
const priceId = Deno.env.get("STRIPE_PRICE_ID")!;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const origin = String(body?.origin || "marketing").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "marketing";

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      locale: "pt-BR",
      success_url: `${appUrl}/app?checkout=success&cadastro=1&origem=${encodeURIComponent(origin)}`,
      cancel_url: `${appUrl}/conheca?checkout=canceled&origem=${encodeURIComponent(origin)}`,
      metadata: { signup_origin: origin },
      subscription_data: {
        trial_period_days: 3,
        metadata: { signup_origin: origin },
      },
    });

    return json({ url: checkout.url, destination: "checkout" });
  } catch (error) {
    console.error("create-public-checkout-session", error);
    return json({ error: "Não foi possível abrir o checkout. Tente novamente." }, 500);
  }
});
