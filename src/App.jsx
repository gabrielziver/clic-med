import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LogOut,
  Plus,
  Search,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const shortWeekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statusInfo = {
  presente: { label: "Presente", className: "present" },
  faltou_assinou: { label: "Faltou, mas terá reembolso", className: "charged-absence" },
  nao_compareceu: { label: "Não compareceu", className: "absence" },
  reagendado: { label: "Reagendado", className: "rescheduled" },
};

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
    guardian: "",
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

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">FM</div>
      <div><strong>Fluxa Med</strong><span>Gestão para terapeutas</span></div>
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
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
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : result.error.message);
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
            <h2>{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2>
            <p>{mode === "login" ? "Entre para continuar no Fluxa Med." : "Comece a organizar seus atendimentos."}</p>
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

function PatientForm({ initial, onSave, onCancel, busy, submitLabel = "Cadastrar paciente" }) {
  const [form, setForm] = useState(() => ({ ...emptyPatient(), ...initial, schedule_text: initial?.schedule?.join(", ") || initial?.schedule_text || "" }));
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function submit(event) {
    event.preventDefault();
    onSave({
      ...form,
      weekly_sessions: Number(form.weekly_sessions),
      session_value: Number(form.session_value),
      sessions_completed: Math.min(Number(form.sessions_completed), Number(form.sessions_total)),
      sessions_total: Number(form.sessions_total),
      schedule: form.schedule_text.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
    });
  }
  return (
    <form className="patient-form" onSubmit={submit}>
      <section className="form-section">
        <div className="form-section-head"><h2>Dados do paciente</h2><p>Informações da agenda, do plano e do financeiro.</p></div>
        <div className="form-grid three">
          <label className="span-2">Nome completo<input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required /></label>
          <label>Responsável<input value={form.guardian || ""} onChange={(e) => update("guardian", e.target.value)} /></label>
          <label>Convênio<select value={form.insurance} onChange={(e) => update("insurance", e.target.value)}><option>Particular</option><option>Unimed</option><option>Bradesco Saúde</option><option>SulAmérica</option><option>Outro</option></select></label>
          <label>CID / Laudo<input value={form.cid || ""} onChange={(e) => update("cid", e.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(e) => update("status", e.target.value)}><option>Ativo</option><option>Pausado</option></select></label>
          <label className="span-2">Terapia / acompanhamento<input value={form.therapies} onChange={(e) => update("therapies", e.target.value)} required /></label>
          <label>Valor por sessão<input type="number" min="0" step="0.01" value={form.session_value} onChange={(e) => update("session_value", e.target.value)} required /></label>
          <label>Sessões por semana<input type="number" min="1" max="7" value={form.weekly_sessions} onChange={(e) => update("weekly_sessions", e.target.value)} required /></label>
          <label className="span-2">Dias e horários<input value={form.schedule_text} onChange={(e) => update("schedule_text", e.target.value)} placeholder="Segunda 09:00, Quarta 09:00" required /></label>
        </div>
      </section>
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

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
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

  useEffect(() => { if (session) loadData(); }, [session]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setDataLoading(true);
    setError("");
    const [patientResult, appointmentResult] = await Promise.all([
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("appointments").select("*").order("starts_at"),
    ]);
    setDataLoading(false);
    if (patientResult.error || appointmentResult.error) {
      setError(patientResult.error?.message || appointmentResult.error?.message);
      return;
    }
    setPatients(patientResult.data || []);
    setAppointments(appointmentResult.data || []);
  }

  async function savePatient(values, patientId = null) {
    setBusy(true);
    setError("");
    const payload = { ...values, user_id: session.user.id };
    delete payload.schedule_text;
    const query = patientId ? supabase.from("patients").update(payload).eq("id", patientId) : supabase.from("patients").insert(payload);
    const { error: saveError } = await query;
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setModal(null);
    setPatientView("list");
    setToast(patientId ? "Prontuário atualizado." : "Paciente cadastrado.");
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

  if (!isSupabaseConfigured) return <main className="setup-page"><section><Brand /><h1>Conecte o banco para iniciar</h1><p>As variáveis do Supabase ainda não foram configuradas.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></section></main>;
  if (authLoading) return <main className="loading-page"><Brand /><span className="spinner" /></main>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;

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
        </nav>
        <div className="sidebar-metric"><span>Entradas</span><strong>{currency.format(totals.received)}</strong><small>{currency.format(totals.pending)} pendente</small></div>
        <button className="account-button" onClick={() => supabase.auth.signOut()}><UserRound size={18} /><span>{session.user.email}</span><LogOut size={17} /></button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{activeTab === "agenda" ? longDate(selectedDate) : activeTab === "pacientes" ? `${patients.filter((p) => p.status === "Ativo").length} pacientes ativos` : `${monthNames[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}`}</p><h1>{activeTab === "agenda" ? "Agenda do dia" : activeTab === "pacientes" ? "Cadastro de pacientes" : "Financeiro geral"}</h1></div>
          <button className="primary-button" onClick={() => activeTab === "pacientes" ? setPatientView("add") : setModal({ type: "appointment-new" })}><Plus size={18} />{activeTab === "pacientes" ? "Novo paciente" : "Nova sessão"}</button>
        </header>

        <nav className="mobile-tabs">
          <button className={activeTab === "agenda" ? "active" : ""} onClick={() => setActiveTab("agenda")}>Agenda</button>
          <button className={activeTab === "pacientes" ? "active" : ""} onClick={() => setActiveTab("pacientes")}>Pacientes</button>
          <button className={activeTab === "financeiro" ? "active" : ""} onClick={() => setActiveTab("financeiro")}>Financeiro</button>
        </nav>

        {error && <div className="error-banner">{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {dataLoading ? <div className="content-loading"><span className="spinner" />Carregando dados...</div> : (
          <>
            {activeTab === "agenda" && <AgendaView appointments={appointments} daily={dailyAppointments} patients={patients} selectedDate={selectedDate} setSelectedDate={setSelectedDate} calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen} openAppointment={(appointment) => setModal({ type: "patient", patientId: appointment.patient_id, appointmentId: appointment.id })} />}
            {activeTab === "pacientes" && <PatientsView view={patientView} setView={setPatientView} patients={filteredPatients} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} insuranceFilter={insuranceFilter} setInsuranceFilter={setInsuranceFilter} onOpen={(patient) => setModal({ type: "patient", patientId: patient.id })} onSave={(values) => savePatient(values)} busy={busy} />}
            {activeTab === "financeiro" && <FinanceView totals={totals} appointments={appointments} patients={patients} onEdit={(appointment) => setModal({ type: "finance", appointmentId: appointment.id })} />}
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
  const hours = Array.from({ length: 10 }, (_, index) => index + 8);
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
        {hours.map((hour) => {
          const appointment = daily.find((item) => new Date(item.starts_at).getHours() === hour);
          const patient = appointment ? patients.find((item) => item.id === appointment.patient_id) : null;
          return <div className="time-slot" key={hour}><time>{String(hour).padStart(2, "0")}:00</time>{appointment ? <button className={`appointment-card ${statusInfo[appointment.status]?.className}`} onClick={() => openAppointment(appointment)}><span><strong>{patient?.full_name || "Paciente"}</strong><b>{timeOf(appointment.starts_at)} - {timeOf(appointment.ends_at)}</b></span><span><small>{appointment.procedure}</small><em>{statusInfo[appointment.status]?.label}</em></span></button> : <div className="empty-slot">Horário disponível</div>}</div>;
        })}
        <div className="timeline-end">18:00</div>
      </div></div>
    </section>
  );
}

function PatientsView({ view, setView, patients, search, setSearch, statusFilter, setStatusFilter, insuranceFilter, setInsuranceFilter, onOpen, onSave, busy }) {
  return <section className="panel patient-panel">
    <nav className="subtabs"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Lista de pacientes</button><button className={view === "add" ? "active" : ""} onClick={() => setView("add")}>Adicionar paciente</button></nav>
    {view === "list" ? <>
      <div className="filters"><label>Buscar<div className="input-with-icon"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do paciente" /></div></label><label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Todos</option><option>Ativo</option><option>Pausado</option></select></label><label>Convênio<select value={insuranceFilter} onChange={(e) => setInsuranceFilter(e.target.value)}><option>Todos</option><option>Particular</option><option>Unimed</option><option>Bradesco Saúde</option><option>SulAmérica</option><option>Outro</option></select></label></div>
      <div className="patient-table-head"><span>Nome</span><span>CID</span><span>Convênio</span><span>Sessões</span><span>Status</span></div>
      <div>{patients.length ? patients.map((patient) => <button className="patient-row" key={patient.id} onClick={() => onOpen(patient)}><span><strong>{patient.full_name}</strong><small>{patient.therapies}</small></span><b>{patient.cid || "—"}</b><span>{patient.insurance}</span><span>{patient.weekly_sessions} / semana</span><em>{patient.status}</em></button>) : <div className="empty-state"><UsersRound size={28} /><h3>Nenhum paciente encontrado</h3><p>Cadastre o primeiro paciente para começar.</p><button className="primary-button" onClick={() => setView("add")}><Plus size={17} />Adicionar paciente</button></div>}</div>
    </> : <PatientForm onSave={onSave} onCancel={() => setView("list")} busy={busy} />}
  </section>;
}

function FinanceView({ totals, appointments, patients, onEdit }) {
  return <>
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
  return <Modal title="Nova sessão" subtitle="A duração padrão é de uma hora." onClose={onClose}>{patients.length ? <form className="compact-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}><label>Paciente<select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.full_name}</option>)}</select></label><div className="form-grid"><label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Horário<select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>{Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, "0")}:00`).map((time) => <option key={time}>{time}</option>)}</select></label></div><label>Procedimento<input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} required /></label><label>Local / unidade<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Adicionar à agenda"}</button></div></form> : <div className="empty-state"><UsersRound size={28} /><h3>Cadastre um paciente primeiro</h3><button className="secondary-button" onClick={onClose}>Fechar</button></div>}</Modal>;
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

export default App;
