import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist-mono';
import { LogoMark } from '@/components/Logo';

/*
 * Landing da Orikay.
 *
 * Direção: editorial, contida. Nada de brilho, degradê, mockup inclinado ou
 * número animado. O produto aparece em prints reais da plataforma (dados de
 * clientes fictícios, gerados só para as capturas) e o texto fala da rotina
 * concreta da agência. Violeta só em detalhe; o peso vem da tipografia.
 */

const SERIF = { fontFamily: "'Instrument Serif', Georgia, serif" } as const;
const MONO = { fontFamily: "'Geist Mono Variable', ui-monospace, monospace" } as const;
const img = (nome: string) => `${import.meta.env.BASE_URL}landing/${nome}.webp`;

const SEMANA: Array<[string, string, string, string]> = [
  ['Seg', '09:10', 'O mês de cada cliente sai planejado: tema, legenda e texto da arte para cada peça, a partir do briefing e do que já foi ao ar.', 'Planejamento'],
  ['Seg', '10:40', 'As peças viram cartões no quadro, com data, responsável e checklist de arte, legenda e revisão.', 'Posts'],
  ['Qua', '15:20', 'A arte chega ao grupo do cliente no WhatsApp, com a legenda: “Segue aqui para aprovação.”', 'Automações'],
  ['Qua', '16:02', 'O cliente responde “pode postar”. O post sai no feed e no story sem ninguém abrir o Instagram.', 'Publicação'],
  ['Qui', '11:15', 'Quando o cliente pede ajuste, o pedido entra no post com o texto dele, e o cartão volta para Alteração.', 'Revisões'],
  ['Sex', '17:30', 'No vencimento, a cobrança do fee vai para o WhatsApp de quem paga, com a chave Pix.', 'Financeiro'],
];

const MODULOS: Array<[string, string]> = [
  ['Posts', 'Pipeline da ideia ao publicado, em quadro ou calendário.'],
  ['Vídeos', 'Briefing, gravação, decupagem, edição e entrega, com links e pedidos de alteração.'],
  ['Checklist do dia', 'O que precisa sair hoje, por pessoa.'],
  ['Tráfego', 'Campanhas por cliente, com leitura dos números e o que fazer em cada uma.'],
  ['Biblioteca', 'Legendas e modelos que já funcionaram, prontos para reaproveitar.'],
  ['Financeiro', 'Receitas, despesas e cobranças. Visível só para quem tem permissão.'],
  ['Automações', 'Envio para aprovação, leitura da resposta e publicação, com registro de tudo.'],
  ['Clientes', 'Briefing, cidades atendidas, cadência da semana e grupo de cada conta.'],
  ['Checklist de clientes', 'Onboarding padrão para cada cliente novo, do contrato ao primeiro post.'],
  ['Equipe e integrações', 'Contas, permissões, WhatsApp, Instagram e a chave de IA.'],
];

function Rotulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={MONO} className={`text-[11px] uppercase tracking-[0.14em] text-[#8b8a86] ${className}`}>
      {children}
    </div>
  );
}

function Figura({ src, alt, legenda, numero, largura, altura, className = '' }: {
  src: string; alt: string; legenda: string; numero: number; largura: number; altura: number; className?: string;
}) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[6px] border border-white/[0.09] bg-[#121214]">
        <img src={src} alt={alt} width={largura} height={altura} loading="lazy" decoding="async" className="block h-auto w-full" />
      </div>
      <figcaption style={MONO} className="mt-3 flex gap-3 text-[11px] leading-relaxed text-[#77766f]">
        <span className="shrink-0 text-[#b9b7af]">Fig. {numero}</span>
        <span>{legenda}</span>
      </figcaption>
    </figure>
  );
}

