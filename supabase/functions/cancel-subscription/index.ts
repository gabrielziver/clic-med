import { handleOptions, json } from "../_shared/http.ts";
import { authenticatedUser, stripe, supabaseAdmin } from "../_shared/server.ts";

function isoFromUnix(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

const cancellationReasons = new Set(["uso_baixo", "recurso_ausente", "preco", "dificuldade", "pausa_temporaria", "outro"]);
const discoverySources = new Set(["instagram", "google", "indicacao", "outro"]);
const recommendations = new Set(["sim", "talvez", "nao"]);
const productAreas = new Set(["Agenda", "Pacientes", "Financeiro", "Relatórios"]);

function cleanText(value: unknown, maxLength = 600) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function rating(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;
}

function normalizeSurvey(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const survey = value as Record<string, unknown>;
  const skipped = survey.skipped === true;
  return {
    skipped,
    cancellation_reason: skipped || !cancellationReasons.has(String(survey.cancellation_reason)) ? null : String(survey.cancellation_reason),
    discovery_source: skipped || !discoverySources.has(String(survey.discovery_source)) ? null : String(survey.discovery_source),
    ease_rating: skipped ? null : rating(survey.ease_rating),
    satisfaction_rating: skipped ? null : rating(survey.satisfaction_rating),
    used_areas: skipped || !Array.isArray(survey.used_areas) ? [] : survey.used_areas.filter((area) => productAreas.has(String(area))).map(String).slice(0, 4),
    most_useful: skipped ? null : cleanText(survey.most_useful),
    improvement: skipped ? null : cleanText(survey.improvement),
    recommendation: skipped || !recommendations.has(String(survey.recommendation)) ? null : String(survey.recommendation),
  };
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const requestBody = await request.json().catch(() => ({}));
    const survey = normalizeSurvey((requestBody as { survey?: unknown }).survey);

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("id, email, stripe_subscription_id, livemode")
      .or(`user_id.eq.${user.id},email.eq.${user.email?.toLowerCase()}`)
      .limit(1)
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
        user_id: user.id,
        cancel_at_period_end: true,
        current_period_end: isoFromUnix(periodEnd),
        status: updated.status,
      })
      .eq("stripe_subscription_id", subscription.stripe_subscription_id);
    if (updateError) throw updateError;

    let surveySaved = false;
    if (survey) {
      const { error: surveyError } = await supabaseAdmin.from("cancellation_surveys").insert({
        user_id: user.id,
        subscription_id: subscription.id,
        email: user.email?.toLowerCase() || subscription.email,
        ...survey,
      });
      if (surveyError) console.error("cancel-subscription-survey", surveyError);
      else surveySaved = true;
    }

    return json({ cancel_at_period_end: true, current_period_end: isoFromUnix(periodEnd), survey_saved: surveySaved });
  } catch (error) {
    console.error("cancel-subscription", error);
    return json({ error: "Não foi possível cancelar a assinatura. Tente novamente." }, 500);
  }
});
