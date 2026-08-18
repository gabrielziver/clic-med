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
    title: "Como você organiza hoje os dados dos seus pacientes?",
    context: "Cadastro e prontuário",
    options: [
      { label: "Uso um sistema organizado", score: 0 },
      { label: "Uso uma planilha", score: 2 },
      { label: "Uso agenda, anotações e arquivos separados", score: 3 },
      { label: "Ainda não tenho um padrão", score: 4 },
    ],
  },
  {
    title: "Quanto trabalho dá para manter sua agenda atualizada?",
    context: "Agenda de atendimentos",
    options: [
      { label: "Quase nenhum, já é automático", score: 0 },
      { label: "Atualizo manualmente, mas é tranquilo", score: 1 },
      { label: "Repito informações em mais de um lugar", score: 3 },
      { label: "Às vezes perco horários ou alterações", score: 4 },
    ],
  },
  {
    title: "Como você acompanha sessões pagas e valores pendentes?",
    context: "Controle financeiro",
    options: [
      { label: "Tenho uma visão atualizada e confiável", score: 0 },
      { label: "Confiro tudo manualmente no fim do mês", score: 2 },
      { label: "Preciso cruzar planilha, agenda e extrato", score: 3 },
      { label: "Não consigo ver o total com facilidade", score: 4 },
    ],
  },
  {
    title: "Se um paciente faltar ou reagendar, o que acontece na sua rotina?",
    context: "Atualização das sessões",
    options: [
      { label: "Tudo é atualizado em um único lugar", score: 0 },
      { label: "Faço uma alteração manual", score: 1 },
      { label: "Preciso alterar agenda e financeiro", score: 3 },
      { label: "Às vezes alguma informação fica para trás", score: 4 },
    ],
  },
  {
    title: "Quanto tempo por semana você dedica a tarefas administrativas?",
    context: "Tempo de gestão",
    options: [
      { label: "Menos de 30 minutos", score: 0 },
      { label: "Entre 30 minutos e 1 hora", score: 1 },
      { label: "Entre 1 e 3 horas", score: 3 },
      { label: "Mais de 3 horas", score: 4 },
    ],
  },
];

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
        <button onClick={() => startTrial(compact ? "quiz_cabecalho" : "pagina_cabecalho")}>Testar grátis <ArrowRight size={16} /></button>
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
  if (score <= 30) return { label: "Rotina bem estruturada", tone: "low", title: "Sua organização já tem uma boa base.", text: "O Clic Med pode ajudar a concentrar o que ainda está separado e reduzir etapas manuais." };
  if (score <= 65) return { label: "Organização com pontos de atenção", tone: "medium", title: "Existem tarefas manuais consumindo sua rotina.", text: "Centralizar agenda, pacientes e financeiro pode trazer mais clareza sem mudar a forma como você atende." };
  return { label: "Rotina administrativa sobrecarregada", tone: "high", title: "Sua gestão está pedindo um fluxo mais simples.", text: "O Clic Med foi pensado para reduzir repetições e deixar sessões, pacientes e recebimentos no mesmo lugar." };
}

export function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const finished = step >= questions.length;
  const score = useMemo(() => Math.round((answers.reduce((sum, value) => sum + value, 0) / (questions.length * 4)) * 100), [answers]);
  const result = scoreResult(score);
  const progress = finished ? 100 : Math.round((step / questions.length) * 100);

  useEffect(() => setPageMetadata("Diagnóstico de organização | Clic Med", "Descubra em poucos passos como está a organização administrativa do seu consultório."), []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  function answerQuestion(value) {
    setAnswers((current) => [...current.slice(0, step), value]);
    setStep((current) => current + 1);
  }

  function goBack() {
    if (step === 0) window.location.assign("/conheca");
    else setStep((current) => current - 1);
  }

  function restart() { setAnswers([]); setStep(0); }

  return <main className="quiz-page">
    <MarketingHeader compact />
    <div className="quiz-progress" aria-label={`Progresso: ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
    {!finished ? <section className="quiz-shell">
      <div className="quiz-question">
        <button className="quiz-back" onClick={goBack}><ChevronLeft size={18} />Voltar</button>
        <p className="marketing-kicker">Pergunta {step + 1} de {questions.length}</p>
        <h1>{questions[step].title}</h1>
        <div className="quiz-options">
          {questions[step].options.map((option) => <button key={option.label} onClick={() => answerQuestion(option.score)}><span>{option.label}</span><ChevronRight size={19} /></button>)}
        </div>
        <small>Não existe resposta certa. Use a opção que mais se aproxima da sua rotina.</small>
      </div>
      <aside className="quiz-visual">
        <p>{questions[step].context}</p>
        <img src="/clic-med-dashboard.png" alt="Demonstração da organização dentro do Clic Med" />
        <div><ShieldCheck size={18} /><span><b>Diagnóstico rápido</b><small>Leva menos de 2 minutos</small></span></div>
      </aside>
    </section> : <section className="quiz-result">
      <div className="quiz-result-copy">
        <span className={`quiz-result-label ${result.tone}`}>{result.label}</span>
        <p className="marketing-kicker">Seu resultado</p>
        <h1>{result.title}</h1>
        <p>{result.text}</p>
        <div className="quiz-score"><div><span>Nível de tarefas manuais</span><strong>{score}%</strong></div><div><i style={{ width: `${score}%` }} /></div></div>
        <ul><li><Check size={17} />Cadastro e agenda conectados</li><li><Check size={17} />Acompanhamento de pagamentos</li><li><Check size={17} />Relatórios financeiros por período</li></ul>
        <div className="quiz-offer"><span>Seu benefício para começar</span><strong>3 dias grátis</strong><small>Depois, R$ 67 por mês. Cancele quando quiser.</small></div>
        <button className="quiz-primary" onClick={() => startTrial(`quiz_resultado_${result.tone}`)}>Testar o Clic Med por 3 dias <ArrowRight size={18} /></button>
        <button className="quiz-restart" onClick={restart}>Refazer diagnóstico</button>
      </div>
      <div className="quiz-result-product"><img src="/clic-med-dashboard.png" alt="Agenda organizada no Clic Med" /><div><CircleCheck size={20} /><span><b>Seu primeiro ganho rápido</b><small>Cadastre um paciente e veja a sessão entrar na agenda.</small></span></div></div>
    </section>}
  </main>;
}
