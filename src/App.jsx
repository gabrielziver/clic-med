import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { LandingPage, QuizPage } from "./Marketing.jsx";

const OWNER_EMAIL = "oliverziver@gmail.com";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const shortWeekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const AGENDA_START_HOUR = 8;
const AGENDA_END_HOUR = 18;
const AGENDA_HOUR_HEIGHT = 94;
const statusInfo = {
  presente: { label: "Presente", className: "present" },
  faltou_assinou: { label: "Faltou, mas terá reembolso", className: "charged-absence" },
  nao_compareceu: { label: "Não compareceu", className: "absence" },
  reagendado: { label: "Reagendado", className: "rescheduled" },
};
const subscriptionLabels = {
  checkout_pending: "Pagamento não concluído",
  incomplete: "Pagamento incompleto",
  incomplete_expired: "Pagamento expirado",
  trialing: "Teste gratuito",
  active: "Ativa",
  past_due: "Pagamento pendente",
  unpaid: "Inadimplente",
  paused: "Pausada",
  canceled: "Cancelada",
};

function subscriptionActive(subscription) {
  return ["trialing", "active"].includes(subscription?.status) && new Date(subscription.current_period_end) > new Date();
}

function subscriptionManageable(subscription) {
  return Boolean(subscription?.stripe_customer_id)
    && ["trialing", "active", "past_due", "unpaid", "paused", "incomplete"].includes(subscription.status);
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  if (!value) return "—";
  return dateFromKey(value.slice(0, 10)).toLocaleDateString("pt-BR");
}

function longDate(date) {
  return `${date.getDate()} de ${monthNames[date.getMonth()].toLowerCase()} de ${date.getFullYear()}`;
}

function timeOf(value) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function daysUntil(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((dateFromKey(value) - today) / 86400000);
}

function emptyPatient() {
  return {
    full_name: "",
    patient_email: "",
    guardian: "",
    guardian_contact: "",
    insurance: "Particular",
    cid: "",
    therapies: "Psicoterapia individual",
    weekly_sessions: 1,
    session_value: 0,
    schedule_text: "",
    status: "Ativo",
    administrative_notes: "",
    clinical_notes: "",
    plan_expires_on: "",
    sessions_completed: 0,
    sessions_total: 10,
  };
}

function newAppointmentDraft(date = dateKey(new Date()), time = "09:00") {
  return { id: crypto.randomUUID(), date, time };
}

function nextAppointmentDraft(current) {
  const nextDate = dateFromKey(current.date);
  nextDate.setDate(nextDate.getDate() + 7);
  return newAppointmentDraft(dateKey(nextDate), current.time);
}

function AccessScreen({ email, grant, subscription, busy, onSubscribe, onManage, onRefresh, onLogout }) {
  const expired = grant?.expires_at && new Date(grant.expires_at) <= new Date();
  const canManage = subscriptionManageable(subscription);
  const status = subscriptionLabels[subscription?.status] || "Sem assinatura";
  return (
    <main className="access-page">
      <section className="access-card">
        <Brand />
        <div className="access-icon"><ShieldCheck size={28} /></div>
        <h1>{subscription?.status === "past_due" ? "Pagamento pendente" : expired ? "Seu acesso expirou" : "Ative seu acesso"}</h1>
        <p>{subscription?.status === "past_due" ? "Atualize o pagamento para continuar usando o Clic Med." : "Assine o plano mensal ou aguarde uma liberação de cortesia do administrador."}</p>
        <div className="access-plan">
          <div><span>Plano Clic Med</span><strong>R$ 67,00 <small>/ mês</small></strong><p>3 dias gratuitos. Cancele quando quiser.</p></div>
          <em className={subscriptionActive(subscription) ? "active" : "inactive"}>{status}</em>
        </div>
        <button className="primary-button wide" disabled={busy} onClick={canManage ? onManage : onSubscribe}><CreditCard size={18} />{busy ? "Abrindo..." : canManage ? "Gerenciar pagamento" : "Começar teste gratuito"}</button>
        <button className="secondary-button wide" disabled={busy} onClick={onRefresh}><RefreshCw size={17} />Já concluí o pagamento</button>
        <div className="access-account"><span>Conta conectada</span><strong>{email}</strong>{grant?.expires_at && <small>Validade anterior: {new Date(grant.expires_at).toLocaleDateString("pt-BR")}</small>}</div>
        <button className="secondary-button wide" onClick={onLogout}><LogOut size={17} />Sair desta conta</button>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Clic Med">
      <div>
        <strong className="wordmark">
          <span>Clic</span><span>Med</span>
        </strong>
        <span>Gestão para terapeutas</span>
      </div>
    </div>
  );
}

function AuthScreen({ onAuthenticated, initialMode = "login", signupOrigin = "direto" }) {
  const checkoutSuccess = new URLSearchParams(window.location.search).get("checkout") === "success";
  const [mode, setMode] = useState(checkoutSuccess ? "login" : initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim(), signup_origin: signupOrigin } } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : result.error.message);
      return;
    }
    if (mode === "signup" && Array.isArray(result.data.user?.identities) && result.data.user.identities.length === 0) {
      setMode("login");
      setPassword("");
      setMessage("Este e-mail já está cadastrado. Entre com a senha da sua conta para continuar.");
      return;
    }
    if (result.data.session) onAuthenticated(result.data.session);
    else setMessage("Cadastro criado. Confira seu e-mail para confirmar o acesso.");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-intro">
          <Brand />
          <div>
            <p className="eyebrow">Organização sem planilhas</p>
            <h1>Seu consultório em um fluxo simples.</h1>
            <p>Agenda, pacientes, sessões e financeiro no mesmo lugar.</p>
          </div>
          <div className="auth-points">
            <span><CalendarDays size={18} /> Agenda de atendimentos</span>
            <span><UsersRound size={18} /> Cadastro e prontuário</span>
            <span><CircleDollarSign size={18} /> Controle de recebimentos</span>
          </div>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-form-head">
            <h2>{checkoutSuccess && mode === "login" ? "Pagamento concluído. Entre na sua conta" : mode === "login" ? "Acesse sua conta" : checkoutSuccess ? "Crie seu primeiro acesso" : "Crie sua conta"}</h2>
            <p>{checkoutSuccess ? "Use o mesmo e-mail informado no checkout da Stripe." : mode === "login" ? "Entre para continuar no Clic Med." : "Comece a organizar seus atendimentos."}</p>
            {checkoutSuccess && <div className="checkout-success-notice"><CircleDollarSign size={18} /><span><strong>Assinatura localizada</strong><small>Já tinha cadastro? Entre normalmente. É seu primeiro acesso? Escolha Criar conta.</small></span></div>}
          </div>
          <div className="auth-switch" role="tablist">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Entrar</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Criar conta</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && <label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>}
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="voce@exemplo.com" /></label>
            <label>Senha<input type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 6 caracteres" /></label>
            {message && <p className="form-message" role="status">{message}</p>}
            <button className="primary-button wide" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

