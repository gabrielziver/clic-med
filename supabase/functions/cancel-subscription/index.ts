import { handleOptions, json } from "../_shared/http.ts";
import { authenticatedUser, stripe, supabaseAdmin } from "../_shared/server.ts";

function isoFromUnix(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("stripe_subscription_id, livemode")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription?.stripe_subscription_id || !subscription.livemode) {
      return json({ error: "Nenhuma assinatura ativa encontrada." }, 404);
    }

    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    const firstItem = updated.items.data[0];
    const periodEnd = (firstItem as typeof firstItem & { current_period_end?: number }).current_period_end
      || (updated as typeof updated & { current_period_end?: number }).current_period_end
      || updated.trial_end;

    const { error: updateError } = await supabaseAdmin
      .from("stripe_subscriptions")
      .update({
        cancel_at_period_end: true,
        current_period_end: isoFromUnix(periodEnd),
        status: updated.status,
      })
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return json({ cancel_at_period_end: true, current_period_end: isoFromUnix(periodEnd) });
  } catch (error) {
    console.error("cancel-subscription", error);
    return json({ error: "Não foi possível cancelar a assinatura. Tente novamente." }, 500);
  }
});
