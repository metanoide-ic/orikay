import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, MessageCircle, MapPin, Clapperboard, Wallet } from 'lucide-react';
import { Badge, Stat } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { STAGE_META, VIDEO_STAGE_META, PLATFORM_COLOR } from '@/lib/labels';
import { money, initials } from '@/lib/utils';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ClientDetail() {
  const { clientId = '' } = useParams();
  const client = useData((s) => s.clients.find((c) => c.id === clientId));
  const posts = useData((s) => s.posts);
  const boards = useData((s) => s.boards);
  const videos = useData((s) => s.videos);
  const transactions = useData((s) => s.transactions);
  const canFinance = !!useAuth((s) => s.current()?.canFinance);

  const data = useMemo(() => {
    const cposts = posts.filter((p) => p.clientId === clientId);
    const ctasks: { title: string; boardId: string; boardName: string; column: string }[] = [];
    boards.forEach((b) => {
      const colById = Object.fromEntries(b.columns.map((c) => [c.id, c.title]));
      b.columns.forEach((col) => col.cardIds.forEach((id) => {
        const card = b.cards[id];
        if (card?.clientId === clientId) ctasks.push({ title: card.title, boardId: b.id, boardName: b.name, column: colById[col.id] });
      }));
    });
    const cvideos = videos.filter((v) => v.clientId === clientId);
    const ctx = transactions.filter((t) => t.clientId === clientId);
    const receita = ctx.filter((t) => t.type === 'receita' && t.status === 'pago').reduce((a, t) => a + t.amount, 0);
    return { cposts, ctasks, cvideos, ctx, receita };
  }, [posts, boards, videos, transactions, clientId]);

  if (!client) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <p className="text-white/60">Cliente não encontrado.</p>
        <Link to="/app/clientes" className="mt-3 text-brand-300 hover:text-brand-200">Voltar aos clientes</Link>
      </div>
    );
  }

  const cadenceDays = client.weeklyPlan ? Object.entries(client.weeklyPlan) : [];

  return (
    <div>
      <Link to="/app/clientes" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={16} /> Clientes
      </Link>

      {/* Cabeçalho */}
      <div className="card mt-3 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-semibold text-white" style={{ background: client.color }}>{initials(client.name)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-white">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
              {client.instagram && <span>@{client.instagram}</span>}
              {client.contact && <span>{client.contact}</span>}
              {client.cities?.length ? <span className="inline-flex items-center gap-1"><MapPin size={13} /> {client.cities.join(', ')}</span> : null}
              {client.whatsappGroup && <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {client.whatsappGroup}</span>}
              {client.monthlyFee && canFinance && <span className="inline-flex items-center gap-1"><Wallet size={13} /> {money(client.monthlyFee)}/mês</span>}
            </div>
          </div>
        </div>
        {client.briefing && (
          <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/40">Briefing</div>
            <p className="text-sm leading-relaxed text-white/70">{client.briefing}</p>
          </div>
        )}
        {cadenceDays.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/40"><CalendarRange size={13} /> Cadência semanal</div>
            <div className="flex flex-wrap gap-2">
              {cadenceDays.map(([d, items]) => (
                <span key={d} className="rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-xs text-white/70">
                  <b className="text-white">{WD[Number(d)]}:</b> {items.join(', ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canFinance && <Stat label="Receita (paga)" value={money(data.receita)} valueColor="#34d399" />}
        <Stat label="Posts" value={String(data.cposts.length)} dot="#7c5cff" />
        <Stat label="Tarefas" value={String(data.ctasks.length)} dot="#38bdf8" />
        <Stat label="Vídeos" value={String(data.cvideos.length)} dot="#a855f7" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Posts */}
        <Panel title="Posts" to="/app/posts" linkLabel="Ver posts">
          {data.cposts.length ? data.cposts.slice(0, 8).map((p) => (
            <Row key={p.id} title={p.title}
              left={<span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[p.platform] }} />}
              right={<Badge color={STAGE_META[p.stage].color}>{STAGE_META[p.stage].label}</Badge>} />
          )) : <Empty label="Nenhum post para este cliente." />}
        </Panel>

        {/* Tarefas */}
        <Panel title="Tarefas" to="/app/quadros" linkLabel="Ver quadros">
          {data.ctasks.length ? data.ctasks.slice(0, 8).map((t, i) => (
            <Row key={i} title={t.title} left={<span className="h-2 w-2 rounded-full bg-brand-400" />} right={<Badge>{t.column}</Badge>} />
          )) : <Empty label="Nenhuma tarefa vinculada." />}
        </Panel>

        {/* Vídeos */}
        <Panel title="Vídeos" to="/app/videos" linkLabel="Ver vídeos">
          {data.cvideos.length ? data.cvideos.slice(0, 8).map((v) => (
            <Row key={v.id} title={v.title} left={<Clapperboard size={13} className="text-brand-300" />}
              right={<Badge color={VIDEO_STAGE_META[v.stage].color}>{VIDEO_STAGE_META[v.stage].label}</Badge>} />
          )) : <Empty label="Nenhum vídeo para este cliente." />}
        </Panel>

        {/* Financeiro */}
        {canFinance && (
          <Panel title="Financeiro" to="/app/financeiro" linkLabel="Ver financeiro">
            {data.ctx.length ? data.ctx.slice(0, 8).map((t) => (
              <Row key={t.id} title={t.description}
                left={<span className="h-2 w-2 rounded-full" style={{ background: t.type === 'receita' ? '#10b981' : '#ef4444' }} />}
                right={<span className={t.type === 'receita' ? 'text-emerald-400' : 'text-white/70'}>{t.type === 'receita' ? '+' : '−'} {money(t.amount)}</span>} />
            )) : <Empty label="Sem lançamentos." />}
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, to, linkLabel, children }: { title: string; to: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-white">{title}</h3>
        <Link to={to} className="text-xs text-brand-300 hover:text-brand-200">{linkLabel}</Link>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ title, left, right }: { title: string; left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
      <span className="shrink-0">{left}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-white/85">{title}</span>
      <span className="shrink-0 text-xs">{right}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-white/35">{label}</p>;
}
