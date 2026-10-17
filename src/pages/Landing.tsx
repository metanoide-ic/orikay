import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource-variable/schibsted-grotesk';
import { LogoMark } from '@/components/Logo';

/*
 * Landing da Orikay — "uma segunda-feira".
 *
 * O Orikay é um produto para qualquer agência. A página não fala da agência
 * dona do produto: conta o dia de uma agência inventada (Sá Pinheiro
 * Comunicação), com equipe e clientes fictícios, sobre telas reais.
 *
 * O cinema vem de linguagem de filme, não de efeito:
 *  · Plano de abertura: a foto da mesa em tela cheia; rolar é a câmera
 *    andando até o monitor, com corte seco para a tela real.
 *  · A luz muda com o dia: manhã fria, tarde dourada, noite no 17:03.
 *  · O horário acompanha a leitura (fica preso ao lado de cada momento).
 *
 * Regras que saíram das rodadas de crítica (não quebrar):
 *  · Nada de neon, brilho, degradê decorativo, eyebrow, ficha técnica,
 *    taxonomia de recursos ou faixa escura de CTA.
 *  · Frases de gente, não slogan. Não explicar o dispositivo da página nem
 *    repetir o que o print mostra. Nem todo horário vende um recurso.
 *  · Dizer o que o produto não resolve. Dizer que a agência é inventada.
 *  · Nomes de cliente com cara de cliente real (sobrenome, sigla).
 */

/** Número do WhatsApp comercial, só dígitos com DDI (ex.: 5524999999999).
 *  Vazio = o botão de contratar não aparece. */
const WHATSAPP = '';

/* Cores vêm de variáveis: a luz do dia reescreve todas conforme a rolagem. */
const C = {
  papel: 'var(--papel)',
  papel2: 'var(--papel2)',
  tinta: 'var(--tinta)',
  texto: 'var(--texto)',
  apagado: 'var(--apagado)',
  linha: 'var(--linha)',
  aprovacao: '#A4245A',
  publicado: '#1F6B4E',
} as const;

type Luz = Record<'papel' | 'papel2' | 'tinta' | 'texto' | 'apagado' | 'linha', string>;
const MANHA: Luz = { papel: '#F2F0E9', papel2: '#E8E5DB', tinta: '#171713', texto: '#3E3C36', apagado: '#6F6B61', linha: '#CFCBBF' };
const TARDE: Luz = { papel: '#F2E7D3', papel2: '#E8DAC0', tinta: '#1A1712', texto: '#423B31', apagado: '#74695A', linha: '#D6C6A8' };
const NOITE: Luz = { papel: '#1C1A17', papel2: '#28241F', tinta: '#F0E9DC', texto: '#CFC6B6', apagado: '#9A9182', linha: '#3B3631' };

const TELA_FUNDO = '#18171F';
const SANS = { fontFamily: "'Schibsted Grotesk Variable', 'Helvetica Neue', Arial, sans-serif" } as const;
const NUM = { fontVariantNumeric: 'tabular-nums' } as const;
const img = (nome: string) => `${import.meta.env.BASE_URL}landing/${nome}.webp`;

const MOLDURA = 'mx-auto w-full max-w-[1280px] px-5 sm:px-10 lg:px-16';
const CORPO = 'text-[18px] leading-[1.6] sm:text-[19px]';

const ESTADOS = [
  { nome: 'card-producao', hora: '10:42', etapa: 'Produção', cor: C.tinta, h: 456,
    texto: 'Rafael terminou a arte do carrossel da JR Freios. Ainda faltam legenda e revisão. Está no cartão.' },
  { nome: 'card-aprovacao', hora: '11:30', etapa: 'Aprovação', cor: C.aprovacao, h: 472,
    texto: 'Bia termina a legenda e manda o post para o grupo do cliente pelo Orikay.' },
  { nome: 'card-publicado', hora: '15:12', etapa: 'Publicado', cor: C.publicado, h: 456,
    texto: 'O Jair, da JR, responde “pode postar” do balcão da loja. Sai no feed e no story.' },
];

const PENDENCIAS: Array<[string, string]> = [
  ['Panificadora São Judas', 'tudo encaminhado até sexta'],
  ['Ótica Ramalho', 'armações esperando aprovação desde ontem'],
  ['Clínica Lobo & Assis', 'pediram pra trocar o desconto, volta pra Bia'],
  ['JR Freios e Peças', 'carrossel no grupo, sem resposta'],
  ['Studio K', 'contrato chegou, implantação nem começou'],
];

