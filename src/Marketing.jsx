import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  CreditCard,
  FileText,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";

const questions = [
  {
    title: "Em qual momento profissional você está hoje?",
    context: "Seu momento atual",
    options: [
      { label: "Estou organizando meus primeiros atendimentos", score: 0 },
      { label: "Atendo sozinho e minha agenda está crescendo", score: 1 },
      { label: "Tenho uma rotina estável e quero ganhar tempo", score: 1 },
      { label: "Organizo uma clínica com outros profissionais", score: 3 },
    ],
  },
  {
    title: "Quantas sessões você realiza por semana, em média?",
    context: "Volume de atendimentos",
    options: [
      { label: "Até 10 sessões", score: 0 },
      { label: "De 11 a 25 sessões", score: 1 },
      { label: "De 26 a 40 sessões", score: 3 },
      { label: "Mais de 40 sessões", score: 4 },
    ],
  },
  {
    title: "Onde ficam as informações do seu consultório hoje?",
    context: "Organização da rotina",
    options: [
      { label: "Uso um sistema, mas ainda mantenho controles por fora", score: 1, area: "base", areaWeight: 1 },
      { label: "Uso planilha para pacientes e financeiro", score: 2, area: "finance", areaWeight: 2 },
      { label: "Espalho entre agenda, WhatsApp e anotações", score: 3, area: "patients", areaWeight: 2 },
      { label: "Ainda não tenho um padrão único", score: 4, area: "base", areaWeight: 3 },
    ],
  },
  {
    title: "Qual tarefa mais consome sua atenção durante a semana?",
    context: "Principal ponto de atrito",
    options: [
      { label: "Conferir horários, faltas e reagendamentos", score: 2, area: "agenda", areaWeight: 7 },
      { label: "Saber quem pagou e o que está pendente", score: 3, area: "finance", areaWeight: 7 },
      { label: "Encontrar dados e histórico de cada paciente", score: 3, area: "patients", areaWeight: 7 },
      { label: "Montar totais e relatórios no fim do período", score: 4, area: "finance", areaWeight: 7 },
    ],
  },
  {
    title: "Quando alguém falta ou reagenda, como você atualiza a rotina?",
    context: "Mudanças do dia a dia",
    options: [
      { label: "Faço uma atualização manual em um único lugar", score: 1, area: "agenda", areaWeight: 1 },
      { label: "Corrijo a agenda e confiro o restante depois", score: 2, area: "agenda", areaWeight: 2 },
      { label: "Mudo agenda e financeiro separadamente", score: 3, area: "agenda", areaWeight: 3 },
      { label: "Às vezes alguma informação fica desatualizada", score: 4, area: "base", areaWeight: 3 },
    ],
  },
  {
    title: "Qual mudança você mais quer perceber nos próximos três meses?",
    context: "Resultado desejado",
    options: [
      { label: "Enxergar a semana com horários e mudanças organizados", score: 2, area: "agenda", areaWeight: 1 },
      { label: "Saber o que entrou e o que está pendente sem fechar planilha", score: 3, area: "finance", areaWeight: 1 },
      { label: "Encontrar as informações de cada paciente em um só lugar", score: 2, area: "patients", areaWeight: 1 },
      { label: "Ter agenda, pacientes e financeiro trabalhando juntos", score: 3, area: "base", areaWeight: 1 },
    ],
  },
];

const scoreRange = questions.reduce((range, question) => {
  const scores = question.options.map((option) => option.score);
  return {
    min: range.min + Math.min(...scores),
    max: range.max + Math.max(...scores),
  };
}, { min: 0, max: 0 });

const focusResults = {
  agenda: {
    label: "Agenda e sessões",
    title: "Sua agenda é o ponto que mais pede simplificação.",
    text: "Horários, faltas e reagendamentos ainda exigem conferências que poderiam acontecer em um único fluxo.",
    bullets: ["Sessões criadas a partir do cadastro", "Horários flexíveis e status por atendimento", "Alterações refletidas na visão da rotina"],
  },
  finance: {
    label: "Visibilidade financeira",
    title: "Seu financeiro precisa acompanhar as sessões sem depender de fechamento manual.",
    text: "A maior oportunidade está em transformar atendimentos e pagamentos em uma visão clara do período.",
    bullets: ["Pagamentos e pendências por paciente", "Totais atualizados conforme as sessões", "Relatórios financeiros por dia ou mês"],
  },
  patients: {
    label: "Pacientes e informações",
    title: "As informações dos pacientes ainda estão exigindo buscas e repetições.",
    text: "Centralizar cadastro, contatos e histórico reduz o trabalho de procurar dados antes e depois de cada sessão.",
    bullets: ["Cadastro administrativo em um só lugar", "Prontuário acessível a partir da agenda", "Dados conectados às sessões e ao financeiro"],
  },
  base: {
    label: "Rotina conectada",
    title: "Sua maior oportunidade está em fazer a gestão trabalhar como um único fluxo.",
    text: "A rotina já acontece, mas partes importantes ainda vivem separadas e dependem de atualização manual.",
    bullets: ["Cadastro e agenda conectados", "Sessões ligadas ao controle financeiro", "Informações atualizadas sem retrabalho"],
  },
};