function MiniCalendar({ selectedDate, appointments, onSelect, onClose }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [showMonths, setShowMonths] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function outside(event) { if (ref.current && !ref.current.contains(event.target)) onClose(); }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [onClose]);

  function shiftMonth(amount) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const sessionDates = new Set(appointments.map((item) => dateKey(item.starts_at)));

  return (
    <div className="calendar-popover" ref={ref}>
      <div className="calendar-head">
        <button aria-label="Mês anterior" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
        <button className="calendar-title" onClick={() => setShowMonths((value) => !value)}>{monthNames[viewDate.getMonth()]} de {viewDate.getFullYear()}</button>
        <button aria-label="Próximo mês" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button>
      </div>
      {showMonths ? (
        <div className="month-grid">
          {monthNames.map((month, index) => <button key={month} className={index === viewDate.getMonth() ? "active" : ""} onClick={() => { setViewDate(new Date(viewDate.getFullYear(), index, 1)); setShowMonths(false); }}>{month.slice(0, 3)}</button>)}
        </div>
      ) : (
        <>
          <div className="calendar-weekdays">{shortWeekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: totalDays }, (_, index) => {
              const day = index + 1;
              const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const key = dateKey(date);
              return <button key={key} className={`${key === dateKey(selectedDate) ? "selected" : ""} ${sessionDates.has(key) ? "has-session" : ""}`} onClick={() => onSelect(date)}>{day}</button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function keydown(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);

  return (
    <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true">
        <header className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function PatientForm({ initial, onSave, onCancel, busy, submitLabel = "Cadastrar paciente", defaultAppointmentDate, defaultAppointmentTime }) {
  const [form, setForm] = useState(() => ({ ...emptyPatient(), ...initial, schedule_text: initial?.schedule?.join(", ") || initial?.schedule_text || "" }));
  const [addToAgenda, setAddToAgenda] = useState(!initial);
  const [appointmentDrafts, setAppointmentDrafts] = useState(() => [newAppointmentDraft(defaultAppointmentDate, defaultAppointmentTime)]);
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function updateDraft(id, key, value) {
    setAppointmentDrafts((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }
  function submit(event) {
    event.preventDefault();
    const initialAppointments = addToAgenda ? appointmentDrafts.map(({ date, time }) => ({ date, time })) : [];
    const typedSchedule = form.schedule_text.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
    onSave({
      ...form,
      weekly_sessions: Number(form.weekly_sessions),
      session_value: Number(form.session_value),
      sessions_completed: Math.min(Number(form.sessions_completed), Number(form.sessions_total)),
      sessions_total: Number(form.sessions_total),
      schedule: typedSchedule.length ? typedSchedule : initialAppointments.map((item) => `${formatDate(item.date)} ${item.time}`),
      initial_appointments: initialAppointments,
    });
  }
  return (
    <form className="patient-form" onSubmit={submit}>
      <section className="form-section">
        <div className="form-section-head"><h2>Dados do paciente</h2><p>Informações da agenda, do plano e do financeiro.</p></div>
        <div className="form-grid three">
          <label className="span-2">Nome completo<input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required /></label>
          <label>Responsável<input value={form.guardian || ""} onChange={(e) => update("guardian", e.target.value)} /></label>
          <label className="span-2">E-mail do paciente<input type="email" value={form.patient_email || ""} onChange={(e) => update("patient_email", e.target.value)} placeholder="paciente@exemplo.com" /></label>
          <label>Contato do responsável<input type="tel" value={form.guardian_contact || ""} onChange={(e) => update("guardian_contact", e.target.value)} placeholder="(81) 99999-9999" /></label>
          <label>Convênio<select value={form.insurance} onChange={(e) => update("insurance", e.target.value)}><option>Particular</option><option>Unimed</option><option>Bradesco Saúde</option><option>SulAmérica</option><option>Outro</option></select></label>
          <label>CID / Laudo<input value={form.cid || ""} onChange={(e) => update("cid", e.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(e) => update("status", e.target.value)}><option>Ativo</option><option>Pausado</option></select></label>
          <label className="span-2">Terapia / acompanhamento<input value={form.therapies} onChange={(e) => update("therapies", e.target.value)} required /></label>
          <label>Valor por sessão<input type="number" min="0" step="0.01" value={form.session_value} onChange={(e) => update("session_value", e.target.value)} required /></label>
          <label>Sessões por semana<input type="number" min="1" max="7" value={form.weekly_sessions} onChange={(e) => update("weekly_sessions", e.target.value)} required /></label>
          <label className="span-2">Rotina de atendimento <span className="optional">(opcional)</span><input value={form.schedule_text} onChange={(e) => update("schedule_text", e.target.value)} placeholder="Segunda 09:00, Quarta 09:00" /></label>
        </div>
      </section>
      {!initial && <section className="form-section schedule-section">
        <div className="schedule-option">
          <div><h2>Adicionar à agenda</h2><p>Crie as primeiras sessões junto com o cadastro. Cada atendimento terá duração de 1 hora.</p></div>
          <label className="switch-control"><input type="checkbox" checked={addToAgenda} onChange={(event) => setAddToAgenda(event.target.checked)} /><span /><b>{addToAgenda ? "Ativado" : "Desativado"}</b></label>
        </div>
        {addToAgenda && <div className="schedule-builder">
          <div className="schedule-head"><span>Data</span><span>Horário</span><span>Ação</span></div>
          {appointmentDrafts.map((draft) => <div className="schedule-row" key={draft.id}>
            <label><span className="sr-only">Data da sessão</span><input type="date" value={draft.date} onChange={(event) => updateDraft(draft.id, "date", event.target.value)} required /></label>
            <label><span className="sr-only">Horário da sessão</span><input type="time" min="08:00" max="17:00" step="60" value={draft.time} onChange={(event) => updateDraft(draft.id, "time", event.target.value)} required /></label>
            <button type="button" className="icon-button danger" aria-label="Remover horário" disabled={appointmentDrafts.length === 1} onClick={() => setAppointmentDrafts((current) => current.filter((item) => item.id !== draft.id))}><Trash2 size={17} /></button>
          </div>)}
          <button type="button" className="secondary-button add-schedule" onClick={() => setAppointmentDrafts((current) => [...current, nextAppointmentDraft(current[current.length - 1])])}><Plus size={17} />Adicionar outra data e horário</button>
        </div>}
      </section>}
      <section className="form-section">
        <div className="form-section-head"><h2>Plano e prontuário</h2><p>Controle do ciclo de sessões e registro do acompanhamento.</p></div>
        <div className="form-grid three">
          <label>Vencimento do plano<input type="date" value={form.plan_expires_on || ""} onChange={(e) => update("plan_expires_on", e.target.value)} /></label>
          <label>Sessões realizadas<input type="number" min="0" value={form.sessions_completed} onChange={(e) => update("sessions_completed", e.target.value)} /></label>
          <label>Total de sessões<input type="number" min="1" value={form.sessions_total} onChange={(e) => update("sessions_total", e.target.value)} /></label>
          <label className="full">Prontuário do paciente<textarea value={form.clinical_notes || ""} onChange={(e) => update("clinical_notes", e.target.value)} /></label>
          <label className="full">Observações administrativas<textarea value={form.administrative_notes || ""} onChange={(e) => update("administrative_notes", e.target.value)} /></label>
        </div>
      </section>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : submitLabel}</button></div>
    </form>
  );
}

function DashboardApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [currentGrant, setCurrentGrant] = useState(null);
  const [accessGrants, setAccessGrants] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [stripeSubscriptions, setStripeSubscriptions] = useState([]);
  const [billingBusy, setBillingBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [patientView, setPatientView] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [insuranceFilter, setInsuranceFilter] = useState("Todos");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAccessAllowed(false);
      setCurrentGrant(null);
      setCurrentSubscription(null);
      return;
    }
    checkAccess(session);
  }, [session]);
  useEffect(() => {
    if (!session || new URLSearchParams(window.location.search).get("checkout") !== "success") return undefined;
    let canceled = false;
    let attempts = 0;
    async function refreshCheckout() {
      attempts += 1;
      await checkAccess(session);
      if (!canceled && attempts < 8) setTimeout(refreshCheckout, 1800);
      if (attempts === 8) window.history.replaceState({}, "", window.location.pathname);
    }
    refreshCheckout();
    return () => { canceled = true; };
  }, [session]);
  useEffect(() => {
    if (!session || !accessAllowed || session.user.email?.toLowerCase() === OWNER_EMAIL) return undefined;
    const timer = setInterval(async () => {
      const { data } = await supabase.rpc("has_active_access");
      if (!data) setAccessAllowed(false);
    }, 60000);
    return () => clearInterval(timer);
  }, [session, accessAllowed]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function checkAccess(activeSession) {
    setAccessLoading(true);
    setError("");
    const owner = activeSession.user.email?.toLowerCase() === OWNER_EMAIL;
    if (!owner && activeTab === "acessos") setActiveTab("agenda");
    const [accessResult, grantResult, subscriptionResult] = await Promise.all([
      supabase.rpc("has_active_access"),
      owner
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("access_grants").select("email, active, starts_at, expires_at").eq("email", activeSession.user.email).maybeSingle(),
      supabase.from("stripe_subscriptions").select("*").or(`user_id.eq.${activeSession.user.id},email.eq.${activeSession.user.email?.toLowerCase()}`).limit(1).maybeSingle(),
    ]);
    setAccessLoading(false);
    if (accessResult.error || grantResult.error || subscriptionResult.error) {
      setError(accessResult.error?.message || grantResult.error?.message || subscriptionResult.error?.message);
      setAccessAllowed(false);
      return;
    }
    setCurrentGrant(grantResult.data || null);
    setCurrentSubscription(subscriptionResult.data || null);
    setAccessAllowed(Boolean(accessResult.data));
    if (accessResult.data) await loadData(owner);
  }

  async function loadData(owner = session?.user.email?.toLowerCase() === OWNER_EMAIL) {
    setDataLoading(true);
    setError("");
    const [patientResult, appointmentResult, grantsResult, subscriptionsResult] = await Promise.all([
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("appointments").select("*").order("starts_at"),
      owner ? supabase.from("access_grants").select("*").order("expires_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      owner ? supabase.from("stripe_subscriptions").select("*").order("updated_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    setDataLoading(false);
    if (patientResult.error || appointmentResult.error || grantsResult.error || subscriptionsResult.error) {
      setError(patientResult.error?.message || appointmentResult.error?.message || grantsResult.error?.message || subscriptionsResult.error?.message);
      return;
    }
    setPatients(patientResult.data || []);
    setAppointments(appointmentResult.data || []);
    setAccessGrants(grantsResult.data || []);
    setStripeSubscriptions(subscriptionsResult.data || []);
  }

  async function openBilling(functionName) {
    setBillingBusy(true);
    setError("");
    const { data, error: functionError } = await supabase.functions.invoke(functionName, { body: {} });
    setBillingBusy(false);
    if (functionError || !data?.url) {
      setError(data?.error || functionError?.message || "Não foi possível abrir a Stripe.");
      return;
    }
    window.location.assign(data.url);
  }

  async function updateProfileName(fullName) {
    const normalizedName = fullName.trim();
    if (!normalizedName) return false;
    setBusy(true);
    setError("");
    const { data, error: profileError } = await supabase.auth.updateUser({ data: { full_name: normalizedName } });
    setBusy(false);
    if (profileError) { setError(profileError.message); return false; }
    setSession((current) => current ? { ...current, user: data.user } : current);
    setToast("Nome atualizado.");
    return true;
  }

  async function cancelSubscription() {
    setBillingBusy(true);
    setError("");
    const { data, error: functionError } = await supabase.functions.invoke("cancel-subscription", { body: {} });
    setBillingBusy(false);
    if (functionError || !data?.cancel_at_period_end) {
      setError(data?.error || functionError?.message || "Não foi possível cancelar a assinatura.");
      return false;
    }
    setToast("Cancelamento agendado. Seu acesso continua até o fim do período pago.");
    await checkAccess(session);
    return true;
  }

  async function saveAccessGrant({ email, days, notes }) {
    setBusy(true);
    setError("");
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + Number(days) * 86400000);
    const { error: grantError } = await supabase.from("access_grants").upsert({
      email: email.trim().toLowerCase(),
      active: true,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      notes: notes.trim() || null,
      created_by: session.user.id,
    }, { onConflict: "email" });
    setBusy(false);
    if (grantError) { setError(grantError.message); return false; }
    setToast(`Acesso liberado por ${days} dias.`);
    await loadData(true);
    return true;
  }

  async function revokeAccess(id) {
    setBusy(true);
    const { error: revokeError } = await supabase.from("access_grants").update({ active: false }).eq("id", id);
    setBusy(false);
    if (revokeError) { setError(revokeError.message); return; }
    setToast("Acesso bloqueado.");
    await loadData(true);
  }

  async function savePatient(values, patientId = null) {
    setBusy(true);
    setError("");
    const initialAppointments = values.initial_appointments || [];
    const payload = { ...values, user_id: session.user.id };
    delete payload.schedule_text;
    delete payload.initial_appointments;

    const duplicateDraft = initialAppointments.find((item, index) => initialAppointments.findIndex((candidate) => candidate.date === item.date && candidate.time === item.time) !== index);
    const occupiedDraft = initialAppointments.find((item) => appointments.some((appointment) => dateKey(appointment.starts_at) === item.date && timeOf(appointment.starts_at) === item.time));
    if (!patientId && (duplicateDraft || occupiedDraft)) {
      setBusy(false);
      setError(duplicateDraft ? "Existem datas e horários repetidos no cadastro." : `O horário de ${formatDate(occupiedDraft.date)} às ${occupiedDraft.time} já está ocupado.`);
      return;
    }

    const query = patientId
      ? supabase.from("patients").update(payload).eq("id", patientId)
      : supabase.from("patients").insert(payload).select("id").single();
    const { data: savedPatient, error: saveError } = await query;
    if (!saveError && !patientId && initialAppointments.length) {
      const sessions = initialAppointments.map((item) => {
        const start = new Date(`${item.date}T${item.time}:00`);
        return {
          user_id: session.user.id,
          patient_id: savedPatient.id,
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          procedure: values.therapies,
          unit: "",
          status: "presente",
          payment_status: "Pendente",
          amount: Number(values.session_value || 0),
        };
      });
      const { error: appointmentError } = await supabase.from("appointments").insert(sessions);
      if (appointmentError) {
        await supabase.from("patients").delete().eq("id", savedPatient.id);
        setBusy(false);
        setError(`Não foi possível adicionar as sessões: ${appointmentError.message}`);
        return;
      }
    }
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setModal(null);
    setPatientView("list");
    setToast(patientId ? "Prontuário atualizado." : initialAppointments.length ? `Paciente cadastrado com ${initialAppointments.length} ${initialAppointments.length === 1 ? "sessão" : "sessões"}.` : "Paciente cadastrado.");
    if (!patientId && initialAppointments.length) {
      setSelectedDate(dateFromKey(initialAppointments[0].date));
      setActiveTab("agenda");
    }
    await loadData();
  }

  async function updateAppointment(id, changes, successMessage = "Sessão atualizada.") {
    setBusy(true);
    const { error: updateError } = await supabase.from("appointments").update(changes).eq("id", id);
    setBusy(false);
    if (updateError) { setError(updateError.message); return false; }
    setToast(successMessage);
    await loadData();
    return true;
  }

  async function createAppointment(values) {
    const patient = patients.find((item) => item.id === values.patient_id);
    const start = new Date(`${values.date}T${values.time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setBusy(true);
    const { error: createError } = await supabase.from("appointments").insert({
      user_id: session.user.id,
      patient_id: values.patient_id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      procedure: values.procedure,
      unit: values.unit,
      status: "presente",
      payment_status: "Pendente",
      amount: Number(patient?.session_value || 0),
    });
    setBusy(false);
    if (createError) { setError(createError.message); return; }
    setModal(null);
    setSelectedDate(dateFromKey(values.date));
    setToast("Sessão adicionada à agenda.");
    await loadData();
  }

  const dailyAppointments = useMemo(() => appointments.filter((item) => dateKey(item.starts_at) === dateKey(selectedDate)), [appointments, selectedDate]);
  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const matchesSearch = patient.full_name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    return matchesSearch && (statusFilter === "Todos" || patient.status === statusFilter) && (insuranceFilter === "Todos" || patient.insurance === insuranceFilter);
  }), [patients, search, statusFilter, insuranceFilter]);
  const totals = useMemo(() => {
    const billable = appointments.filter((item) => item.payment_status !== "Cancelado");
    const received = billable.filter((item) => item.payment_status === "Pago").reduce((sum, item) => sum + Number(item.amount), 0);
    const pending = billable.filter((item) => item.payment_status === "Pendente").reduce((sum, item) => sum + Number(item.amount), 0);
    const total = received + pending;
    return { received, pending, percent: total ? Math.round((received / total) * 100) : 0, ticket: billable.length ? total / billable.length : 0 };
  }, [appointments]);
  const defaultAppointmentTime = useMemo(() => {
    const occupiedHours = new Set(appointments.filter((item) => dateKey(item.starts_at) === dateKey(selectedDate)).map((item) => new Date(item.starts_at).getHours()));
    const availableHour = Array.from({ length: 10 }, (_, index) => index + 8).find((hour) => !occupiedHours.has(hour));
    return `${String(availableHour ?? 9).padStart(2, "0")}:00`;
  }, [appointments, selectedDate]);
  const isOwner = session?.user.email?.toLowerCase() === OWNER_EMAIL;

  if (!isSupabaseConfigured) return <main className="setup-page"><section><Brand /><h1>Conecte o banco para iniciar</h1><p>As variáveis do Supabase ainda não foram configuradas.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></section></main>;
  if (authLoading) return <main className="loading-page"><Brand /><span className="spinner" /></main>;
  if (!session) {
    const params = new URLSearchParams(window.location.search);
    return <AuthScreen onAuthenticated={setSession} initialMode={params.get("cadastro") === "1" ? "signup" : "login"} signupOrigin={params.get("origem") || "direto"} />;
  }
  if (accessLoading) return <main className="loading-page"><Brand /><span className="spinner" /></main>;
  if (!accessAllowed) return <AccessScreen email={session.user.email} grant={currentGrant} subscription={currentSubscription} busy={billingBusy} onSubscribe={() => openBilling("create-checkout-session")} onManage={() => openBilling("create-customer-portal")} onRefresh={() => checkAccess(session)} onLogout={() => supabase.auth.signOut()} />;

  const currentPatient = modal?.patientId ? patients.find((item) => item.id === modal.patientId) : null;
  const currentAppointment = modal?.appointmentId ? appointments.find((item) => item.id === modal.appointmentId) : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="main-tabs">
          <button className={activeTab === "agenda" ? "active" : ""} onClick={() => setActiveTab("agenda")}><CalendarDays size={18} />Agenda</button>
          <button className={activeTab === "pacientes" ? "active" : ""} onClick={() => setActiveTab("pacientes")}><UsersRound size={18} />Pacientes</button>
          <button className={activeTab === "financeiro" ? "active" : ""} onClick={() => setActiveTab("financeiro")}><WalletCards size={18} />Financeiro</button>
          <button className={activeTab === "perfil" ? "active" : ""} onClick={() => setActiveTab("perfil")}><UserRound size={18} />Perfil</button>
          {isOwner && <button className={activeTab === "acessos" ? "active" : ""} onClick={() => setActiveTab("acessos")}><ShieldCheck size={18} />Acessos</button>}
        </nav>
        <div className="sidebar-metric"><span>Entradas</span><strong>{currency.format(totals.received)}</strong><small>{currency.format(totals.pending)} pendente</small></div>
        <button className={`account-button ${activeTab === "perfil" ? "active" : ""}`} onClick={() => setActiveTab("perfil")}><UserRound size={18} /><span><strong>{session.user.user_metadata?.full_name || "Meu perfil"}</strong><small>{session.user.email}</small></span><ChevronRight size={17} /></button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{activeTab === "agenda" ? longDate(selectedDate) : activeTab === "pacientes" ? `${patients.filter((p) => p.status === "Ativo").length} pacientes ativos` : activeTab === "financeiro" ? `${monthNames[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}` : activeTab === "perfil" ? "Conta e assinatura" : "Administração da assinatura"}</p><h1>{activeTab === "agenda" ? "Agenda do dia" : activeTab === "pacientes" ? "Cadastro de pacientes" : activeTab === "financeiro" ? "Financeiro geral" : activeTab === "perfil" ? "Meu perfil" : "Controle de acessos"}</h1></div>
          {(activeTab === "agenda" || activeTab === "pacientes") && <button className="primary-button" onClick={() => activeTab === "pacientes" ? setPatientView("add") : setModal({ type: "appointment-new" })}><Plus size={18} />{activeTab === "pacientes" ? "Novo paciente" : "Nova sessão"}</button>}
        </header>

        <nav className={`mobile-tabs ${isOwner ? "owner" : ""}`}>
          <button className={activeTab === "agenda" ? "active" : ""} onClick={() => setActiveTab("agenda")}>Agenda</button>
          <button className={activeTab === "pacientes" ? "active" : ""} onClick={() => setActiveTab("pacientes")}>Pacientes</button>
          <button className={activeTab === "financeiro" ? "active" : ""} onClick={() => setActiveTab("financeiro")}>Financeiro</button>
          <button className={activeTab === "perfil" ? "active" : ""} onClick={() => setActiveTab("perfil")}>Perfil</button>
          {isOwner && <button className={activeTab === "acessos" ? "active" : ""} onClick={() => setActiveTab("acessos")}>Acessos</button>}
        </nav>

        {error && <div className="error-banner">{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {dataLoading ? <div className="content-loading"><span className="spinner" />Carregando dados...</div> : (
          <>
            {activeTab === "agenda" && <AgendaView appointments={appointments} daily={dailyAppointments} patients={patients} selectedDate={selectedDate} setSelectedDate={setSelectedDate} calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen} openAppointment={(appointment) => setModal({ type: "patient", patientId: appointment.patient_id, appointmentId: appointment.id })} />}
            {activeTab === "pacientes" && <PatientsView view={patientView} setView={setPatientView} patients={filteredPatients} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} insuranceFilter={insuranceFilter} setInsuranceFilter={setInsuranceFilter} onOpen={(patient) => setModal({ type: "patient", patientId: patient.id })} onSave={(values) => savePatient(values)} busy={busy} defaultAppointmentDate={dateKey(selectedDate)} defaultAppointmentTime={defaultAppointmentTime} />}
            {activeTab === "financeiro" && <FinanceView totals={totals} appointments={appointments} patients={patients} selectedDate={selectedDate} professional={{ name: session.user.user_metadata?.full_name, email: session.user.email }} onEdit={(appointment) => setModal({ type: "finance", appointmentId: appointment.id })} />}
            {activeTab === "perfil" && <ProfileView user={session.user} subscription={currentSubscription} grant={currentGrant} isOwner={isOwner} busy={busy || billingBusy} onSaveName={updateProfileName} onCancelSubscription={cancelSubscription} onLogout={() => supabase.auth.signOut()} />}
            {activeTab === "acessos" && isOwner && <AccessView grants={accessGrants} subscriptions={stripeSubscriptions} busy={busy} onSave={saveAccessGrant} onRevoke={revokeAccess} />}
          </>
        )}
      </main>

      {modal?.type === "patient" && currentPatient && <PatientModal patient={currentPatient} appointment={currentAppointment} busy={busy} onClose={() => setModal(null)} onSave={(values) => savePatient(values, currentPatient.id)} onStatus={async (status) => {
        const noCharge = status === "nao_compareceu" || status === "reagendado";
        await updateAppointment(currentAppointment.id, { status, payment_status: noCharge ? "Cancelado" : currentAppointment.payment_status, paid_on: noCharge ? null : currentAppointment.paid_on });
      }} />}
      {modal?.type === "appointment-new" && <NewAppointmentModal patients={patients} selectedDate={selectedDate} busy={busy} onClose={() => setModal(null)} onSave={createAppointment} />}
      {modal?.type === "finance" && currentAppointment && <FinanceModal appointment={currentAppointment} patient={patients.find((item) => item.id === currentAppointment.patient_id)} busy={busy} onClose={() => setModal(null)} onSave={async (changes) => { if (await updateAppointment(currentAppointment.id, changes, "Lançamento financeiro atualizado.")) setModal(null); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function AgendaView({ appointments, daily, patients, selectedDate, setSelectedDate, calendarOpen, setCalendarOpen, openAppointment }) {
  const hours = Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR }, (_, index) => index + AGENDA_START_HOUR);
  const visibleAppointments = daily
    .filter((appointment) => {
      const start = new Date(appointment.starts_at);
      return start.getHours() >= AGENDA_START_HOUR && start.getHours() < AGENDA_END_HOUR;
    })
    .sort((first, second) => new Date(first.starts_at) - new Date(second.starts_at));
  return (
    <section className="panel agenda-panel">
      <div className="agenda-toolbar">
        <div><h2>Minha agenda</h2><p>{daily.length} {daily.length === 1 ? "sessão agendada" : "sessões agendadas"}</p></div>
        <div className="calendar-control">
          <button className="calendar-trigger" onClick={() => setCalendarOpen((value) => !value)}><CalendarDays size={17} />{String(selectedDate.getDate()).padStart(2, "0")} {monthNames[selectedDate.getMonth()].slice(0, 3).toLowerCase()} {selectedDate.getFullYear()}<ChevronDown size={16} /></button>
          {calendarOpen && <MiniCalendar selectedDate={selectedDate} appointments={appointments} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} onClose={() => setCalendarOpen(false)} />}
        </div>
      </div>
      <div className="agenda-legend">{Object.entries(statusInfo).map(([key, value]) => <span key={key}><i className={value.className} />{value.label}</span>)}</div>
      <div className="timeline-scroll"><div className="timeline">
        {hours.map((hour) => <div className="time-slot" key={hour}><time>{String(hour).padStart(2, "0")}:00</time><div className="empty-slot">Horário disponível</div></div>)}
        <div className="appointment-layer">
          {visibleAppointments.map((appointment) => {
            const start = new Date(appointment.starts_at);
            const end = new Date(appointment.ends_at);
            const patient = patients.find((item) => item.id === appointment.patient_id);
            const startMinutes = (start.getHours() - AGENDA_START_HOUR) * 60 + start.getMinutes();
            const durationMinutes = Math.max(30, Math.round((end - start) / 60000));
            const top = (startMinutes / 60) * AGENDA_HOUR_HEIGHT;
            const height = Math.max(74, (durationMinutes / 60) * AGENDA_HOUR_HEIGHT - 8);
            return <button style={{ top: `${top}px`, height: `${height}px` }} className={`appointment-card ${statusInfo[appointment.status]?.className}`} key={appointment.id} onClick={() => openAppointment(appointment)}><span><strong>{patient?.full_name || "Paciente"}</strong><b>{timeOf(appointment.starts_at)} - {timeOf(appointment.ends_at)}</b></span><span><small>{appointment.procedure}</small><em>{statusInfo[appointment.status]?.label}</em></span></button>;
          })}
        </div>
        <div className="timeline-end">18:00</div>
      </div></div>
    </section>
  );
}

function PatientsView({ view, setView, patients, search, setSearch, statusFilter, setStatusFilter, insuranceFilter, setInsuranceFilter, onOpen, onSave, busy, defaultAppointmentDate, defaultAppointmentTime }) {
  return <section className="panel patient-panel">
    <nav className="subtabs"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Lista de pacientes</button><button className={view === "add" ? "active" : ""} onClick={() => setView("add")}>Adicionar paciente</button></nav>
    {view === "list" ? <>
      <div className="filters"><label>Buscar<div className="input-with-icon"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do paciente" /></div></label><label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Todos</option><option>Ativo</option><option>Pausado</option></select></label><label>Convênio<select value={insuranceFilter} onChange={(e) => setInsuranceFilter(e.target.value)}><option>Todos</option><option>Particular</option><option>Unimed</option><option>Bradesco Saúde</option><option>SulAmérica</option><option>Outro</option></select></label></div>
      <div className="patient-table-head"><span>Nome</span><span>CID</span><span>Convênio</span><span>Sessões</span><span>Status</span></div>
      <div>{patients.length ? patients.map((patient) => <button className="patient-row" key={patient.id} onClick={() => onOpen(patient)}><span><strong>{patient.full_name}</strong><small>{patient.therapies}</small></span><b>{patient.cid || "—"}</b><span>{patient.insurance}</span><span>{patient.weekly_sessions} / semana</span><em>{patient.status}</em></button>) : <div className="empty-state"><UsersRound size={28} /><h3>Nenhum paciente encontrado</h3><p>Cadastre o primeiro paciente para começar.</p><button className="primary-button" onClick={() => setView("add")}><Plus size={17} />Adicionar paciente</button></div>}</div>
    </> : <PatientForm onSave={onSave} onCancel={() => setView("list")} busy={busy} defaultAppointmentDate={defaultAppointmentDate} defaultAppointmentTime={defaultAppointmentTime} />}
  </section>;
}

function ProfileView({ user, subscription, grant, isOwner, busy, onSaveName, onCancelSubscription, onLogout }) {
  const [name, setName] = useState(user.user_metadata?.full_name || "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const active = subscriptionActive(subscription);
  const status = isOwner ? "Proprietário" : subscriptionLabels[subscription?.status] || "Acesso temporário";
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR") : "—";
  const grantEnd = grant?.expires_at ? new Date(grant.expires_at).toLocaleDateString("pt-BR") : "—";
  const canCancel = !isOwner && active && Boolean(subscription?.stripe_subscription_id) && !subscription?.cancel_at_period_end;

  async function submit(event) {
    event.preventDefault();
    await onSaveName(name);
  }

  async function confirmCancellation() {
    if (await onCancelSubscription()) setConfirmCancel(false);
  }

  return <div className="profile-layout">
    <section className="panel profile-details">
      <header><div className="profile-avatar"><UserRound size={24} /></div><div><h2>Dados da conta</h2><p>Informações usadas na sua identificação dentro do Clic Med.</p></div></header>
      <form onSubmit={submit}>
        <label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>E-mail<input value={user.email || ""} readOnly aria-readonly="true" /></label>
        <button className="primary-button" disabled={busy || name.trim() === (user.user_metadata?.full_name || "").trim()}>{busy ? "Salvando..." : "Salvar nome"}</button>
      </form>
      <button className="secondary-button profile-logout" onClick={onLogout}><LogOut size={17} />Sair da conta</button>
    </section>

    <section className="panel profile-plan">
      <header><span>Plano atual</span><strong className={active || isOwner || grant ? "active" : "inactive"}>{status}</strong></header>
      <div><span className="subscription-kicker">{isOwner ? "Clic Med Proprietário" : active ? "Clic Med Mensal" : "Acesso Clic Med"}</span><h2>{isOwner ? "Acesso permanente" : active ? "R$ 67,00 por mês" : "Acesso temporário"}</h2><p>{isOwner ? "Sua conta administrativa não depende de cobrança." : active ? "Agenda, pacientes, financeiro e relatórios em um único plano." : `Acesso liberado até ${grantEnd}.`}</p></div>
      <dl><div><dt>{subscription?.cancel_at_period_end ? "Acesso disponível até" : "Próxima renovação"}</dt><dd>{isOwner ? "Permanente" : active ? periodEnd : grantEnd}</dd></div><div><dt>Cancelamento</dt><dd>{isOwner ? "Não se aplica" : subscription?.cancel_at_period_end ? "Agendado" : "Não agendado"}</dd></div></dl>
      {subscription?.cancel_at_period_end && <p className="cancellation-note">A assinatura não será renovada. Seu acesso continua normalmente até {periodEnd}.</p>}
      {canCancel && !confirmCancel && <button className="secondary-button danger wide" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar assinatura</button>}
      {confirmCancel && <div className="cancel-confirm"><strong>Confirmar cancelamento?</strong><p>O plano será encerrado em {periodEnd}. Não haverá reembolso, e o acesso continuará até essa data.</p><div><button className="secondary-button" disabled={busy} onClick={() => setConfirmCancel(false)}>Voltar</button><button className="primary-button danger" disabled={busy} onClick={confirmCancellation}>{busy ? "Cancelando..." : "Confirmar cancelamento"}</button></div></div>}
    </section>
  </div>;
}

function AccessView({ grants, subscriptions, busy, onSave, onRevoke }) {
  const [form, setForm] = useState({ email: "", days: 3, notes: "" });
  async function submit(event) {
    event.preventDefault();
    if (await onSave(form)) setForm({ email: "", days: 3, notes: "" });
  }
  return <div className="access-layout">
    <section className="panel access-form-panel">
      <header><h2>Liberar acesso</h2><p>Informe o mesmo e-mail que a pessoa usará para criar a conta.</p></header>
      <form className="access-form" onSubmit={submit}>
        <label>E-mail autorizado<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="cliente@exemplo.com" required /></label>
        <label>Duração em dias<input type="number" min="1" max="365" value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} required /></label>
        <label>Observação<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Teste gratuito, plano mensal..." /></label>
        <button className="primary-button" disabled={busy}><ShieldCheck size={17} />{busy ? "Liberando..." : "Liberar acesso"}</button>
      </form>
      <p className="access-hint"><strong>Liberação manual:</strong> use para cortesias e testes especiais. Assinaturas pagas são liberadas automaticamente pela Stripe.</p>
    </section>
    <section className="panel grants-panel">
      <header><h2>Contas autorizadas</h2><p>{grants.length} {grants.length === 1 ? "liberação cadastrada" : "liberações cadastradas"}</p></header>
      <div className="grants-head"><span>E-mail</span><span>Validade</span><span>Status</span><span>Ação</span></div>
      {grants.length ? grants.map((grant) => {
        const valid = grant.active && new Date(grant.expires_at) > new Date();
        return <div className="grant-row" key={grant.id}><span><strong>{grant.email}</strong><small>{grant.notes || "Sem observação"}</small></span><span>{new Date(grant.expires_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span><em className={valid ? "active" : "expired"}>{valid ? "Ativo" : grant.active ? "Expirado" : "Bloqueado"}</em><div>{valid && <button className="secondary-button compact danger" disabled={busy} onClick={() => onRevoke(grant.id)}>Bloquear</button>}</div></div>;
      }) : <div className="empty-state"><ShieldCheck size={28} /><h3>Nenhum acesso liberado</h3><p>O seu e-mail de proprietário sempre terá acesso.</p></div>}
    </section>
    <section className="panel stripe-admin-panel">
      <header><h2>Assinaturas Stripe</h2><p>{subscriptions.length} {subscriptions.length === 1 ? "cliente conectado" : "clientes conectados"}</p></header>
      <div className="stripe-subscriptions-head"><span>Cliente</span><span>Status</span><span>Próxima renovação</span><span>Cancelamento</span></div>
      {subscriptions.length ? subscriptions.map((subscription) => <div className="stripe-subscription-row" key={subscription.id}><span><strong>{subscription.email}</strong><small>{subscription.stripe_customer_id}</small></span><em className={subscriptionActive(subscription) ? "active" : "inactive"}>{subscriptionLabels[subscription.status] || subscription.status}</em><span>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</span><span>{subscription.cancel_at_period_end ? "Ao fim do período" : "Não"}</span></div>) : <div className="empty-state"><CreditCard size={28} /><h3>Nenhuma assinatura Stripe</h3><p>As assinaturas aparecerão após o primeiro Checkout.</p></div>}
    </section>
  </div>;
}

function FinanceView({ totals, appointments, patients, selectedDate, professional, onEdit }) {
  const [reportMode, setReportMode] = useState("day");
  const [reportDay, setReportDay] = useState(dateKey(selectedDate));
  const [reportMonth, setReportMonth] = useState(dateKey(selectedDate).slice(0, 7));
  const reportAppointments = appointments.filter((appointment) => reportMode === "day" ? dateKey(appointment.starts_at) === reportDay : dateKey(appointment.starts_at).startsWith(reportMonth));
  const periodLabel = reportMode === "day"
    ? `Diario - ${formatDate(reportDay)}`
    : `Mensal - ${monthNames[Number(reportMonth.slice(5, 7)) - 1]} de ${reportMonth.slice(0, 4)}`;
  async function downloadReport() {
    const { generateFinancialReport } = await import("./lib/financialReport.js");
    generateFinancialReport({ appointments: reportAppointments, patients, professional, periodLabel, fileLabel: reportMode === "day" ? reportDay : reportMonth });
  }
  return <>
    <section className="panel report-panel">
      <div><h2>Relatório financeiro</h2><p>O PDF é gerado neste dispositivo e não envia os dados para terceiros.</p></div>
      <div className="report-controls">
        <div className="segmented"><button className={reportMode === "day" ? "active" : ""} onClick={() => setReportMode("day")}>Dia</button><button className={reportMode === "month" ? "active" : ""} onClick={() => setReportMode("month")}>Mês inteiro</button></div>
        {reportMode === "day" ? <input aria-label="Dia do relatório" type="date" value={reportDay} onChange={(event) => setReportDay(event.target.value)} /> : <input aria-label="Mês do relatório" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />}
        <button className="primary-button" onClick={downloadReport}><Download size={17} />Baixar PDF</button>
      </div>
      <small>{reportAppointments.length} {reportAppointments.length === 1 ? "lançamento será incluído" : "lançamentos serão incluídos"}</small>
    </section>
    <section className="finance-summary">
      <div className="chart-card"><div className="donut" style={{ "--angle": `${totals.percent * 3.6}deg` }}><div><strong>{totals.percent}%</strong><small>recebido</small></div></div><div className="chart-legend"><h2>Visão geral</h2><p><span><i className="received" />Recebido</span><strong>{currency.format(totals.received)}</strong></p><p><span><i className="pending" />Pendente</span><strong>{currency.format(totals.pending)}</strong></p></div></div>
      <div className="metric-card"><span>Recebido</span><strong>{currency.format(totals.received)}</strong><small>Pagamentos confirmados</small></div>
      <div className="metric-card"><span>Pendente</span><strong>{currency.format(totals.pending)}</strong><small>A receber</small></div>
      <div className="metric-card"><span>Ticket médio</span><strong>{currency.format(totals.ticket)}</strong><small>Por sessão cobrável</small></div>
    </section>
    <section className="panel finance-panel"><header><h2>Lançamentos</h2><p>Valores e datas registrados nas sessões.</p></header><div className="finance-table-head"><span>Paciente</span><span>Data da sessão</span><span>Valor</span><span>Situação</span><span>Pagamento</span><span>Ação</span></div>{appointments.length ? appointments.map((appointment) => { const patient = patients.find((item) => item.id === appointment.patient_id); return <div className="finance-row" key={appointment.id}><span><strong>{patient?.full_name || "Paciente"}</strong><small>{patient?.insurance || "—"}</small></span><span>{formatDate(dateKey(appointment.starts_at))}</span><strong>{currency.format(appointment.amount)}</strong><em className={appointment.payment_status.toLowerCase()}>{appointment.payment_status}</em><span>{formatDate(appointment.paid_on)}</span><button className="secondary-button compact" onClick={() => onEdit(appointment)}>Editar</button></div>; }) : <div className="empty-state"><WalletCards size={28} /><h3>Nenhum lançamento</h3><p>Os valores aparecerão quando você adicionar sessões.</p></div>}</section>
  </>;
}

function PatientModal({ patient, appointment, busy, onClose, onSave, onStatus }) {
  const remainingDays = daysUntil(patient.plan_expires_on);
  const progress = Math.min(100, Math.round((patient.sessions_completed / patient.sessions_total) * 100));
  return <Modal title={patient.full_name} subtitle={appointment ? `${formatDate(dateKey(appointment.starts_at))} • ${timeOf(appointment.starts_at)} - ${timeOf(appointment.ends_at)}` : "Prontuário do paciente"} onClose={onClose}>
    <div className="patient-highlights"><div className="expiry"><span>Vencimento do plano</span><strong>{remainingDays === null ? "Sem data" : remainingDays < 0 ? "Vencido" : `${remainingDays} dias`}</strong><small>{patient.plan_expires_on ? formatDate(patient.plan_expires_on) : "Defina uma data"}</small></div><div className="sessions"><span>Sessões do plano</span><strong>{patient.sessions_completed}/{patient.sessions_total}</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div><small>{Math.max(0, patient.sessions_total - patient.sessions_completed)} restantes</small></div></div>
    {appointment && <><div className="appointment-summary"><span className={`status-badge ${statusInfo[appointment.status]?.className}`}>{statusInfo[appointment.status]?.label}</span><span>{appointment.procedure}</span></div><div className="status-actions">{Object.entries(statusInfo).map(([key, info]) => <button key={key} className={appointment.status === key ? "active" : ""} disabled={busy} onClick={() => onStatus(key)}>{info.label}</button>)}</div></>}
    <PatientForm initial={patient} onSave={onSave} onCancel={onClose} busy={busy} submitLabel="Salvar prontuário" />
  </Modal>;
}

function NewAppointmentModal({ patients, selectedDate, busy, onClose, onSave }) {
  const [form, setForm] = useState({ patient_id: patients[0]?.id || "", date: dateKey(selectedDate), time: "09:00", procedure: "Psicoterapia individual", unit: "" });
  return <Modal title="Nova sessão" subtitle="Escolha a hora e os minutos. A duração padrão é de uma hora." onClose={onClose}>{patients.length ? <form className="compact-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}><label>Paciente<select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.full_name}</option>)}</select></label><div className="form-grid"><label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Horário<input type="time" min="08:00" max="17:00" step="60" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label></div><label>Procedimento<input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} required /></label><label>Local / unidade<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Adicionar à agenda"}</button></div></form> : <div className="empty-state"><UsersRound size={28} /><h3>Cadastre um paciente primeiro</h3><button className="secondary-button" onClick={onClose}>Fechar</button></div>}</Modal>;
}

function FinanceModal({ appointment, patient, busy, onClose, onSave }) {
  const [form, setForm] = useState({ amount: appointment.amount, payment_status: appointment.payment_status, paid_on: appointment.paid_on || "", session_date: dateKey(appointment.starts_at) });
  function submit(event) {
    event.preventDefault();
    const oldStart = new Date(appointment.starts_at);
    const newStart = new Date(`${form.session_date}T${String(oldStart.getHours()).padStart(2, "0")}:${String(oldStart.getMinutes()).padStart(2, "0")}:00`);
    const duration = new Date(appointment.ends_at) - oldStart;
    onSave({ amount: Number(form.amount), payment_status: form.payment_status, paid_on: form.payment_status === "Pago" ? form.paid_on : null, starts_at: newStart.toISOString(), ends_at: new Date(newStart.getTime() + duration).toISOString() });
  }
  return <Modal title="Editar lançamento" subtitle={patient?.full_name} onClose={onClose}><form className="compact-form" onSubmit={submit}><div className="form-grid"><label>Data da sessão<input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} required /></label><label>Valor<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label><label>Situação<select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value, paid_on: e.target.value === "Pago" ? form.paid_on || dateKey(new Date()) : "" })}><option>Pago</option><option>Pendente</option><option>Cancelado</option></select></label><label>Data do pagamento<input type="date" disabled={form.payment_status !== "Pago"} required={form.payment_status === "Pago"} value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div></form></Modal>;
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/conheca") return <LandingPage />;
  if (path === "/diagnostico") return <QuizPage />;
  return <DashboardApp />;
}
