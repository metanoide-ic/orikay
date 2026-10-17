import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/newsreader/opsz-italic.css';
import { LogoMark } from '@/components/Logo';

/*
 * Landing da Orikay — "caderno de operação".
 *
 * Duas rodadas de crítica de direção de arte (ChatGPT + revisão própria).
 * Regras que saíram delas e não devem ser quebradas:
 *  · Papel e tinta. Nada de preto com violeta neon, brilho, degradê,
 *    serifa de moda, rótulo mono decorativo, botão pílula, índice ou "Fig.".
 *  · Três níveis de tipo (display, seção, corpo), pesos 700 e 400.
 *  · O violeta da Origem tem UM uso: o marcador de seção (barra de 2 px +
 *    nome da área) e o estado ativo. Não espalhar.
 *  · Serifa (Newsreader itálico) aparece uma única vez na página.
 *  · Linha só onde há dado (ficha, log da semana, listas). Bloco editorial
 *    se separa por espaço.
 *  · Prints são recortes reais editados para mostrar uma coisa por vez;
 *    clientes e posts nas capturas são fictícios.
 */

const C = {
  papel: '#F2F0E9',
  papel2: '#E8E5DB',
  tinta: '#171713',
  texto: '#3E3C36',
  apagado: '#6F6B61',
  linha: '#CFCBBF',
  violeta: '#4F35D2',
  aprovacao: '#A4245A',
  publicado: '#1F6B4E',
} as const;

const SANS = { fontFamily: "'Schibsted Grotesk Variable', 'Helvetica Neue', Arial, sans-serif" } as const;
const NOTA = { fontFamily: "'Newsreader Variable', Georgia, serif", fontStyle: 'italic' } as const;
const img = (nome: string) => `${import.meta.env.BASE_URL}landing/${nome}.webp`;

const MOLDURA = 'mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-[72px]';
const H_SECAO = 'text-[clamp(1.9rem,3.3vw,2.85rem)] font-bold leading-[1.04] tracking-[-0.028em]';
const CORPO = 'text-[17px] leading-[1.55] sm:text-[18px]';

const ESTADOS = [
  { nome: 'card-producao', etapa: 'Produção', cor: C.tinta, h: 456,
    texto: 'A arte está pronta. A checklist mostra o que falta: legenda e revisão.' },
  { nome: 'card-aprovacao', etapa: 'Aprovação', cor: C.aprovacao, h: 472,
    texto: 'Arte e legenda vão para o grupo do cliente no WhatsApp. O cartão passa a mostrar “no grupo”.' },
  { nome: 'card-publicado', etapa: 'Publicado', cor: C.publicado, h: 456,
    texto: 'O cliente responde “pode postar”. Sai no feed e no story, sem ninguém abrir o Instagram.' },
];

const SEMANA: Array<{ dia: string; hora: string; texto: string; onde: string; virada?: boolean }> = [
  { dia: 'SEG', hora: '09:10', texto: 'O planejamento do mês vira pauta, peça por peça, para cada cliente.', onde: 'Posts' },
  { dia: 'SEG', hora: '10:40', texto: 'Cada peça ganha responsável, prazo e checklist.', onde: 'Posts' },
  { dia: 'QUA', hora: '15:20', texto: 'A peça vai para o grupo do cliente com a legenda pronta.', onde: 'Automações', virada: true },
  { dia: 'QUA', hora: '16:02', texto: '“Pode postar.” Sai no feed e no story.', onde: 'Publicação' },
  { dia: 'QUI', hora: '11:15', texto: 'Pedido de ajuste. O texto do cliente fica no post, que volta para Alteração.', onde: 'Revisões', virada: true },
  { dia: 'SEX', hora: '17:30', texto: 'Vencimento. A cobrança vai para o WhatsApp de quem paga, com a chave Pix.', onde: 'Financeiro', virada: true },
];

