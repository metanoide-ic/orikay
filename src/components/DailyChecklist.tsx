import { useMemo } from 'react';
import { CheckCircle2, Circle, Clapperboard, ListChecks } from 'lucide-react';
import { useData } from '@/lib/dataStore';
import { useClientMap } from '@/lib/hooks';
import { markPublishedManual } from '@/lib/automations';
import { STAGE_META, STAGE_FUNNEL, PLATFORM_COLOR } from '@/lib/labels';
import { cn, todayISO } from '@/lib/utils';
import { EmptyState } from '@/components/ui';

/**
 * Checklist do dia: tudo que precisa sair hoje (ou já devia ter saído),
 * mais o que já foi publicado hoje. Atualiza sozinho conforme o post anda
 * pelas etapas — não precisa recarregar nada. Marcar como postado manda o
 * post direto pra "Publicado", o último estágio do pipeline.
 *
 * `fullPage`: usado na tela dedicada (menu "Checklist do dia") — sem limite
 * de altura e com estado vazio explicado, em vez de sumir quando não há
 * pendência (o widget do Painel some quando vazio; a página não).
 */
export function DailyChecklist({ fullPage = false }: { fullPage?: boolean }) {
  const posts = useData((s) => s.posts);
  const clientMap = useClientMap();
  const today = todayISO();

  const { pendentes, feitos } = useMemo(() => {
    const doDia = posts.filter((p) => p.scheduledDate && p.scheduledDate <= today);
    return {
      pendentes: doDia
        .filter((p) => p.stage !== 'publicado')
        .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!)),
      feitos: doDia
        .filter((p) => p.stage === 'publicado' && p.scheduledDate === today)
        .sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [posts, today]);

  if (pendentes.length === 0 && feitos.length === 0) {
    if (!fullPage) return null;
    return (
      <EmptyState
        icon={<ListChecks size={40} />}
        title="Nada pendente por hoje"
        description="Assim que houver posts agendados pra hoje (ou atrasados), eles aparecem aqui pra marcar conforme forem saindo."
      />
    );
  }

  return (
    <div className={cn('card overflow-hidden', !fullPage && 'mb-6')}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="font-semibold text-white">Checklist do dia</h3>
          <p className="mt-0.5 text-xs text-white/45">
            {pendentes.length} pendente(s) · {feitos.length} publicado(s) hoje
          </p>
        </div>
      </div>
      <div className={cn('divide-y divide-line', !fullPage && 'max-h-80 overflow-y-auto')}>
        {pendentes.map((p) => {
          const client = p.clientId ? clientMap[p.clientId] : undefined;
          const overdue = p.scheduledDate! < today;
          const funnelIdx = STAGE_FUNNEL.indexOf(p.stage);
          return (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <button
                onClick={() => markPublishedManual(p.id)}
                title="Marcar como postado"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/25 transition hover:text-emerald-400"
              >
                <Circle size={18} />
              </button>
              <span className="h-1.5 w-6 shrink-0 rounded-full" style={{ background: PLATFORM_COLOR[p.platform] }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/90">{p.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
                  {client && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} />{client.name}</span>}
                  <span>{p.platform}</span>
                  {p.awaitingMaterial && <span className="inline-flex items-center gap-1 text-amber-300"><Clapperboard size={10} /> falta material</span>}
                </div>
              </div>
              <span
                className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', overdue ? 'bg-red-500/15 text-red-300' : '')}
                style={!overdue ? { background: `${STAGE_META[p.stage].color}22`, color: STAGE_META[p.stage].color } : undefined}
              >
                {overdue ? 'atrasado' : STAGE_META[p.stage].label}
              </span>
              {funnelIdx >= 0 && (
                <span className="hidden shrink-0 text-[11px] text-white/30 sm:inline">
                  {funnelIdx + 1}/{STAGE_FUNNEL.length}
                </span>
              )}
            </div>
          );
        })}
        {feitos.map((p) => {
          const client = p.clientId ? clientMap[p.clientId] : undefined;
          return (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span className="h-1.5 w-6 shrink-0 rounded-full" style={{ background: PLATFORM_COLOR[p.platform] }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/70 line-through">{p.title}</p>
                <div className="mt-0.5 text-[11px] text-white/40">
                  {client && client.name} · {p.platform}
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-emerald-300">postado</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
