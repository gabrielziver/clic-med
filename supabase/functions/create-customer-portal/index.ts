import { handleOptions, json } from "../_shared/http.ts";
import { authenticatedUser, stripe, supabaseAdmin } from "../_shared/server.ts";

const appUrl = Deno.env.get("APP_URL") || "https://clic-med.vercel.app";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const { data: subscription } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("livemode", true)
      .maybeSingle();
    if (!subscription?.stripe_customer_id) return json({ error: "Nenhuma assinatura encontrada." }, 404);

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/?billing=return`,
    });
    return json({ url: portal.url });
  } catch (error) {
    console.error("create-customer-portal", error);
    return json({ error: "Não foi possível abrir o gerenciamento da assinatura." }, 500);
  }
});
