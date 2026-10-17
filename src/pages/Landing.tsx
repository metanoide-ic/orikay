import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  ArrowRight, KanbanSquare, Wallet, CalendarCheck, Clapperboard, Zap, Library,
  Sparkles, Check, MessageCircle, Megaphone, ClipboardCheck, Send,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui';

const EASE = [0.22, 1, 0.36, 1] as const;

const modules = [
  { icon: KanbanSquare, title: 'Quadros', desc: 'Do briefing à entrega, cada demanda visível em um fluxo só.' },
  { icon: CalendarCheck, title: 'Posts', desc: 'Da ideia ao ar, com copy por IA e aprovação no WhatsApp.' },
  { icon: Clapperboard, title: 'Vídeos', desc: 'Pipeline de edição com versões, links e pedidos de alteração.' },
  { icon: Megaphone, title: 'Tráfego pago', desc: 'Campanhas por cliente com diagnóstico do que fazer em cada uma.' },
  { icon: Wallet, title: 'Financeiro', desc: 'Receitas, despesas e cobrança por cliente, com acesso restrito.' },
  { icon: Zap, title: 'Automações', desc: 'Aprovou no grupo, publica no feed e no story. Sozinho.' },
  { icon: ClipboardCheck, title: 'Checklist de clientes', desc: 'Onboarding de cada cliente, do contrato ao primeiro post.' },
  { icon: Library, title: 'Biblioteca', desc: 'Modelos de legenda prontos para reaproveitar em qualquer conta.' },
];

const PALAVRAS_FAIXA = ['Quadros', 'Posts', 'Vídeos', 'Tráfego', 'Financeiro', 'Automações', 'IA Helper', 'Checklist', 'Biblioteca'];

/* ------------------------------------------------------------------ */
/*  Camadas de atmosfera: grão de filme e vinheta                       */
/* ------------------------------------------------------------------ */
function Atmosfera() {
  return (
    <>
      <svg className="pointer-events-none fixed inset-0 z-[60] h-full w-full opacity-[0.07] mix-blend-overlay" aria-hidden="true">
        <filter id="grao">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grao)" />
      </svg>
      <div
        className="pointer-events-none fixed inset-0 z-[55]"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
        aria-hidden="true"
      />
    </>
  );
}