/* ------------------------------------------------------------------ */

const limita = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t: number) => t * t * (3 - 2 * t);
const faixa = (p: number, a: number, b: number) => limita((p - a) / (b - a));

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mistura = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

function semMovimento() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------ */

function Entrar({ grande = false, claro = false }: { grande?: boolean; claro?: boolean }) {
  return (
    <Link
      to="/entrar"
      style={claro ? { background: '#F2F0E9', color: '#171713' } : { background: C.tinta, color: C.papel }}
      className={`group inline-flex items-center gap-3 rounded-[3px] font-bold ${grande ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-[14px]'}`}
    >
      Entrar
      <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-[5px]">→</span>
    </Link>
  );
}

/** Aparece ao entrar na tela: sobe 14 px, uma vez só. */
function useRevela<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || semMovimento()) { setVisto(true); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); obs.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const estilo = {
    opacity: visto ? 1 : 0,
    transform: visto ? 'none' : 'translateY(14px)',
    transition: 'opacity 900ms ease-out, transform 900ms cubic-bezier(.2,.7,.2,1)',
  };
  return [ref, estilo] as const;
}

/** Um momento do dia: o horário fica preso à esquerda enquanto o momento passa. */
function Momento({ hora, children, className = '', id }: { hora: string; children: React.ReactNode; className?: string; id?: string }) {
  const [ref, estilo] = useRevela<HTMLDivElement>();
  return (
    <section id={id} className={`${MOLDURA} ${className}`}>
      <div className="grid gap-3 md:grid-cols-[9rem_1fr] md:gap-10">
        <div style={NUM} className="text-[22px] font-bold tracking-[-0.02em] md:sticky md:top-[42vh] md:self-start md:pt-[3px] md:text-[26px]">{hora}</div>
        <div ref={ref} style={estilo} className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function Recorte({ nome, alt, largura, altura, className = '', raio = 10 }: {
  nome: string; alt: string; largura: number; altura: number; className?: string; raio?: number;
}) {
  return (
    <img
      src={img(nome)} alt={alt} width={largura} height={altura}
      loading="lazy" decoding="async"
      style={{ borderRadius: raio }}
      className={`block h-auto w-full ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Plano de abertura: a câmera anda até o monitor e corta para a tela. */
/* ------------------------------------------------------------------ */

/* Na foto: centro e largura da tela do monitor, em fração da imagem. */
const FOTO = { w: 2896, h: 2172, fx: 455 / 1448, fy: 362 / 1086, telaW: 835 / 1448 };

function Abertura() {
  const cena = useRef<HTMLElement>(null);
  const foto = useRef<HTMLImageElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLDivElement>(null);
  const veu = useRef<HTMLDivElement>(null);
  const leg1 = useRef<HTMLParagraphElement>(null);
  const leg2 = useRef<HTMLParagraphElement>(null);
  const relogio = useRef<HTMLDivElement>(null);
  const cabeca = useRef<HTMLElement>(null);
  const escuro = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parado = semMovimento();
    let quadro = 0;

    const desenha = () => {
      quadro = 0;
      const el = cena.current, f = foto.current;
      if (!el || !f) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const curso = Math.max(1, el.offsetHeight - vh);
      const p = parado ? 0 : limita(-el.getBoundingClientRect().top / curso);

      // foto cobrindo o quadro; no celular, o monitor é puxado para dentro
      const cobre = Math.max(vw / FOTO.w, vh / FOTO.h);
      const iw = FOTO.w * cobre, ih = FOTO.h * cobre;
      const x0 = limita(vw * 0.5 - FOTO.fx * iw, vw - iw, 0);
      const y0 = (vh - ih) / 2;

      // a câmera anda até a tela do monitor ocupar o quadro
      const alvo = vw < 640 ? vw * 1.9 : Math.min(vw, vh * 1.6);
      const escalaFinal = alvo / (FOTO.telaW * iw);
      const e = suave(faixa(p, 0.06, 0.76));
      const s = 1 + (escalaFinal - 1) * e;
      const fx0 = x0 + FOTO.fx * iw, fy0 = y0 + FOTO.fy * ih;
      const fx = fx0 + (vw / 2 - fx0) * e, fy = fy0 + (vh / 2 - fy0) * e;
      f.style.width = `${iw}px`;
      f.style.height = `${ih}px`;
      f.style.transform = `translate3d(${fx - FOTO.fx * iw * s}px, ${fy - FOTO.fy * ih * s}px, 0) scale(${s})`;

      if (tela.current) tela.current.style.opacity = p >= 0.775 ? '1' : '0';
      // corte: um mergulho rápido no escuro esconde a troca da foto pela tela
      if (escuro.current) escuro.current.style.opacity = String(faixa(p, 0.73, 0.77) * (1 - faixa(p, 0.78, 0.82)));
      const t = 1 - faixa(p, 0, 0.16);
      if (titulo.current) { titulo.current.style.opacity = String(t); titulo.current.style.transform = `translateY(${-p * 80}px)`; }
      if (veu.current) veu.current.style.opacity = String(0.3 + t * 0.7);
      if (leg1.current) leg1.current.style.opacity = String(faixa(p, 0.2, 0.28) * (1 - faixa(p, 0.52, 0.6)));
      if (leg2.current) leg2.current.style.opacity = String(faixa(p, 0.82, 0.9));
      if (relogio.current) relogio.current.style.opacity = String(faixa(p, 0.16, 0.24) * (1 - faixa(p, 0.68, 0.74)));
      if (cabeca.current) cabeca.current.style.opacity = String(1 - faixa(p, 0.5, 0.66));
    };

    const pede = () => { if (!quadro) quadro = requestAnimationFrame(desenha); };
    desenha();
    window.addEventListener('scroll', pede, { passive: true });
    window.addEventListener('resize', pede);
    return () => { cancelAnimationFrame(quadro); window.removeEventListener('scroll', pede); window.removeEventListener('resize', pede); };
  }, []);

  const legenda = 'absolute inset-x-0 bottom-[9vh] mx-auto max-w-[44rem] px-6 text-center text-[19px] leading-[1.45] text-[#F4F1EA] [text-shadow:0_1px_12px_rgba(0,0,0,.55)] sm:text-[22px]';

  return (
    <section ref={cena} aria-label="Abertura" style={{ background: TELA_FUNDO }} className="relative h-[330vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <img
          ref={foto}
          src={img('abertura')}
          srcSet={`${img('abertura-1x')} 1448w, ${img('abertura')} 2896w`}
          sizes="140vw"
          alt="Mesa de uma agência pela manhã, com o calendário do Orikay aberto no monitor e alguém da equipe trabalhando ao fundo"
          fetchPriority="high" decoding="async"
          className="absolute left-0 top-0 max-w-none origin-top-left will-change-transform"
        />

        <div ref={tela} style={{ background: TELA_FUNDO, opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
          <picture className="block w-full">
            <source media="(max-width: 639px)" srcSet={img('calendario-semanas')} />
            <img
              src={img('abertura-tela')} width={2880} height={1800} decoding="async"
              alt="Calendário de posts do Orikay, com os clientes da agência em cada dia de outubro"
              className="max-h-full w-full object-contain max-sm:-mt-[18vh]"
            />
          </picture>
        </div>

        <div ref={escuro} style={{ background: '#0B0A0E', opacity: 0 }} className="pointer-events-none absolute inset-0" />

        <div
          ref={veu}
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(10,9,8,.42) 0%, rgba(10,9,8,0) 26%, rgba(10,9,8,0) 42%, rgba(10,9,8,.78) 100%)' }}
        />

        <header ref={cabeca} className={`${MOLDURA} absolute inset-x-0 top-0 flex h-[72px] items-center justify-between text-[#F4F1EA]`}>
          <div className="flex items-center gap-3">
            <LogoMark className="h-[22px] w-[22px] text-[#F4F1EA]!" />
            <span className="text-[16px] font-bold">Orikay</span>
          </div>
          <Entrar claro />
        </header>

        <div ref={relogio} style={{ ...NUM, opacity: 0 }} className="absolute right-5 top-[88px] text-[15px] font-bold tracking-[0.02em] text-[#F4F1EA] [text-shadow:0_1px_10px_rgba(0,0,0,.5)] sm:right-10 lg:right-16">
          SEG 09:07
        </div>

        <div ref={titulo} className="absolute inset-x-0 bottom-0 pb-[9vh]">
          <div className={MOLDURA}>
            <h1 className="max-w-[54rem] text-[clamp(2.4rem,5.4vw,4.9rem)] font-bold leading-[1.0] tracking-[-0.04em] text-[#F7F4EE]">
              Na segunda de manhã, ninguém pergunta no grupo o que tem pra fazer
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.55] text-[#E4DED3] sm:text-[18px]">
              A Sá Pinheiro Comunicação toca cinco clientes com quatro pessoas. O trabalho começa
              no Orikay e quase sempre termina no WhatsApp.
            </p>
            <p className="mt-3 text-[14px] text-[#B8B1A4]">A Sá Pinheiro é inventada. As telas, não.</p>
          </div>
        </div>

        <p ref={leg1} style={{ opacity: 0 }} className={legenda}>Marina chega antes de todo mundo.</p>
        <p ref={leg2} style={{ opacity: 0 }} className={legenda}>Cada post está no dia em que sai, parado na etapa em que ficou na sexta.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  O carrossel da JR Freios ao longo do dia: o mesmo cartão, três horários. */
/* ------------------------------------------------------------------ */
function Carrossel() {
  const [ativo, setAtivo] = useState(0);
  const passos = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtivo(Number((e.target as HTMLElement).dataset.passo));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    passos.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section className={`${MOLDURA} mt-28 sm:mt-36`}>
      {/* desktop: o cartão fica parado e muda; os horários passam */}
      <div className="hidden md:grid md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.1fr)] md:gap-10">
        <ol className="col-span-2">
          {ESTADOS.map((s, i) => (
            <li
              key={s.nome}
              ref={(el) => { passos.current[i] = el; }}
              data-passo={i}
              className="grid min-h-[48vh] grid-cols-[9rem_1fr] items-center gap-10 transition-opacity duration-500"
              style={{ opacity: ativo === i ? 1 : 0.28 }}
            >
              <span style={NUM} className="text-[26px] font-bold tracking-[-0.02em]">{s.hora}</span>
              <div>
                <span style={{ color: s.cor }} className="text-[14px] font-bold">{s.etapa}</span>
                <p className={`mt-2 max-w-[26rem] ${CORPO}`}>{s.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <div className="sticky top-[calc(50vh-8rem)]">
            <div className="relative" style={{ aspectRatio: '1128 / 472' }}>
              {ESTADOS.map((s, i) => (
                <img
                  key={s.nome}
                  src={img(s.nome)} alt={`Cartão do carrossel na etapa ${s.etapa}`}
                  width={1128} height={s.h} decoding="async"
                  className="absolute inset-x-0 top-0 h-auto w-full rounded-[12px] shadow-[0_30px_60px_-30px_rgba(20,16,10,.45)] transition-[opacity,transform] duration-700 ease-out"
                  style={{ opacity: ativo === i ? 1 : 0, transform: `translateY(${ativo === i ? 0 : ativo > i ? -14 : 14}px)` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* mobile: um horário depois do outro */}
      <ol className="md:hidden">
        {ESTADOS.map((s) => (
          <li key={s.nome} className="mt-14 first:mt-0">
            <div style={NUM} className="text-[22px] font-bold tracking-[-0.02em]">{s.hora}</div>
            <p className={`mt-3 ${CORPO}`}>{s.texto}</p>
            <Recorte nome={s.nome} alt={`Cartão do carrossel na etapa ${s.etapa}`} largura={1128} altura={s.h} className="mt-5" raio={9} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  A luz do dia: esquenta até a tarde e anoitece no 17:03.            */
/* ------------------------------------------------------------------ */
function useLuzDoDia(raiz: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const chaves = Object.keys(MANHA) as Array<keyof Luz>;
    const M = chaves.map((k) => rgb(MANHA[k])), T = chaves.map((k) => rgb(TARDE[k])), N = chaves.map((k) => rgb(NOITE[k]));
    let quadro = 0;
    const aplica = () => {
      quadro = 0;
      const el = raiz.current;
      if (!el) return;
      const vh = window.innerHeight;
      const topo = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity;
      const tarde = suave(limita(1 - (topo('luz-tarde') - vh * 0.2) / (vh * 2.4)));
      const noite = suave(limita(1 - (topo('luz-noite') - vh * 0.3) / (vh * 0.75)));
      const virada = suave(faixa(noite, 0.35, 0.65));
      chaves.forEach((k, i) => {
        const dia = mistura(M[i], T[i], tarde);
        const cor = mistura(dia, N[i], k === 'papel' || k === 'papel2' ? noite : virada);
        el.style.setProperty(`--${k}`, `rgb(${cor.map(Math.round).join(',')})`);
      });
    };
    const pede = () => { if (!quadro) quadro = requestAnimationFrame(aplica); };
    aplica();
    window.addEventListener('scroll', pede, { passive: true });
    window.addEventListener('resize', pede);
    return () => { cancelAnimationFrame(quadro); window.removeEventListener('scroll', pede); window.removeEventListener('resize', pede); };
  }, [raiz]);
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  const raiz = useRef<HTMLDivElement>(null);
  useLuzDoDia(raiz);

  const zap = WHATSAPP
    ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Quero saber como usar o Orikay na minha agência.')}`
    : '';

  const vars = Object.fromEntries(Object.entries(MANHA).map(([k, v]) => [`--${k}`, v])) as React.CSSProperties;

  return (
    <div ref={raiz} style={{ ...vars, ...SANS, background: C.papel, color: C.tinta, colorScheme: 'light' }} className="min-h-screen overflow-x-clip antialiased">
      <Abertura />

      <Momento hora="09:31" className="pt-28 sm:pt-40">
        <p className={`max-w-[36rem] ${CORPO}`}>
          No começo do ano, Marina ainda atualizava uma planilha. O resto ficava espalhado nos
          grupos dos clientes e na cabeça da equipe.
        </p>
        <p className={`mt-5 max-w-[36rem] ${CORPO}`}>
          O WhatsApp continua sendo o WhatsApp. Só não é mais onde a equipe procura a pauta.
        </p>
      </Momento>

      <Carrossel />

      <Momento hora="11:56" className="mt-28 sm:mt-36">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-12">
          <p className={`max-w-[30rem] ${CORPO}`}>
            A dona da Ótica Ramalho quer trocar uma palavra na legenda das armações. Manda no
            grupo, como sempre mandou. O pedido volta para o cartão, e o Rafael não precisa
            procurar a mensagem.
          </p>
          <picture>
            <source media="(max-width: 640px)" srcSet={img('post-aprovacao-mobile')} />
            <img
              src={img('post-aprovacao')} width={1333} height={1321} loading="lazy" decoding="async"
              alt="Post da Ótica Ramalho em aprovação, com os botões de aprovar ou pedir alteração"
              className="block h-auto w-full rounded-[10px] shadow-[0_40px_80px_-40px_rgba(20,16,10,.5)]"
            />
          </picture>
        </div>
      </Momento>

      <Momento hora="12:20" className="mt-24 sm:mt-28">
        <p style={{ color: C.apagado }} className={`max-w-[34rem] ${CORPO}`}>
          Almoço. Metade da equipe desce para o self-service da esquina. Caio fica, porque o
          vídeo da clínica ainda está exportando.
        </p>
      </Momento>

      <Momento hora="13:21" className="mt-24 sm:mt-28">
        <p className={`max-w-[36rem] ${CORPO}`}>
          Bia abre a lista de clientes. Em dois minutos sabe quem está esperando a agência e
          quem está esperando aprovação.
        </p>
        <ul style={{ background: C.papel2 }} className="mt-8 max-w-[44rem] rounded-[4px] px-6 py-3 max-sm:-mx-5 max-sm:rounded-none sm:px-8 sm:py-4">
          {PENDENCIAS.map(([cliente, situacao], i) => (
            <li key={cliente} style={{ borderColor: C.linha }} className={`grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-6 ${i ? 'border-t' : ''}`}>
              <span className="text-[16px] font-bold">{cliente}</span>
              <span style={{ color: C.texto }} className="text-[16px] leading-[1.5]">{situacao}</span>
            </li>
          ))}
        </ul>
      </Momento>

      <Momento id="luz-tarde" hora="14:38" className="mt-28 sm:mt-36">
        <p className={`max-w-[36rem] ${CORPO}`}>
          Chegou o contrato do Studio K. Marina cria o cliente e abre a implantação: contrato,
          cobrança, acessos, briefing, cadência. A Ótica Ramalho, que entrou mês passado, está
          em 9 de 15.
        </p>
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)]">
          <Recorte nome="checklist-lista" alt="Lista de clientes com o andamento da implantação de cada um" largura={641} altura={792} />
          <Recorte className="max-sm:hidden" nome="checklist-detalhe" alt="Checklist da Ótica Ramalho com 9 de 15 itens concluídos" largura={1538} altura={735} />
        </div>
      </Momento>

      <Momento hora="15:47" className="mt-28 sm:mt-36">
        <p className={`max-w-[36rem] ${CORPO}`}>Caio pergunta ao assistente o que ainda está atrasado.</p>
        <div style={{ background: C.papel2 }} className="mt-6 max-w-[44rem] rounded-[4px] px-6 py-5 max-sm:-mx-5 max-sm:rounded-none sm:px-8 sm:py-6">
          {[
            ['Caio', 'o que ta atrasado'],
            ['Orikay', 'Dois posts. O carrossel da JR Freios está no grupo sem resposta desde 11:30, e o post de desconto da Clínica Lobo & Assis está em Alteração desde terça.'],
            ['Caio', 'passa o da clinica pra mim'],
            ['Orikay', 'Feito. O post agora está com você, ainda em Alteração.'],
          ].map(([quem, fala], i) => (
            <div key={i} style={{ borderColor: C.linha }} className={`grid gap-1 py-3 sm:grid-cols-[5rem_1fr] sm:gap-6 ${i ? 'border-t' : ''}`}>
              <span style={{ color: C.apagado }} className="text-[15px] font-bold">{quem}</span>
              <span className="text-[17px] leading-[1.5]">{fala}</span>
            </div>
          ))}
        </div>
        <p style={{ color: C.apagado }} className="mt-4 max-w-[36rem] text-[15px] leading-[1.55]">
          Ele mexe no sistema, mas pergunta antes de apagar qualquer coisa ou mandar mensagem para cliente.
        </p>
      </Momento>

      <Momento hora="16:51" className="mt-28 sm:mt-36">
        <p className={`max-w-[36rem] ${CORPO}`}>
          O Orikay não resolve cliente mandando alteração às 17h42. Só evita que o pedido
          desapareça no grupo.
        </p>
      </Momento>

      <Momento id="luz-noite" hora="17:03" className="mt-[40vh]">
        <p className="max-w-[40rem] text-[clamp(1.5rem,2.6vw,2.1rem)] font-bold leading-[1.3] tracking-[-0.015em]">
          Marina olha o calendário uma última vez. Dois posts saíram. Um está agendado. O resto
          tem alguém responsável.
        </p>
      </Momento>

      {/* fecho */}
      <section className={`${MOLDURA} mt-[30vh]`}>
        <div style={{ borderColor: C.linha }} className="border-t pt-10 sm:pt-14">
          <h2 className="max-w-[46rem] text-[clamp(2rem,3.6vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.03em]">
            Se a operação ainda cabe na cabeça de uma pessoa, talvez você ainda não precise do Orikay
          </h2>
          <p style={{ color: C.texto }} className={`mt-6 max-w-[36rem] ${CORPO}`}>
            {zap ? 'Quando começa a não caber, fale com a gente.' : 'Quando começa a não caber, o Orikay entra.'}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {zap && (
              <a
                href={zap} target="_blank" rel="noreferrer"
                style={{ background: C.tinta, color: C.papel }}
                className="inline-flex h-11 items-center rounded-[3px] px-5 text-[15px] font-bold"
              >
                Chamar no WhatsApp
              </a>
            )}
            {zap ? (
              <Link to="/entrar" style={{ boxShadow: `inset 0 0 0 1.5px ${C.tinta}` }} className="inline-flex h-11 items-center rounded-[3px] px-5 text-[15px] font-bold">
                Já uso, quero entrar
              </Link>
            ) : (
              <Entrar grande />
            )}
          </div>
        </div>
      </section>

      <footer className={`${MOLDURA} mt-28 pb-10 sm:mt-36`}>
        <div style={{ borderColor: C.linha, color: C.apagado }} className="flex flex-wrap justify-between gap-3 border-t pt-5 text-[14px]">
          <span><span style={{ color: C.tinta }} className="font-bold">Orikay</span>, 2026</span>
          <span>A Sá Pinheiro Comunicação, sua equipe e seus clientes são inventados. As telas são reais.</span>
        </div>
      </footer>
    </div>
  );
}