const FAMILIAS: Array<{ nome: string; itens: Array<[string, string]> }> = [
  { nome: 'Conteúdo', itens: [
    ['Posts', 'Da pauta ao publicado, em quadro ou calendário.'],
    ['Vídeos', 'Briefing, gravação, edição, entrega e alterações.'],
    ['Biblioteca', 'Legendas e modelos que já funcionaram.'],
  ] },
  { nome: 'Operação', itens: [
    ['Checklist do dia', 'O que sai hoje e quem responde.'],
    ['Clientes', 'Briefing, cidades, cadência e grupo de cada conta.'],
    ['Checklist de clientes', 'Implantação de cada conta nova.'],
    ['Equipe e integrações', 'Acessos, WhatsApp, Instagram e IA.'],
  ] },
  { nome: 'Gestão', itens: [
    ['Tráfego', 'Campanhas por cliente e o próximo ajuste.'],
    ['Financeiro', 'Receitas, despesas e cobranças, com acesso restrito.'],
    ['Automações', 'Aprovação, resposta do cliente e publicação.'],
  ] },
];

/* ------------------------------------------------------------------ */

function Botao({ grande = false, claro = false, children = 'Entrar' }: { grande?: boolean; claro?: boolean; children?: React.ReactNode }) {
  return (
    <Link
      to="/entrar"
      style={{ background: claro ? C.papel : C.tinta, color: claro ? C.tinta : C.papel }}
      className={`group inline-flex items-center gap-3 rounded-[3px] font-bold ${grande ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-[14px]'}`}
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-[6px]">→</span>
    </Link>
  );
}

/** O gesto da casa: barra violeta de 2 px + nome da área. Abre cada seção. */
function Marcador({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ background: claro ? '#9C8BFF' : C.violeta }} className="h-[18px] w-[2px]" />
      <span style={{ color: claro ? '#9C8BFF' : C.violeta }} className="text-[14px] font-bold">{children}</span>
    </div>
  );
}

function Carimbo({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span
      style={{ color: cor, boxShadow: `inset 0 0 0 1.5px ${cor}` }}
      className="inline-flex h-7 items-center rounded-[2px] px-2.5 text-[12px] font-bold uppercase tracking-[0.08em]"
    >
      {children}
    </span>
  );
}