/* Feixes de luz que derivam devagar atrás do hero */
function FeixesDeLuz() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -top-1/3 left-1/2 h-[140%] w-[70%] -translate-x-1/2"
        style={{
          background:
            'conic-gradient(from 180deg at 50% 0%, transparent 38%, rgba(124,92,255,0.34) 46%, rgba(182,162,255,0.16) 50%, rgba(124,92,255,0.34) 54%, transparent 62%)',
          filter: 'blur(38px)',
        }}
        animate={{ rotate: [-6, 6, -6], opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-[8%] top-[20%] h-[26rem] w-[26rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.16), transparent 65%)', filter: 'blur(50px)' }}
        animate={{ x: [0, 60, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[6%] top-[38%] h-[30rem] w-[30rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.10), transparent 65%)', filter: 'blur(60px)' }}
        animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="hairline-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_70%)]" />
    </div>
  );
}

/* Título que entra palavra por palavra, com desfoque que assenta */
function TituloCinema({ linhas }: { linhas: Array<Array<{ t: string; destaque?: boolean }>> }) {
  let i = 0;
  return (
    <h1 className="font-display text-[2.7rem] font-semibold leading-[1.02] text-white sm:text-7xl lg:text-[5.2rem]">
      {linhas.map((linha, li) => (
        <span key={li} className="block">
          {linha.map((p) => {
            const delay = 0.25 + i++ * 0.11;
            return (
              <motion.span
                key={p.t + delay}
                className={`mr-[0.22em] inline-block ${p.destaque ? 'bg-gradient-to-r from-brand-200 via-brand-300 to-brand-500 bg-clip-text text-transparent' : ''}`}
                initial={{ opacity: 0, y: 36, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay, duration: 0.9, ease: EASE }}
              >
                {p.t}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock do produto: quadro de posts em perspectiva, segue o mouse      */
/* ------------------------------------------------------------------ */
const COLUNAS = [
  { nome: 'Ideia', cor: '#94a3b8', cards: [['Carrossel: 5 erros ao trocar o para-brisa', 'Instagram'], ['Reels: bastidor da oficina', 'Instagram']] },
  { nome: 'Produção', cor: '#a855f7', cards: [['Post: promoção do mês', 'Instagram']] },
  { nome: 'Aprovação', cor: '#ec4899', cards: [['Stories: enquete de sabores', 'Instagram'], ['Vídeo: tour pelo espaço', 'TikTok']] },
  { nome: 'Publicado', cor: '#10b981', cards: [['Post: dia do cliente', 'Instagram']] },
];

function MockQuadro() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 90, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 90, damping: 18 });

  function mover(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function soltar() { mx.set(0); my.set(0); }

  return (
    <div ref={ref} onMouseMove={mover} onMouseLeave={soltar} className="relative [perspective:1400px]">
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-brand-500/20 blur-3xl" aria-hidden="true" />
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, y: 60, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.9, duration: 1.2, ease: EASE }}
        className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/90 shadow-[0_40px_120px_-20px_rgba(124,92,255,0.45)]"
      >
        <div className="flex items-center gap-1.5 border-b border-white/5 bg-ink-850 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 rounded-md bg-white/5 px-3 py-0.5 text-[10px] tracking-wide text-white/35">orikay.com.br / posts</span>
        </div>
        <div className="grid grid-cols-4 gap-3 p-4">
          {COLUNAS.map((c, ci) => (
            <div key={c.nome} className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.cor }} />
                {c.nome}
              </div>
              {c.cards.map(([t, p], k) => (
                <motion.div
                  key={t}
                  style={{ translateZ: 30 + k * 14 }}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 5 + ci + k, repeat: Infinity, ease: 'easeInOut', delay: ci * 0.4 }}
                  className="rounded-lg border border-white/[0.07] bg-ink-800 p-2.5"
                >
                  <div className="text-[10px] leading-snug text-white/80">{t}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] text-white/40">{p}</span>
                    <span className="h-1 w-8 rounded-full" style={{ background: `${c.cor}88` }} />
                  </div>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contador que sobe quando entra na tela                              */
/* ------------------------------------------------------------------ */
function Contador({ ate, sufixo = '' }: { ate: number; sufixo?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visivel = useInView(ref, { once: true, margin: '-80px' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visivel) return;
    const ini = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / 1600);
      setN(Math.round(ate * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [visivel, ate]);
  return <span ref={ref}>{n}{sufixo}</span>;
}

/* ------------------------------------------------------------------ */
/*  Capítulos — storytelling com mini-interfaces                        */
/* ------------------------------------------------------------------ */
function Revelar({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Capitulo({
  numero, titulo, texto, mock, invertido,
}: { numero: string; titulo: string; texto: string; mock: React.ReactNode; invertido?: boolean }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <Revelar className={invertido ? 'lg:order-2' : ''}>
        <div className="font-display text-7xl font-semibold leading-none text-white/[0.06] sm:text-8xl">{numero}</div>
        <h3 className="-mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">{titulo}</h3>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-white/55">{texto}</p>
      </Revelar>
      <Revelar delay={0.15} className={invertido ? 'lg:order-1' : ''}>{mock}</Revelar>
    </div>
  );
}

function MockIA() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-brand-500/15 blur-3xl" aria-hidden="true" />
      <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-900/90 p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-white/60">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500/20 text-brand-300"><Sparkles size={14} /></span>
          IA Helper
        </div>
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-500/20 px-3.5 py-2 text-sm text-white/90">
          Gera o planejamento de outubro da Pizzaria Bella
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/45">
          <Check size={12} className="text-emerald-400" /> listar_clientes · gerar_planejamento
        </div>
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/[0.05] px-3.5 py-2 text-sm leading-relaxed text-white/80">
          Pronto: 13 publicações criadas, com tema, legenda e texto da arte. A do dia 12 puxa o Dia das Crianças pro rodízio infantil.
        </div>
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3">
          <div className="text-xs font-medium text-amber-200">Confirmar ação</div>
          <div className="mt-1 text-xs text-white/60">Excluir o cliente "Teste" da carteira?</div>
          <div className="mt-2 flex gap-2">
            <span className="rounded-md bg-brand-500 px-3 py-1 text-[11px] font-medium text-white">Confirmar</span>
            <span className="rounded-md px-3 py-1 text-[11px] text-white/50">Cancelar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockWhats() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <div className="rounded-2xl border border-white/10 bg-ink-900/90 p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2.5 border-b border-white/5 pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"><MessageCircle size={15} /></span>
          <div>
            <div className="text-sm font-medium text-white">Grupo · Cliente x Origem</div>
            <div className="text-[10px] text-emerald-300/80">online</div>
          </div>
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2 text-white/80">
            Segue aqui para aprovação
            <div className="mt-2 grid h-24 place-items-center rounded-lg bg-gradient-to-br from-brand-500/30 to-pink-500/20 text-[10px] tracking-widest text-white/50">ARTE DO POST</div>
          </div>
          <div className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-emerald-500/20 px-3.5 py-2 text-white/90">pode postar!</div>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/45">
            <Send size={12} className="text-brand-300" /> Publicado no feed e no story
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPlano() {
  const itens = [
    ['02', 'Carrossel', 'Erro que quase todo cliente comete ao trocar o vidro'],
    ['05', 'Vídeo', 'Antes e depois: o reparo que parecia impossível'],
    ['12', 'Post', 'Dia das Crianças: cantinho kids no atendimento'],
    ['16', 'Foto', 'Resultado da semana, com depoimento real'],
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-pink-500/10 blur-3xl" aria-hidden="true" />
      <div className="space-y-2 rounded-2xl border border-white/10 bg-ink-900/90 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-lg font-semibold text-white">Outubro 2026</div>
          <span className="flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] text-brand-200"><Sparkles size={11} /> pensado pela IA</span>
        </div>
        {itens.map(([d, t, h], i) => (
          <motion.div
            key={d}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: EASE }}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <span className="w-8 text-center font-display text-sm font-semibold text-white">{d}</span>
            <span className="w-16 shrink-0 text-[11px] font-medium text-brand-300">{t}</span>
            <span className="text-xs text-white/65">{h}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const anel = useTransform(scrollYProgress, [0, 1], [0, 90]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Atmosfera />

      {/* topo */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-7xl items-center justify-between px-6 py-6"
      >
        <Logo size="sm" />
        <Link to="/entrar">
          <Button variant="outline" size="sm">Entrar</Button>
        </Link>
      </motion.header>

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-[100svh] items-center overflow-hidden">
        <FeixesDeLuz />
        <motion.div
          style={{ rotate: anel }}
          className="pointer-events-none absolute -right-40 top-1/2 -translate-y-1/2 opacity-[0.05]"
          aria-hidden="true"
        >
          <LogoMark className="h-[44rem] w-[44rem]" />
        </motion.div>

        <motion.div style={{ y: heroY, opacity: heroOp }} className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-6 pb-20 pt-32 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: EASE }}
              className="mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em] text-white/45"
            >
              <span className="h-px w-10 bg-gradient-to-r from-brand-500 to-transparent" />
              Orikay · a plataforma da Origem
            </motion.div>

            <TituloCinema
              linhas={[
                [{ t: 'Resultado' }, { t: 'tem' }, { t: 'nome.' }],
                [{ t: 'Estratégia' }, { t: 'tem' }, { t: 'Origem.', destaque: true }],
              ]}
            />

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.9, ease: EASE }}
              className="mt-8 max-w-md text-lg leading-relaxed text-white/60"
            >
              Posts, vídeos, tráfego, cobrança e uma IA que opera tudo isso por você.
              A rotina inteira da agência, num só lugar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.35, duration: 0.9, ease: EASE }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link to="/entrar">
                <Button size="lg" className="group shadow-[0_0_50px_-8px_rgba(124,92,255,0.9)]">
                  Entrar na plataforma
                  <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#capitulos" className="text-sm text-white/45 transition hover:text-white">Ver como funciona ↓</a>
            </motion.div>
          </div>

          <MockQuadro />
        </motion.div>
      </section>

      {/* faixa em movimento */}
      <div className="relative border-y border-white/[0.06] bg-ink-950/60 py-5">
        <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <motion.div
            className="flex shrink-0 items-center gap-12 pr-12"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            style={{ width: 'max-content' }}
          >
            {[...PALAVRAS_FAIXA, ...PALAVRAS_FAIXA, ...PALAVRAS_FAIXA, ...PALAVRAS_FAIXA].map((p, i) => (
              <span key={i} className="flex items-center gap-12 font-display text-2xl font-semibold uppercase tracking-wide text-white/[0.18]">
                {p}
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500/60" />
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* CAPÍTULOS */}
      <section id="capitulos" className="mx-auto max-w-6xl space-y-32 px-6 py-32">
        <Revelar className="mx-auto max-w-2xl text-center">
          <div className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-brand-300/80">A rotina, em três atos</div>
          <h2 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Do briefing ao post no ar, <span className="text-white/40">sem ninguém correr atrás de ninguém.</span>
          </h2>
        </Revelar>

        <Capitulo
          numero="01"
          titulo="Planejar com quem pensa de verdade"
          texto="A IA lê o briefing, a cidade e o que já foi postado de cada cliente e monta o mês inteiro: tema, legenda e o texto da arte, com o raciocínio por trás de cada peça."
          mock={<MockPlano />}
        />
        <Capitulo
          invertido
          numero="02"
          titulo="Aprovar onde o cliente já está"
          texto="O post vai para o grupo do WhatsApp do cliente, a resposta volta para a plataforma e, aprovado, publica no feed e no story. Alteração vira tarefa, com o pedido registrado."
          mock={<MockWhats />}
        />
        <Capitulo
          numero="03"
          titulo="Uma IA com as mãos na plataforma"
          texto="Peça em português: criar cliente, mover post, ler o WhatsApp, gerar planejamento. Ações que apagam ou mandam mensagem sempre pedem a sua confirmação antes."
          mock={<MockIA />}
        />
      </section>

      {/* números */}
      <section className="relative border-y border-white/[0.06] bg-ink-950/60 py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(124,92,255,0.12), transparent 60%)' }} aria-hidden="true" />
        <div className="relative mx-auto grid max-w-5xl grid-cols-2 gap-10 px-6 text-center lg:grid-cols-4">
          {[
            [<Contador key="a" ate={8} />, 'módulos integrados'],
            [<Contador key="b" ate={8} />, 'etapas do post, da ideia ao ar'],
            [<Contador key="c" ate={3} />, 'plataformas de anúncio'],
            [<Contador key="d" ate={100} sufixo="%" />, 'no navegador e no celular'],
          ].map(([n, l], i) => (
            <Revelar key={i} delay={i * 0.08}>
              <div className="font-display text-5xl font-semibold text-white sm:text-6xl">{n}</div>
              <div className="mt-2 text-sm text-white/45">{l}</div>
            </Revelar>
          ))}
        </div>
      </section>

      {/* módulos */}
      <section className="mx-auto max-w-6xl px-6 py-32">
        <Revelar className="mb-12 flex items-end justify-between border-b border-white/[0.08] pb-5">
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">Tudo o que a operação precisa</h2>
          <span className="hidden text-sm text-white/40 sm:block">{modules.length} módulos</span>
        </Revelar>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }}
              className="group relative bg-ink-900 p-7 transition-colors duration-300 hover:bg-ink-850"
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'radial-gradient(circle at 30% 0%, rgba(124,92,255,0.16), transparent 60%)' }} />
              <m.icon size={22} strokeWidth={1.6} className="relative text-brand-300 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <h3 className="relative mt-5 font-display text-lg font-semibold text-white">{m.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-white/50">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* final */}
      <section className="relative overflow-hidden px-6 pb-32 pt-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(124,92,255,0.28), transparent 65%)', filter: 'blur(40px)' }} aria-hidden="true" />
        <Revelar className="relative mx-auto max-w-3xl text-center">
          <LogoMark className="mx-auto h-16 w-16" />
          <h2 className="mt-8 font-display text-4xl font-semibold leading-tight text-white sm:text-6xl">
            A agência inteira,<br />
            <span className="bg-gradient-to-r from-brand-200 via-brand-300 to-brand-500 bg-clip-text text-transparent">em cena.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-white/55">Entre com a sua conta da equipe e traga tudo para um lugar só.</p>
          <Link to="/entrar" className="mt-10 inline-block">
            <Button size="lg" className="group shadow-[0_0_60px_-6px_rgba(124,92,255,0.95)]">
              Acessar agora
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </Link>
        </Revelar>
      </section>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs tracking-wide text-white/35">
        Orikay · Origem Comunicação &amp; Marketing
      </footer>
    </div>
  );
}
