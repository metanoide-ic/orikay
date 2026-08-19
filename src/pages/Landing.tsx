import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, KanbanSquare, Wallet, CalendarCheck, Clapperboard, Zap, Library } from 'lucide-react';
import { Logo, LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui';

const modules = [
  { icon: KanbanSquare, title: 'Quadros', desc: 'Do briefing à entrega, cada demanda visível em um fluxo só.' },
  { icon: CalendarCheck, title: 'Posts', desc: 'Da ideia ao ar, com copy por IA e aprovação no WhatsApp.' },
  { icon: Clapperboard, title: 'Vídeos', desc: 'Pipeline de edição com versões, links e pedidos de alteração.' },
  { icon: Wallet, title: 'Financeiro', desc: 'Receitas, despesas e saldo por cliente, com acesso restrito.' },
  { icon: Zap, title: 'Automações', desc: 'Aprovou no grupo, publica no feed e no story. Sozinho.' },
  { icon: Library, title: 'Biblioteca', desc: 'Modelos de legenda prontos para reaproveitar em qualquer conta.' },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      {/* topo */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="sm" />
        <Link to="/entrar">
          <Button variant="outline" size="sm">Entrar</Button>
        </Link>
      </header>

      {/* hero — assimétrico, editorial */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <div className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            <span className="h-px w-8 bg-brand-500/70" />
            Orikay, a plataforma da Origem
          </div>
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] text-white sm:text-6xl">
            Resultado tem nome.
            <br />
            Estratégia tem <span className="text-brand-300">Origem</span>.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
            Quadros, posts, vídeos e financeiro no mesmo lugar, com aprovação e
            publicação automatizadas. Feita para a rotina da agência.
          </p>
          {/* Plataforma interna da equipe: não existe "criar conta" — as contas
              são as oficiais da Origem, criadas pelo admin em Equipe. */}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/entrar">
              <Button size="lg" className="group">
                Entrar
                <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* marca — bloco sóbrio, sem orbe/glow */}
        <div className="relative">
          <div className="card relative overflow-hidden">
            <div className="hairline-grid absolute inset-0 opacity-60" />
            <div className="relative grid place-items-center px-10 py-16">
              <LogoMark className="h-28 w-28" />
              <div className="mt-8 text-center">
                <div className="font-display text-3xl font-semibold tracking-[0.18em] text-white">ORIKAY</div>
                <div className="mt-2 text-[10px] tracking-[0.3em] text-white/35">POR ORIGEM COMUNICAÇÃO</div>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
              {[['Web + App', 'instale no celular'], ['3 em 1', 'gestão completa'], ['IA', 'copy automática']].map(([a, b]) => (
                <div key={a} className="px-3 py-4">
                  <div className="font-display text-sm font-semibold text-white">{a}</div>
                  <div className="mt-0.5 text-[11px] text-white/40">{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* módulos — grade densa, sem “3 cards genéricos” */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between border-b border-line pb-4">
          <h2 className="font-display text-2xl font-semibold text-white">Tudo o que a operação precisa</h2>
          <span className="hidden text-sm text-white/40 sm:block">6 módulos integrados</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="group bg-ink-900 p-6 transition-colors duration-200 hover:bg-ink-850"
            >
              <m.icon size={20} strokeWidth={1.75} className="text-brand-300" />
              <h3 className="mt-4 font-display text-lg font-semibold text-white">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{m.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-xl border border-line bg-ink-900 p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">Pronto para começar?</h3>
            <p className="mt-1 text-sm text-white/50">Entre com sua conta da equipe e traga tudo para um lugar só.</p>
          </div>
          <Link to="/entrar">
            <Button size="lg" className="group whitespace-nowrap">
              Acessar agora
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs tracking-wide text-white/35">
        Orikay · Origem Comunicação &amp; Marketing
      </footer>
    </div>
  );
}