function BotaoEntrar({ grande = false }: { grande?: boolean }) {
  return (
    <Link
      to="/entrar"
      className={`group inline-flex items-center gap-3 rounded-full bg-[#ecebe6] font-medium text-[#0c0c0e] transition-colors hover:bg-white ${grande ? 'h-12 px-7 text-[15px]' : 'h-9 px-4 text-sm'}`}
    >
      Entrar
      <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#ecebe6] antialiased">
      {/* topo */}
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6 text-[#ecebe6]" />
            <span className="text-[15px] font-semibold tracking-tight">Orikay</span>
            <span className="hidden text-[13px] text-[#77766f] sm:inline">por Origem Comunicação &amp; Marketing</span>
          </div>
          <BotaoEntrar />
        </div>
      </header>

      {/* abertura */}
      <section className="mx-auto max-w-[1320px] px-5 pt-16 sm:px-8 sm:pt-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
          <Rotulo>Sistema de operação da agência</Rotulo>
          <h1 style={SERIF} className="mt-6 text-[clamp(3.1rem,9.2vw,9rem)] font-normal leading-[0.92] tracking-[-0.025em]">
            Resultado tem nome.
            <br />
            Estratégia tem <em className="italic text-[#a58cff]">Origem.</em>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-12 grid gap-10 border-t border-white/[0.07] pt-8 lg:grid-cols-12"
        >
          <p className="max-w-xl text-[19px] leading-[1.55] text-[#b9b7af] lg:col-span-7">
            É aqui que a Origem trabalha. O mês de cada cliente é planejado, produzido,
            aprovado no grupo do WhatsApp e publicado, e o financeiro fecha no mesmo lugar.
          </p>
          <div className="flex flex-col items-start gap-4 lg:col-span-4 lg:col-start-9">
            <BotaoEntrar grande />
            <p className="text-[13px] leading-relaxed text-[#77766f]">
              Acesso da equipe. As contas são criadas pelo administrador, em Equipe.
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
          <Figura
            numero={1}
            src={img('calendario')}
            largura={2880}
            altura={1598}
            alt="Calendário de publicações de outubro na Orikay, com posts de cinco clientes"
            legenda="Calendário de publicações de outubro. Telas reais da plataforma; clientes e posts fictícios."
            className="mt-14 sm:mt-20"
          />
        </motion.div>
      </section>

      {/* a semana */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 sm:mt-40 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Rotulo>A semana</Rotulo>
            <h2 style={SERIF} className="mt-5 text-[clamp(2.2rem,4.2vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em]">
              Uma semana comum, do jeito que ela acontece.
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#8b8a86]">
              Ninguém precisa perguntar em que pé está um post. A resposta está no cartão.
            </p>
          </div>

          <ol className="lg:col-span-8">
            {SEMANA.map(([dia, hora, texto, modulo], i) => (
              <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-x-6 border-t border-white/[0.07] py-6 last:border-b sm:grid-cols-[6.5rem_1fr_9rem]">
                <div style={MONO} className="text-[13px] leading-6 text-[#ecebe6]">
                  {dia}
                  <span className="block text-[#77766f]">{hora}</span>
                </div>
                <p className="text-[17px] leading-[1.55] text-[#d6d4cc]">{texto}</p>
                <div style={MONO} className="col-start-2 mt-3 text-[11px] uppercase tracking-[0.14em] text-[#77766f] sm:col-start-3 sm:mt-1 sm:text-right">
                  {modulo}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* registro */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 sm:mt-40 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Rotulo>Registro</Rotulo>
            <h2 style={SERIF} className="mt-5 text-[clamp(2.2rem,4.2vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em]">
              O que foi combinado fica escrito.
            </h2>
          </div>
          <p className="max-w-xl self-end text-[17px] leading-[1.6] text-[#b9b7af] lg:col-span-6 lg:col-start-7">
            Cada post guarda o que produzir, quem cuida dele, em que etapa está e o que o
            cliente pediu. Cada cliente novo entra com a mesma checklist de onboarding,
            do contrato assinado ao primeiro post publicado.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
          <Figura
            numero={2}
            src={img('post')}
            largura={1342}
            altura={1745}
            alt="Detalhe de um post em aprovação, com descrição, etapa, cliente e responsável"
            legenda="Post em aprovação. Aprovar publica; pedir alteração devolve o cartão com o pedido anotado."
            className="lg:col-span-5"
          />
          <Figura
            numero={3}
            src={img('checklist')}
            largura={2232}
            altura={1159}
            alt="Checklist de onboarding dos clientes, com o progresso de cada um"
            legenda="Checklist de clientes. O modelo padrão é editável; cada cliente tem a sua cópia."
            className="lg:col-span-7 lg:mt-24"
          />
        </div>
      </section>

      {/* assistente */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 sm:mt-40 sm:px-8">
        <div className="grid gap-12 border-t border-white/[0.07] pt-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Rotulo>Assistente</Rotulo>
            <h2 style={SERIF} className="mt-5 text-[clamp(2.2rem,4.2vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em]">
              Pede em português. Ela faz, e pergunta antes de apagar.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#8b8a86]">
              A assistente lê e altera posts, vídeos, clientes e cobranças. Excluir alguma
              coisa ou mandar mensagem para cliente sempre passa por uma confirmação sua.
            </p>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <dl className="space-y-7 text-[17px] leading-[1.55]">
              {[
                ['Você', 'Quais posts estão atrasados?'],
                ['Orikay', 'Dois. O carrossel da Autopeças Rota 116, previsto para ontem, ainda em Produção, e o post da Clínica Sorriso Vivo, parado em Alteração desde terça.'],
                ['Você', 'Passa o carrossel da Rota 116 para Edição e apaga o cliente Teste.'],
                ['Orikay', 'Carrossel movido para Edição. Antes de excluir: tirar “Teste” da carteira? Os posts dele continuam no sistema, sem o vínculo.'],
              ].map(([quem, fala], i) => (
                <div key={i} className="grid grid-cols-[4.5rem_1fr] gap-x-6">
                  <dt style={MONO} className="pt-[3px] text-[11px] uppercase tracking-[0.14em] text-[#77766f]">{quem}</dt>
                  <dd className={quem === 'Você' ? 'text-[#ecebe6]' : 'text-[#b9b7af]'}>{fala}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[4.5rem_1fr] gap-x-6">
                <span />
                <div className="flex gap-2">
                  <span className="rounded-full bg-[#ecebe6] px-4 py-1.5 text-[13px] font-medium text-[#0c0c0e]">Confirmar</span>
                  <span className="rounded-full border border-white/[0.14] px-4 py-1.5 text-[13px] text-[#b9b7af]">Cancelar</span>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* índice */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 sm:mt-40 sm:px-8">
        <div className="flex items-baseline justify-between border-b border-white/[0.07] pb-5">
          <h2 style={SERIF} className="text-[clamp(2rem,3.4vw,3rem)] font-normal tracking-[-0.02em]">Índice</h2>
          <Rotulo>{MODULOS.length} áreas</Rotulo>
        </div>
        <ul className="grid sm:grid-cols-2 sm:gap-x-12">
          {MODULOS.map(([nome, desc], i) => (
            <li key={nome} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-white/[0.07] py-5">
              <span style={MONO} className="pt-[3px] text-[12px] text-[#77766f]">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="text-[16px] font-medium text-[#ecebe6]">{nome}</div>
                <div className="mt-1 text-[14px] leading-relaxed text-[#8b8a86]">{desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* fecho */}
      <section className="mx-auto mt-28 max-w-[1320px] px-5 pb-20 sm:mt-40 sm:px-8">
        <div className="grid items-end gap-10 border-t border-white/[0.07] pt-12 lg:grid-cols-12">
          <h2 style={SERIF} className="text-[clamp(2.6rem,6.4vw,6rem)] font-normal leading-[0.95] tracking-[-0.025em] lg:col-span-8">
            A semana que vem <em className="italic text-[#a58cff]">já está no calendário.</em>
          </h2>
          <div className="lg:col-span-3 lg:col-start-10 lg:justify-self-end">
            <BotaoEntrar grande />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div style={MONO} className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-7 text-[11px] uppercase tracking-[0.14em] text-[#77766f] sm:flex-row sm:justify-between sm:px-8">
          <span>Orikay · Origem Comunicação &amp; Marketing</span>
          <span>Uso interno da equipe</span>
        </div>
      </footer>
    </div>
  );
}
