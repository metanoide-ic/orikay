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
 * Regras que saíram das rodadas de crítica (não quebrar):
 *  · O horário estrutura a página. Nada de rótulo de seção, eyebrow,
 *    ficha técnica, taxonomia de recursos ou faixa escura de CTA.
 *  · Frases de gente, não slogan curto terminado em ponto.
 *  · Papel e tinta, uma família só, botões retos.
 *  · Não explicar o dispositivo da página nem repetir o que o print mostra.
 *  · Nem todo horário vende um recurso: o dia tem momento banal.
 *  · Dizer o que o produto não resolve. Dizer que a agência é inventada.
 *  · Nomes de cliente com cara de cliente real (sobrenome, sigla), não de dataset.
 */

/** Número do WhatsApp comercial, só dígitos com DDI (ex.: 5524999999999).
 *  Vazio = o botão de contratar não aparece. */
const WHATSAPP = '';

const C = {
  papel: '#F2F0E9',
  papel2: '#E8E5DB',
  tinta: '#171713',
  texto: '#3E3C36',
  apagado: '#6F6B61',
  linha: '#CFCBBF',
  aprovacao: '#A4245A',
  publicado: '#1F6B4E',
} as const;

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

function Entrar({ grande = false }: { grande?: boolean }) {
  return (
    <Link
      to="/entrar"
      style={{ background: C.tinta, color: C.papel }}
      className={`group inline-flex items-center gap-3 rounded-[3px] font-bold ${grande ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-[14px]'}`}
    >
      Entrar
      <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-[5px]">→</span>
    </Link>
  );
}

/** Um momento do dia: o horário à esquerda, o que aconteceu à direita. */
function Momento({ hora, children, className = '' }: { hora: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${MOLDURA} ${className}`}>
      <div className="grid gap-3 md:grid-cols-[9rem_1fr] md:gap-10">
        <div style={NUM} className="text-[22px] font-bold tracking-[-0.02em] md:pt-[3px] md:text-[26px]">{hora}</div>
        <div className="min-w-0">{children}</div>
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

/* O carrossel da JR Freios ao longo do dia: o mesmo cartão, três horários. */
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
              className="grid min-h-[44vh] grid-cols-[9rem_1fr] items-center gap-10 transition-opacity duration-300"
              style={{ opacity: ativo === i ? 1 : 0.3 }}
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
                  className="absolute inset-x-0 top-0 h-auto w-full rounded-[12px] transition-[opacity,transform] duration-500 ease-out"
                  style={{ opacity: ativo === i ? 1 : 0, transform: `translateY(${ativo === i ? 0 : ativo > i ? -10 : 10}px)` }}
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

export default function Landing() {
  const zap = WHATSAPP
    ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Quero saber como usar o Orikay na minha agência.')}`
    : '';

  return (
    <div style={{ ...SANS, background: C.papel, color: C.tinta, colorScheme: 'light' }} className="min-h-screen overflow-x-clip antialiased">
      <header className={`${MOLDURA} flex h-[72px] items-center justify-between`}>
        <div className="flex items-center gap-3">
          <LogoMark className="h-[22px] w-[22px] text-[#171713]!" />
          <span className="text-[16px] font-bold">Orikay</span>
        </div>
        <Entrar />
      </header>

      {/* abertura */}
      <section className={`${MOLDURA} pt-14 sm:pt-24`}>
        <h1 className="max-w-[56rem] text-[clamp(2.4rem,5.2vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.04em]">
          Na segunda de manhã, ninguém pergunta no grupo o que tem pra fazer
        </h1>
        <div className="mt-10 grid gap-8 md:grid-cols-[9rem_1fr] md:gap-10">
          <div className="hidden md:block" />
          <div className="max-w-[36rem]">
            <p style={{ color: C.texto }} className={CORPO}>
              A Sá Pinheiro Comunicação toca cinco clientes com quatro pessoas. O trabalho começa
              no Orikay e quase sempre termina no WhatsApp.
            </p>
            <p style={{ color: C.apagado }} className="mt-4 text-[15px] leading-[1.55]">
              A Sá Pinheiro é inventada. As telas, não.
            </p>
          </div>
        </div>
      </section>

      <Momento hora="09:07" className="mt-24 sm:mt-32">
        <p className={`max-w-[36rem] ${CORPO}`}>
          Marina chega antes de todo mundo. Cada post está no dia em que sai, parado na etapa
          em que ficou na sexta.
        </p>
      </Momento>

      {/* calendário sangrando para a direita (no celular, até a borda) */}
      <div className="mt-10 sm:mt-12">
        <div className="mx-auto max-w-[1280px] pl-5 sm:pl-10 md:pl-[calc(4rem+9rem+2.5rem)]">
          <div className="lg:-mr-[max(0px,calc((100vw-1280px)/2))]">
            <picture>
              <source media="(max-width: 640px)" srcSet={img('calendario-semanas')} />
              <img
                src={img('calendario')}
                alt="Calendário de outubro no Orikay, com os posts de cada cliente nos seus dias"
                width={2239} height={1225} decoding="async"
                className="block h-auto w-full rounded-l-[12px]"
              />
            </picture>
          </div>
        </div>
      </div>

      <Momento hora="09:31" className="mt-28 sm:mt-36">
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
              className="block h-auto w-full rounded-[10px]"
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

      <Momento hora="14:38" className="mt-28 sm:mt-36">
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

      <Momento hora="16:32" className="mt-28 sm:mt-36">
        <figure className="max-sm:-mx-5 lg:-mr-16">
          <img
            src={img('escritorio')} width={1298} height={970} loading="lazy" decoding="async"
            alt="Mesa da agência com o calendário do Orikay aberto no monitor, post-its e café; ao fundo, alguém da equipe trabalhando"
            className="block h-auto w-full rounded-[4px] max-sm:rounded-none"
          />
          <figcaption style={{ color: C.apagado }} className="mt-3 text-[15px] max-sm:px-5">
            A mesa da Marina no meio da tarde.
          </figcaption>
        </figure>
      </Momento>

      <Momento hora="16:51" className="mt-28 sm:mt-36">
        <p className={`max-w-[36rem] ${CORPO}`}>
          O Orikay não resolve cliente mandando alteração às 17h42. Só evita que o pedido
          desapareça no grupo.
        </p>
      </Momento>

      <Momento hora="17:03" className="mt-24 sm:mt-28">
        <p className={`max-w-[36rem] ${CORPO}`}>
          Marina olha o calendário uma última vez. Dois posts saíram. Um está agendado. O resto
          tem alguém responsável.
        </p>
      </Momento>

      {/* fecho */}
      <section className={`${MOLDURA} mt-32 sm:mt-44`}>
        <div style={{ borderColor: C.tinta }} className="border-t-2 pt-10 sm:pt-14">
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