const featureItems = [
  { icon: CalendarDays, title: "Agenda que nasce do cadastro", text: "Defina dias e horários do paciente uma vez e leve as sessões para a agenda." },
  { icon: UsersRound, title: "Pacientes e prontuários", text: "Reúna dados administrativos, contatos, plano, sessões e observações." },
  { icon: WalletCards, title: "Financeiro conectado", text: "Marque pagamentos, acompanhe pendências e gere relatórios por dia ou mês." },
];

function setPageMetadata(title, description) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

async function startTrial(origin) {
  if (!isSupabaseConfigured || !supabase) {
    window.location.assign(`/app?cadastro=1&origem=${encodeURIComponent(origin)}`);
    return;
  }
  const { data, error } = await supabase.functions.invoke("create-public-checkout-session", { body: { origin } });
  if (error || !data?.url) {
    window.alert(data?.error || error?.message || "Não foi possível abrir o checkout agora.");
    return;
  }
  window.location.assign(data.url);
}

function MarketingBrand() {
  return <a className="marketing-brand" href="/conheca" aria-label="Clic Med - início"><strong><span>Clic</span><span>Med</span></strong><small>Gestão para terapeutas</small></a>;
}

function MarketingHeader({ compact = false }) {
  return <header className={`marketing-header ${compact ? "compact" : ""}`}>
    <div className="marketing-header-inner">
      <MarketingBrand />
      <nav aria-label="Navegação principal">
        {!compact && <a href="#recursos">Recursos</a>}
        {!compact && <a href="#preco">Preço</a>}
        <a href="/app">Entrar</a>
        {!compact && <button onClick={() => startTrial("pagina_cabecalho")}>Testar grátis <ArrowRight size={16} /></button>}
      </nav>
    </div>
  </header>;
}

export function ProductPreview({ condensed = false }) {
  return <div className={`public-product-preview ${condensed ? "condensed" : ""}`} aria-label="Demonstração da agenda do Clic Med">
    <aside>
      <MarketingBrand />
      <div className="preview-nav">
        <span className="active"><CalendarDays size={16} />Agenda</span>
        <span><UsersRound size={16} />Pacientes</span>
        <span><WalletCards size={16} />Financeiro</span>
        <span><UserRound size={16} />Perfil</span>
      </div>
      <div className="preview-account"><i>MC</i><span><b>Marina Costa</b><small>Psicóloga</small></span></div>
    </aside>
    <section>
      <header><div><small>17 de agosto de 2026</small><h2>Agenda do dia</h2></div><button>+ Nova sessão</button></header>
      <div className="preview-toolbar"><span><b>Minha agenda</b><small>3 sessões agendadas</small></span><button><CalendarDays size={15} />17 ago 2026</button></div>
      <div className="preview-legend"><span><i className="green" />Presente</span><span><i className="blue" />Reembolso</span><span><i className="red" />Não compareceu</span></div>
      <div className="preview-schedule">
        <time>08:00</time><div className="preview-empty">Horário disponível</div>
        <time>09:00</time><div className="preview-session green"><span><b>Camila Andrade</b><small>Psicoterapia individual</small></span><em>09:00 - 10:00</em></div>
        <time>10:00</time><div className="preview-session blue"><span><b>Lucas Martins</b><small>Psicoterapia individual</small></span><em>10:25 - 11:25</em></div>
        <time>11:00</time><div className="preview-empty">Horário disponível</div>
        <time>12:00</time><div className="preview-session violet"><span><b>Fernanda Lima</b><small>Acompanhamento terapêutico</small></span><em>12:00 - 13:00</em></div>
      </div>
    </section>
  </div>;
}

export function ProductPreviewPage() {
  useEffect(() => setPageMetadata("Clic Med - Demonstração", "Demonstração visual do Clic Med."), []);
  return <main className="preview-capture-page"><ProductPreview /></main>;
}

