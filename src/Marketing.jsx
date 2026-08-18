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
  Download,
  FileText,
  Pause,
  Play,
  Plus,
  Search,
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
  { icon: CalendarDays, label: "Agenda", title: "Horários e sessões sem retrabalho", text: "Defina a rotina do paciente no cadastro e acompanhe presenças, faltas e reagendamentos em uma agenda clara." },
  { icon: UsersRound, label: "Pacientes", title: "As informações certas em um só lugar", text: "Centralize contatos, plano, sessões e observações para encontrar o que precisa antes de cada atendimento." },
  { icon: WalletCards, label: "Financeiro", title: "Valores que acompanham os atendimentos", text: "Registre pagamentos, veja pendências e baixe relatórios por dia ou mês sem fechar outra planilha." },
];

const painItems = [
  { icon: CalendarDays, title: "Horários espalhados", text: "A agenda muda, mas a planilha continua desatualizada." },
  { icon: UsersRound, title: "Informações repetidas", text: "O mesmo paciente aparece em anotações, agenda e controles diferentes." },
  { icon: WalletCards, title: "Financeiro no escuro", text: "É difícil saber o que entrou e o que ainda está pendente." },
];

const faqItems = [
  { question: "Para quem o Clic Med foi criado?", answer: "Para psicólogos e terapeutas autônomos que querem organizar pacientes, agenda e financeiro sem depender de várias planilhas." },
  { question: "O que acontece depois dos três dias gratuitos?", answer: "A assinatura mensal de R$ 67 começa automaticamente no cartão informado no checkout. Você pode cancelar pelo próprio perfil antes da renovação." },
  { question: "Preciso instalar algum programa?", answer: "Não. O Clic Med funciona pelo navegador no computador ou no celular." },
  { question: "Posso escolher horários fora do padrão de uma hora?", answer: "Sim. Ao criar uma sessão, você pode informar horários específicos, como 10:25, e manter a duração adequada ao atendimento." },
  { question: "Consigo baixar um relatório financeiro?", answer: "Sim. O financeiro permite gerar relatórios em PDF por um dia escolhido ou pelo mês completo." },
];

const productSlides = [
  { id: "agenda", label: "Agenda", description: "Horários e sessões do dia" },
  { id: "patients", label: "Pacientes", description: "Cadastro e prontuário conectados" },
  { id: "finance", label: "Financeiro", description: "Recebimentos e visão do mês" },
];

