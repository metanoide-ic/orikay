import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STAGE_META } from '@/lib/labels';
import { HOLIDAYS } from '@/lib/planner';
import { useClientMap } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/types';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function PostsCalendar({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const clientMap = useClientMap();
  const todayISO = now.toISOString().slice(0, 10);

  const byDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    posts.forEach((p) => { if (p.scheduledDate) (map[p.scheduledDate] ??= []).push(p); });
    return map;
  }, [posts]);

  const first = new Date(ym.y, ym.m, 1);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const iso = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const holidayFor = (d: number) => HOLIDAYS.find((h) => h.md === `${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  function shift(delta: number) {
    setYm(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="font-display text-lg font-semibold text-white">{MESES[ym.m]} <span className="text-white/40">{ym.y}</span></h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white">Hoje</button>
          <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"><ChevronLeft size={16} /></button>
          <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-white/[0.02]">
        {WD.map((d) => <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-white/40">{d}</div>)}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[104px] border-b border-r border-line/60 bg-white/[0.01]" />;
          const dayISO = iso(d);
          const list = byDay[dayISO] || [];
          const hol = holidayFor(d);
          const isToday = dayISO === todayISO;
          return (
            <div key={i} className="min-h-[104px] border-b border-r border-line/60 p-1.5">
              <div className="mb-1 flex items-center justify-between">
                <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs font-medium', isToday ? 'bg-brand-500 text-white' : 'text-white/55')}>{d}</span>
                {hol && (
                  <span className={cn('inline-flex max-w-[70%] items-center gap-1 truncate rounded px-1 text-[9px] font-medium', hol.universal ? 'bg-amber-400/15 text-amber-300' : 'text-amber-300/80')} title={hol.name + (hol.universal ? ' (todos os clientes)' : '')}>
                    {hol.universal && <span className="h-1 w-1 shrink-0 rounded-full bg-amber-300" />}
                    {hol.name.split(' ')[0]}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((p) => {
                  const client = p.clientId ? clientMap[p.clientId] : undefined;
                  return (
                    <button key={p.id} onClick={() => onOpen(p.id)}
                      className="flex w-full items-center gap-1 rounded-md border-l-2 bg-white/[0.03] px-1.5 py-1 text-left transition hover:bg-white/[0.07]"
                      style={{ borderColor: client?.color || STAGE_META[p.stage].color }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STAGE_META[p.stage].color }} />
                      <span className="truncate text-[11px] text-white/80">{p.title}</span>
                    </button>
                  );
                })}
                {list.length > 3 && <div className="px-1 text-[10px] text-white/40">+{list.length - 3} mais</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