function Recorte({ nome, alt, largura, altura, className = '', raio = 10, eager = false }: {
  nome: string; alt: string; largura: number; altura: number; className?: string; raio?: number; eager?: boolean;
}) {
  return (
    <img
      src={img(nome)} alt={alt} width={largura} height={altura}
      loading={eager ? 'eager' : 'lazy'} decoding="async"
      style={{ borderRadius: raio }}
      className={`block h-auto w-full ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  O caminho de um post: o MESMO cartão muda de estado conforme rola.  */
/* ------------------------------------------------------------------ */
function CaminhoDoPost() {
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
    <>
      {/* desktop: cartão fixo à direita, texto rola à esquerda */}
      <div className="mt-6 hidden grid-cols-12 gap-6 md:grid">
        <ol className="col-span-5">
          {ESTADOS.map((s, i) => (
            <li
              key={s.nome}
              ref={(el) => { passos.current[i] = el; }}
              data-passo={i}
              className="flex min-h-[40vh] flex-col justify-center transition-opacity duration-300"
              style={{ opacity: ativo === i ? 1 : 0.32 }}
            >
              <div className="flex items-center gap-4">
                <Carimbo cor={s.cor}>{s.etapa}</Carimbo>
                <span style={{ color: C.apagado }} className="text-[14px]">{i + 1} de 3</span>
              </div>
              <p style={{ color: C.tinta }} className={`mt-5 max-w-[28rem] ${CORPO}`}>{s.texto}</p>
            </li>
          ))}
        </ol>
        <div className="col-span-6 col-start-7">
          <div className="sticky top-[calc(50vh-8rem)] max-w-[540px]">
            <div className="relative" style={{ aspectRatio: '1128 / 472' }}>
              {ESTADOS.map((s, i) => (
                <img
                  key={s.nome}
                  src={img(s.nome)} alt={`Cartão do post na etapa ${s.etapa}`}
                  width={1128} height={s.h} decoding="async"
                  className="absolute inset-x-0 top-0 h-auto w-full rounded-[12px] transition-[opacity,transform] duration-500 ease-out"
                  style={{ opacity: ativo === i ? 1 : 0, transform: `translateY(${ativo === i ? 0 : ativo > i ? -10 : 10}px) scale(${ativo === i ? 1 : 0.985})` }}
                />
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              {ESTADOS.map((s, i) => (
                <span key={s.nome} style={{ background: i <= ativo ? C.violeta : C.linha }} className="h-[3px] flex-1 transition-colors duration-500" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* mobile: sequência compacta, ligada por um traço */}
      <ol className="mt-10 md:hidden">
        {ESTADOS.map((s, i) => (
          <li key={s.nome} className="relative pb-10 pl-7 last:pb-0">
            {i < ESTADOS.length - 1 && <span style={{ background: C.linha }} className="absolute bottom-0 left-[5px] top-3 w-[2px]" />}
            <span style={{ background: s.cor }} className="absolute left-0 top-[9px] h-3 w-3 rounded-full" />
            <Carimbo cor={s.cor}>{s.etapa}</Carimbo>
            <Recorte nome={s.nome} alt={`Cartão do post na etapa ${s.etapa}`} largura={1128} altura={s.h} className="mt-3" raio={9} />
            <p style={{ color: C.texto }} className="mt-3 text-[16px] leading-[1.5]">{s.texto}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <div style={{ ...SANS, background: C.papel, color: C.tinta, colorScheme: 'light' }} className="min-h-screen overflow-x-clip antialiased">
      {/* cabeçalho */}
      <header className={`${MOLDURA} flex h-[72px] items-center justify-between`}>
        <div className="flex items-center gap-3">
          <LogoMark className="h-[22px] w-[22px] text-[#171713]!" />
          <span className="text-[16px] font-bold">Orikay</span>
          <span style={{ color: C.apagado }} className="hidden text-[14px] sm:block">Sistema interno da Origem</span>
        </div>
        <Botao />
      </header>

      {/* abertura */}
      <section className={`${MOLDURA} pt-12 sm:pt-16`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <h1 className="text-[clamp(2.65rem,4.9vw,4.4rem)] font-bold leading-[1] tracking-[-0.04em]">
              Tudo que a Origem entrega<br className="hidden sm:block" /> passa por aqui.
            </h1>
            <p style={{ color: C.texto }} className={`mt-7 max-w-[34rem] ${CORPO}`}>
              O sistema interno da agência. Planejamento, produção, aprovação, publicação
              e cobrança de cada cliente, num lugar que a equipe inteira enxerga.
            </p>
            <div className="mt-8">
              <Botao grande>Entrar no sistema</Botao>
            </div>
          </div>

          <dl className="self-end text-[14px] lg:col-span-3 lg:col-start-10 lg:mb-1">
            {[
              ['Sistema', 'Orikay'],
              ['Da', 'Origem Comunicação & Marketing'],
              ['Em uso desde', '2026'],
              ['Acesso', 'Equipe interna'],
            ].map(([k, v], i) => (
              <div key={k} style={{ borderColor: i === 0 ? C.tinta : 'rgba(207,203,191,0.6)' }} className="grid grid-cols-[7rem_1fr] gap-3 border-t py-2.5">
                <dt style={{ color: '#9A968B' }}>{k}</dt>
                <dd className="font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* produto: calendário sangrando para a direita */}
      <section className="mt-12 sm:mt-14">
        <div className="mx-auto max-w-[1440px] pl-5 sm:pl-10 lg:pl-[calc(72px+((100%-144px)/12+24px)*2)]">
          <div className="lg:-mr-[max(0px,calc((100vw-1440px)/2))]">
            <picture>
              <source media="(max-width: 640px)" srcSet={img('calendario-semanas')} />
              <img
                src={img('calendario')}
                alt="Calendário de publicações de outubro no Orikay, com os posts de cada cliente nos seus dias"
                width={2239} height={1225} decoding="async"
                className="block h-auto w-full rounded-l-[12px] max-sm:rounded-[10px] max-sm:pr-5"
              />
            </picture>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pr-5 sm:pr-10 lg:pr-[72px]">
            <Marcador>Posts · Calendário</Marcador>
            <span style={{ color: C.apagado }} className="text-[13px]">Telas reais do sistema, com clientes fictícios.</span>
          </div>
        </div>
      </section>

      {/* o caminho de um post */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <Marcador>Posts</Marcador>
        <h2 className={`mt-5 max-w-[40rem] ${H_SECAO}`}>O mesmo cartão, do quadro ao feed.</h2>
        <CaminhoDoPost />
        <p style={{ ...NOTA, color: C.tinta }} className="mt-20 max-w-[38rem] text-[clamp(1.45rem,2.3vw,1.9rem)] leading-[1.3] md:mt-12">
          Se alguém precisa perguntar em que pé está um post, alguma coisa ficou fora do sistema.
        </p>
      </section>

      {/* a semana, como log */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <Marcador>Semana</Marcador>
            <h2 className={`mt-5 ${H_SECAO}`}>Uma semana de produção.</h2>
          </div>
          <ol className="lg:col-span-8">
            {SEMANA.map((l, i) => (
              <li
                key={i}
                style={{ borderColor: l.virada ? C.tinta : C.linha }}
                className={`grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 py-5 sm:grid-cols-[8.5rem_1fr_auto] ${l.virada ? 'border-t-2' : 'border-t'} last:border-b`}
              >
                <span className="text-[20px] font-bold tracking-[-0.01em]">
                  {l.dia} <span className="font-normal">{l.hora}</span>
                </span>
                <span style={{ color: C.apagado }} className="justify-self-end text-[13px] sm:order-3">{l.onde}</span>
                <span style={{ color: C.texto }} className="col-span-2 text-[18px] leading-[1.5] sm:order-2 sm:col-span-1">{l.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* o pedido registrado */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-6 lg:col-start-1">
            <picture>
              <source media="(max-width: 640px)" srcSet={img('post-aprovacao-mobile')} />
              <img
                src={img('post-aprovacao')} width={1333} height={1321} loading="lazy" decoding="async"
                alt="Post em aprovação, com o que produzir, as etapas e os botões de aprovar ou pedir alteração"
                className="block h-auto w-full rounded-[10px]"
              />
            </picture>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <Marcador>Aprovação</Marcador>
            <h2 className={`mt-5 ${H_SECAO}`}>O pedido do cliente fica no post, não no WhatsApp.</h2>
            <p style={{ color: C.texto }} className={`mt-6 max-w-[30rem] ${CORPO}`}>
              Aprovar publica. Pedir alteração devolve o cartão para a equipe com o texto do cliente anotado.
            </p>
          </div>
        </div>
      </section>

      {/* cliente novo */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Marcador>Checklist de clientes</Marcador>
            <h2 className={`mt-5 ${H_SECAO}`}>Cliente novo não começa do zero.</h2>
          </div>
          <p style={{ color: C.texto }} className={`max-w-[32rem] self-end lg:col-span-5 lg:col-start-8 ${CORPO}`}>
            Toda conta entra com a mesma checklist: contrato, cobrança, briefing, acessos e cadência.
          </p>
        </div>
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-12">
          <Recorte nome="checklist-lista" alt="Lista de clientes com o andamento da implantação de cada um" largura={641} altura={792} className="lg:col-span-3" />
          <div className="lg:col-span-8 lg:col-start-5">
            <Recorte className="max-sm:hidden" nome="checklist-detalhe" alt="Checklist da Ótica Vista Clara com 9 de 15 itens concluídos" largura={1538} altura={735} />
            <p style={{ color: C.apagado }} className="mt-4 text-[14px]">
              <span style={{ color: C.tinta }} className="font-bold">9 de 15.</span> A Ótica Vista Clara já tem contrato, cobrança e acessos; falta a produção começar.
            </p>
          </div>
        </div>
      </section>

      {/* assistente, como registro de ação */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <Marcador>Assistente</Marcador>
            <h2 className={`mt-5 ${H_SECAO}`}>Ele conhece a operação.</h2>
            <p style={{ color: C.texto }} className={`mt-6 ${CORPO}`}>
              Consulta e altera posts, vídeos, clientes e cobranças. Excluir ou mandar mensagem a cliente sempre pede confirmação.
            </p>
          </div>

          <dl style={{ background: C.papel2 }} className="rounded-[4px] p-6 sm:p-9 lg:col-span-7 lg:col-start-6">
            {[
              ['Consulta', 'Quais posts estão atrasados?', false],
              ['Resposta', '2 encontrados. Carrossel da Autopeças Rota 116, ainda em Produção. Post da Clínica Sorriso Vivo, em Alteração desde terça.', false],
              ['Ação pedida', 'Mover o carrossel da Rota 116 para Edição. Feito.', false],
              ['Confirmação necessária', 'Excluir o Cliente Teste? Os posts dele continuam no sistema, sem vínculo com a conta.', true],
            ].map(([rotulo, valor, confirma], i) => (
              <div key={i} style={{ borderColor: C.linha }} className={`grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6 ${i ? 'border-t' : 'pt-0'}`}>
                <dt style={{ color: confirma ? C.violeta : C.apagado }} className="text-[14px] font-bold">{rotulo as string}</dt>
                <dd className="text-[17px] leading-[1.5]">
                  {valor as string}
                  {confirma && (
                    <div className="mt-4 flex gap-2">
                      <span style={{ background: C.tinta, color: C.papel }} className="rounded-[3px] px-4 py-2 text-[13px] font-bold">Confirmar exclusão</span>
                      <span style={{ boxShadow: `inset 0 0 0 1px ${C.linha}`, color: C.texto }} className="rounded-[3px] px-4 py-2 text-[13px]">Cancelar</span>
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* áreas */}
      <section className={`${MOLDURA} mt-28 sm:mt-40`}>
        <Marcador>Áreas</Marcador>
        <h2 className={`mt-5 max-w-[36rem] ${H_SECAO}`}>Cada parte da operação tem seu lugar.</h2>
        <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-6">
          {FAMILIAS.map((f) => (
            <div key={f.nome}>
              <div style={{ borderColor: C.tinta }} className="border-b-2 pb-3 text-[14px] font-bold">{f.nome}</div>
              <ul>
                {f.itens.map(([nome, desc]) => (
                  <li key={nome} style={{ borderColor: C.linha }} className="border-b py-4">
                    <div className="text-[17px] font-bold">{nome}</div>
                    <div style={{ color: C.texto }} className="mt-1 text-[15px] leading-[1.45]">{desc}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* fecho */}
      <section style={{ background: C.tinta, color: C.papel }} className="mt-28 sm:mt-40">
        <div className={`${MOLDURA} pb-20 pt-16 sm:pb-28 sm:pt-24`}>
          <Marcador claro>Orikay</Marcador>
          <h2 className="mt-6 max-w-[54rem] text-[clamp(2.4rem,4.6vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.038em]">
            A equipe começa o dia sabendo o que precisa acontecer.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
            <p style={{ color: '#B9B5A9' }} className={CORPO}>O resto fica registrado na Orikay.</p>
            <Botao grande claro>Entrar no sistema</Botao>
          </div>
        </div>
        <div style={{ background: '#0F0F0D', color: '#8C887D' }}>
          <div className={`${MOLDURA} py-5 text-[12px] font-bold uppercase tracking-[0.1em]`}>
            Orikay <span className="px-2 opacity-50">/</span> Sistema interno <span className="px-2 opacity-50">/</span> Origem Comunicação &amp; Marketing <span className="px-2 opacity-50">/</span> 2026
          </div>
        </div>
      </section>
    </div>
  );
}