const financePreviewRows = [
  { patient: "Camila Andrade", date: "05 ago 2026", status: "Pago", value: "R$ 480,00" },
  { patient: "Lucas Martins", date: "08 ago 2026", status: "Pago", value: "R$ 720,00" },
  { patient: "Fernanda Lima", date: "12 ago 2026", status: "Pendente", value: "R$ 560,00" },
  { patient: "Rafael Nogueira", date: "15 ago 2026", status: "Pago", value: "R$ 640,00" },
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

function PreviewAgenda() {
  return <>
    <div className="preview-toolbar"><span><b>Minha agenda</b><small>3 sessões agendadas</small></span><button><CalendarDays size={15} />17 ago 2026</button></div>
    <div className="preview-legend"><span><i className="green" />Presente</span><span><i className="blue" />Reembolso</span><span><i className="red" />Não compareceu</span></div>
    <div className="preview-schedule">
      <time>08:00</time><div className="preview-empty">Horário disponível</div>
      <time>09:00</time><div className="preview-session green"><span><b>Camila Andrade</b><small>Psicoterapia individual</small></span><em>09:00 - 10:00</em></div>
      <time>10:00</time><div className="preview-session blue"><span><b>Lucas Martins</b><small>Psicoterapia individual</small></span><em>10:25 - 11:25</em></div>
      <time>11:00</time><div className="preview-empty">Horário disponível</div>
      <time>12:00</time><div className="preview-session violet"><span><b>Fernanda Lima</b><small>Acompanhamento terapêutico</small></span><em>12:00 - 13:00</em></div>
    </div>
  </>;
}

function PreviewPatients() {
  return <div className="preview-patient-layout">
    <div className="preview-patient-form">
      <div className="preview-panel-heading"><span><b>Dados do paciente</b><small>Informações administrativas e de contato</small></span><span className="preview-step">1 de 2</span></div>
      <div className="preview-form-grid">
        <label className="wide"><span>Nome completo</span><strong>Beatriz Almeida</strong></label>
        <label><span>E-mail</span><strong>beatriz@email.com</strong></label>
        <label><span>Contato do responsável</span><strong>(81) 99945-2108</strong></label>
        <label><span>Convênio</span><strong>Particular</strong></label>
        <label><span>CID / Laudo</span><strong>Em avaliação</strong></label>
      </div>
      <div className="preview-panel-heading schedule"><span><b>Rotina de sessões</b><small>Os horários irão direto para a agenda</small></span></div>
      <div className="preview-session-rule"><CalendarDays size={17} /><span><b>Terças e quintas</b><small>10:25 - 11:25 · Psicoterapia individual</small></span><i>Semanal</i></div>
    </div>
    <aside className="preview-record-card">
      <span className="preview-avatar">BA</span>
      <div><b>Beatriz Almeida</b><small>Novo prontuário</small></div>
      <dl><div><dt>Plano</dt><dd>Particular</dd></div><div><dt>Sessões</dt><dd>2 por semana</dd></div><div><dt>Valor</dt><dd>R$ 140,00</dd></div><div><dt>Próxima sessão</dt><dd>Ter, 10:25</dd></div></dl>
      <span className="preview-ready"><CircleCheck size={15} />Pronto para adicionar</span>
    </aside>
  </div>;
}

function PreviewFinance() {
  return <>
    <div className="preview-finance-metrics">
      <div><span>Receita do mês</span><strong>R$ 4.840,00</strong><small>32 sessões registradas</small></div>
      <div><span>Recebido</span><strong>R$ 3.960,00</strong><small className="positive">+12% em relação a julho</small></div>
      <div><span>Pendente</span><strong>R$ 880,00</strong><small>4 pagamentos em aberto</small></div>
      <div className="preview-donut" aria-label="82% recebido"><i><strong>82%</strong><small>recebido</small></i></div>
    </div>
    <div className="preview-finance-table">
      <div className="preview-table-heading"><span><b>Pagamentos de agosto</b><small>Valores atualizados pelas sessões</small></span><label><Search size={14} />Buscar paciente</label></div>
      <div className="preview-table-row header"><span>Paciente</span><span>Data</span><span>Status</span><span>Valor</span></div>
      {financePreviewRows.map((row) => <div className="preview-table-row" key={row.patient}><span><i>{row.patient.split(" ").map((name) => name[0]).slice(0, 2).join("")}</i><b>{row.patient}</b></span><span>{row.date}</span><span><em className={row.status === "Pago" ? "paid" : "pending"}>{row.status}</em></span><span><b>{row.value}</b></span></div>)}
      <div className="preview-table-total"><span>Total exibido</span><strong>R$ 2.400,00</strong></div>
    </div>
  </>;
}

export function ProductPreview({ condensed = false, view = "agenda" }) {
  const page = productSlides.find((slide) => slide.id === view) || productSlides[0];
  const isAgenda = view === "agenda";
  const isPatients = view === "patients";
  return <div className={`public-product-preview ${condensed ? "condensed" : ""}`} aria-label={`Demonstração: ${page.label} do Clic Med`}>
    <aside>
      <MarketingBrand />
      <div className="preview-nav">
        <span className={isAgenda ? "active" : ""}><CalendarDays size={16} />Agenda</span>
        <span className={isPatients ? "active" : ""}><UsersRound size={16} />Pacientes</span>
        <span className={view === "finance" ? "active" : ""}><WalletCards size={16} />Financeiro</span>
        <span><UserRound size={16} />Perfil</span>
      </div>
      <div className="preview-account"><i>MC</i><span><b>Marina Costa</b><small>Psicóloga</small></span></div>
    </aside>
    <section>
      <header><div><small>{isAgenda ? "17 de agosto de 2026" : page.description}</small><h2>{isAgenda ? "Agenda do dia" : isPatients ? "Adicionar paciente" : "Visão financeira"}</h2></div><button>{isAgenda ? <><Plus size={15} />Nova sessão</> : isPatients ? <><Plus size={15} />Salvar paciente</> : <><Download size={15} />Baixar relatório</>}</button></header>
      {isAgenda ? <PreviewAgenda /> : isPatients ? <PreviewPatients /> : <PreviewFinance />}
    </section>
  </div>;
}

function ProductShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % productSlides.length), 4800);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const selectSlide = (index) => {
    setActiveSlide(index);
    setIsPlaying(false);
  };
  const changeSlide = (direction) => {
    setActiveSlide((current) => (current + direction + productSlides.length) % productSlides.length);
    setIsPlaying(false);
  };

  return <div className="marketing-hero-product" id="demonstracao">
    <div className="marketing-browser-bar"><i /><i /><i /><span>app.clicmed.com.br</span></div>
    <div className="marketing-showcase-stage" key={productSlides[activeSlide].id}><ProductPreview condensed view={productSlides[activeSlide].id} /></div>
    <div className="marketing-showcase-controls">
      <div role="tablist" aria-label="Telas do Clic Med">
        {productSlides.map((slide, index) => <button key={slide.id} role="tab" aria-selected={activeSlide === index} onClick={() => selectSlide(index)}><span>{slide.label}</span><small>{slide.description}</small></button>)}
      </div>
      <span className="marketing-showcase-buttons">
        <button aria-label="Tela anterior" onClick={() => changeSlide(-1)}><ChevronLeft size={17} /></button>
        <button aria-label={isPlaying ? "Pausar demonstração" : "Continuar demonstração"} onClick={() => setIsPlaying((playing) => !playing)}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
        <button aria-label="Próxima tela" onClick={() => changeSlide(1)}><ChevronRight size={17} /></button>
      </span>
    </div>
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
      <div className="marketing-hero-content">
        <p className="marketing-kicker"><span /> Gestão simples para psicólogos e terapeutas</p>
        <h1>Seu consultório organizado <span>sem depender de planilhas.</span></h1>
        <p>Cadastre o paciente uma vez e acompanhe agenda, sessões, pagamentos e relatórios no mesmo lugar.</p>
        <div className="marketing-hero-actions">
          <button onClick={() => startTrial("pagina_hero")}>Testar grátis por 3 dias <ArrowRight size={18} /></button>
          <a href="#demonstracao">Conhecer o sistema</a>
        </div>
        <small><Check size={15} /> Depois, R$ 67 por mês <i /> Cancele quando quiser</small>
      </div>
      <ProductShowcase />
    </section>

    <section className="marketing-proof-strip" aria-label="Principais benefícios">
      <div><span><Clock3 size={18} /><b>Cadastro único</b><small>Registre uma vez</small></span><span><CircleCheck size={18} /><b>Agenda integrada</b><small>Veja a rotina do dia</small></span><span><FileText size={18} /><b>Relatórios em PDF</b><small>Baixe por dia ou mês</small></span><span><CreditCard size={18} /><b>3 dias gratuitos</b><small>Teste na sua rotina</small></span></div>
    </section>

    <section className="marketing-problem">
      <div className="marketing-section-head"><p className="marketing-kicker">O problema não é atender</p><h2>É precisar reorganizar o consultório depois de cada atendimento.</h2><p>Quando agenda, pacientes e financeiro vivem separados, uma mudança simples vira várias tarefas manuais.</p></div>
      <div className="marketing-pain-list">
        {painItems.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={21} /><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </section>

    <section className="marketing-features" id="recursos">
      <div className="marketing-section-head"><p className="marketing-kicker">Tudo conversa entre si</p><h2>Cadastre uma vez. A rotina acompanha.</h2><p>O Clic Med conecta as três áreas que mais exigem atualização no dia a dia do consultório.</p></div>
      <div className="marketing-feature-list">
        {featureItems.map(({ icon: Icon, label, title, text }, index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><Icon size={22} /><div><small>{label}</small><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </section>

    <section className="marketing-connection">
      <p className="marketing-kicker">Seu primeiro ganho rápido</p>
      <h2>Marque um pagamento e veja o financeiro se atualizar. Altere uma sessão e mantenha a agenda certa.</h2>
      <a href="#preco">Começar com meus atendimentos <ArrowRight size={18} /></a>
    </section>

    <section className="marketing-workflow">
      <div><p className="marketing-kicker">Comece sem complicação</p><h2>Sua primeira sessão organizada em três passos.</h2><p>Você não precisa migrar toda a rotina de uma vez. Comece com os próximos atendimentos e perceba o valor no uso.</p></div>
      <ol><li><span>1</span><div><b>Ative seu teste</b><p>Informe seus dados no checkout seguro da Stripe.</p></div></li><li><span>2</span><div><b>Cadastre o primeiro paciente</b><p>Adicione contatos, valor e a rotina de sessões.</p></div></li><li><span>3</span><div><b>Acompanhe a agenda e o financeiro</b><p>Os atendimentos passam a fazer parte do mesmo fluxo.</p></div></li></ol>
    </section>

    <section className="marketing-price" id="preco">
      <div><p className="marketing-kicker">Um plano simples</p><h2>O essencial para organizar seu consultório por R$ 67 ao mês.</h2><p>Use todas as funções durante três dias e decida com a sua própria rotina, antes da primeira cobrança.</p><div className="marketing-price-note"><ShieldCheck size={20} /><span><b>Pagamento seguro pela Stripe</b><small>Seus dados de cartão não ficam armazenados no Clic Med.</small></span></div></div>
      <div className="marketing-price-summary"><span>Plano Clic Med</span><strong><small>R$</small> 67 <small>/mês</small></strong><p>Três dias gratuitos para começar.</p><ul><li><Check size={17} />Agenda, pacientes e financeiro</li><li><Check size={17} />Relatórios financeiros em PDF</li><li><Check size={17} />Todas as atualizações do plano</li><li><Check size={17} />Cancelamento pelo próprio perfil</li></ul><button onClick={() => startTrial("pagina_preco")}>Testar grátis por 3 dias <ArrowRight size={18} /></button><small>A cobrança começa após o período de teste.</small></div>
    </section>

    <section className="marketing-faq">
      <div className="marketing-section-head"><p className="marketing-kicker">Dúvidas frequentes</p><h2>Antes de começar</h2><p>As respostas essenciais para testar o Clic Med com tranquilidade.</p></div>
      <div className="marketing-faq-list">
        {faqItems.map(({ question, answer }) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
      </div>
    </section>

    <section className="marketing-final-cta"><div><p className="marketing-kicker">Comece pela próxima sessão</p><h2>Sua planilha não precisa continuar sendo o centro do consultório.</h2><p>Teste o Clic Med com seus próprios atendimentos durante três dias.</p></div><button onClick={() => startTrial("pagina_final")}>Testar grátis por 3 dias <ArrowRight size={18} /></button></section>
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
