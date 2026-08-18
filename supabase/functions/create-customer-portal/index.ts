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
      .or(`user_id.eq.${user.id},email.eq.${user.email?.toLowerCase()}`)
      .eq("livemode", true)
      .limit(1)
      .maybeSingle();
    if (!subscription?.stripe_customer_id) return json({ error: "Nenhuma assinatura encontrada." }, 404);

    await supabaseAdmin
      .from("stripe_subscriptions")
      .update({ user_id: user.id })
      .is("user_id", null)
      .eq("email", user.email?.toLowerCase());

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