export function LandingPage() {
  useEffect(() => setPageMetadata("Clic Med | Gestão simples para psicólogos", "Agenda, pacientes e financeiro em um só lugar para psicólogos e terapeutas autônomos."), []);
  return <main className="marketing-page">
    <MarketingHeader />
    <section className="marketing-hero">
      <div className="marketing-hero-overlay" />
      <div className="marketing-hero-content">
        <p className="marketing-kicker">Feito para psicólogos e terapeutas autônomos</p>
        <h1>Menos tempo organizando planilhas. Mais clareza para cuidar do consultório.</h1>
        <p>Agenda, pacientes, sessões e financeiro reunidos em um sistema simples de usar.</p>
        <div className="marketing-hero-actions">
          <button onClick={() => startTrial("pagina_hero")}>Testar grátis por 3 dias <ArrowRight size={18} /></button>
          <a href="#demonstracao">Ver como funciona</a>
        </div>
        <small><Check size={15} /> Depois, R$ 67 por mês. Cancele quando quiser.</small>
      </div>
    </section>

    <section className="marketing-proof-strip" aria-label="Principais benefícios">
      <div><span><Clock3 size={18} />Cadastro único</span><span><CircleCheck size={18} />Agenda integrada</span><span><FileText size={18} />Relatórios em PDF</span><span><CreditCard size={18} />3 dias gratuitos</span></div>
    </section>

    <section className="marketing-demo" id="demonstracao">
      <div className="marketing-section-head"><p className="marketing-kicker">Veja antes de testar</p><h2>Uma rotina inteira em uma única tela</h2><p>Cadastre o paciente, acompanhe as sessões e mantenha os valores atualizados sem repetir a mesma informação em vários lugares.</p></div>
      <img src="/clic-med-dashboard.png" alt="Tela da agenda do Clic Med com horários e sessões organizadas" />
    </section>

    <section className="marketing-features" id="recursos">
      <div className="marketing-section-head"><p className="marketing-kicker">O essencial, bem resolvido</p><h2>Comece pelo que mais toma tempo hoje</h2></div>
      <div className="marketing-feature-list">
        {featureItems.map(({ icon: Icon, title, text }, index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><Icon size={22} /><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </section>

    <section className="marketing-workflow">
      <div><p className="marketing-kicker">Percepção rápida de valor</p><h2>Em poucos minutos, sua primeira sessão já pode estar organizada.</h2></div>
      <ol><li><span>1</span><div><b>Comece pelo teste</b><p>Informe seus dados no checkout seguro da Stripe.</p></div></li><li><span>2</span><div><b>Crie seu acesso</b><p>Use o mesmo e-mail para entrar no Clic Med.</p></div></li><li><span>3</span><div><b>Acompanhe tudo</b><p>Agenda e financeiro passam a trabalhar juntos.</p></div></li></ol>
    </section>

    <section className="marketing-price" id="preco">
      <div><p className="marketing-kicker">Plano de lançamento</p><h2>Teste o Clic Med na sua rotina</h2><p>Explore todas as funções por três dias antes da primeira cobrança.</p></div>
      <div className="marketing-price-summary"><span>Plano mensal</span><strong><small>R$</small> 67 <small>/mês</small></strong><ul><li><Check size={17} />3 dias gratuitos</li><li><Check size={17} />Todas as funções do sistema</li><li><Check size={17} />Cancelamento pelo próprio perfil</li></ul><button onClick={() => startTrial("pagina_preco")}>Começar teste gratuito <ArrowRight size={18} /></button><small>A cobrança começa após o período de teste.</small></div>
    </section>

    <section className="marketing-final-cta"><div><h2>Sua planilha não precisa continuar sendo o centro do consultório.</h2><p>Teste com seus próprios atendimentos durante três dias.</p></div><button onClick={() => startTrial("pagina_final")}>Testar o Clic Med <ArrowRight size={18} /></button></section>
    <footer className="marketing-footer"><MarketingBrand /><span>© 2026 Clic Med</span><a href="/app">Acessar conta</a></footer>
  </main>;
}

function scoreResult(score) {
  if (score <= 72) return { label: "Base pronta para centralizar", tone: "low" };
  if (score <= 86) return { label: "Rotina manual em transição", tone: "medium" };
  return { label: "Gestão pedindo automação", tone: "high" };
}

function getFocusArea(answers) {
  const totals = answers.reduce((areas, answer) => {
    if (answer.area) areas[answer.area] = (areas[answer.area] || 0) + (answer.areaWeight || 1);
    return areas;
  }, {});
  return Object.entries(totals).sort((first, second) => second[1] - first[1])[0]?.[0] || "base";
}

export function QuizPage() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const finished = started && !processing && step >= questions.length;
  const score = useMemo(() => {
    const rawScore = answers.reduce((sum, answer) => sum + answer.score, 0);
    const normalized = (rawScore - scoreRange.min) / (scoreRange.max - scoreRange.min);
    return Math.max(60, Math.min(100, 60 + Math.round(normalized * 40)));
  }, [answers]);
  const profile = scoreResult(score);
  const focusArea = useMemo(() => getFocusArea(answers), [answers]);
  const focus = focusResults[focusArea];
  const progress = !started ? 0 : (processing || finished ? 100 : Math.round(((step + 1) / questions.length) * 100));

  useEffect(() => setPageMetadata("Diagnóstico da rotina | Clic Med", "Descubra o potencial de simplificação da gestão do seu consultório em seis perguntas."), []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [started, step, processing]);
  useEffect(() => {
    if (!processing) return undefined;
    const timer = window.setTimeout(() => setProcessing(false), 1700);
    return () => window.clearTimeout(timer);
  }, [processing]);

  function answerQuestion(option) {
    setAnswers((current) => [...current.slice(0, step), option]);
    if (step === questions.length - 1) setProcessing(true);
    setStep((current) => current + 1);
  }

  function goBack() {
    if (!started) window.location.assign("/conheca");
    else if (step === 0) setStarted(false);
    else setStep((current) => current - 1);
  }

  function restart() { setAnswers([]); setStep(0); setStarted(false); setProcessing(false); }

  return <main className="quiz-page">
    <MarketingHeader compact />
    <div className="quiz-progress" aria-label={`Progresso: ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
    {!started ? <section className="quiz-intro">
      <div className="quiz-intro-copy">
        <p className="marketing-kicker">Diagnóstico da rotina do consultório</p>
        <h1>Quanto da sua gestão ainda depende de tarefas manuais?</h1>
        <p>Responda seis perguntas rápidas e descubra onde o Clic Med pode simplificar sua rotina primeiro.</p>
        <div className="quiz-intro-points">
          <span><Clock3 size={18} /><b>Menos de 2 minutos</b></span>
          <span><ShieldCheck size={18} /><b>Sem cadastro inicial</b></span>
          <span><CircleCheck size={18} /><b>Resultado personalizado</b></span>
        </div>
        <button className="quiz-primary quiz-start" onClick={() => setStarted(true)}>Começar meu diagnóstico <ArrowRight size={18} /></button>
        <small>Não existe resposta certa. Escolha o que mais se aproxima da sua rotina.</small>
      </div>
      <aside className="quiz-intro-preview">
        <p>O que vamos analisar</p>
        <div className="quiz-intro-focus">
          <span><CalendarDays size={19} /><b>Agenda</b><small>Horários, faltas e reagendamentos</small></span>
          <span><UsersRound size={19} /><b>Pacientes</b><small>Cadastro e informações da rotina</small></span>
          <span><WalletCards size={19} /><b>Financeiro</b><small>Pagamentos, pendências e relatórios</small></span>
        </div>
        <img src="/clic-med-dashboard.png" alt="Agenda e gestão do Clic Med" />
      </aside>
    </section> : processing ? <section className="quiz-processing" aria-live="polite">
      <span className="quiz-processing-spinner" aria-hidden="true" />
      <p className="marketing-kicker">Analisando sua rotina</p>
      <h1>Identificando onde você pode ganhar mais clareza primeiro...</h1>
      <div><span><Check size={17} />Cruzando volume e organização</span><span><Check size={17} />Priorizando o principal gargalo</span><span><Check size={17} />Preparando sua recomendação</span></div>
    </section> : !finished ? <section className="quiz-shell">
      <div className="quiz-question">
        <button className="quiz-back" onClick={goBack}><ChevronLeft size={18} />Voltar</button>
        <p className="marketing-kicker">{questions[step].context} · Pergunta {step + 1} de {questions.length}</p>
        <h1>{questions[step].title}</h1>
        <div className="quiz-options">
          {questions[step].options.map((option) => <button key={option.label} onClick={() => answerQuestion(option)}><span>{option.label}</span><ChevronRight size={19} /></button>)}
        </div>
        <small>Não existe resposta certa. Use a opção que mais se aproxima da sua rotina.</small>
      </div>
    </section> : <section className="quiz-result">
      <div className="quiz-result-copy">
        <span className={`quiz-result-label ${profile.tone}`}>{profile.label}</span>
        <p className="marketing-kicker">Seu resultado</p>
        <h1>{focus.title}</h1>
        <p>{focus.text}</p>
        <div className="quiz-score"><div><span>Potencial de simplificação</span><strong>{score}%</strong></div><div><i style={{ width: `${score}%` }} /></div></div>
        <div className="quiz-focus-label"><span>Gargalo principal</span><strong>{focus.label}</strong></div>
        <ul>{focus.bullets.map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul>
        <div className="quiz-offer"><span>Seu benefício para começar</span><strong>3 dias grátis</strong><small>Depois, R$ 67 por mês. Cancele quando quiser.</small></div>
        <button className="quiz-primary" onClick={() => startTrial(`quiz_resultado_${profile.tone}_${focusArea}`)}>Testar o Clic Med por 3 dias <ArrowRight size={18} /></button>
        <button className="quiz-restart" onClick={restart}>Refazer diagnóstico</button>
      </div>
    </section>}
  </main>;
}
