import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Minus, Plus, X } from 'lucide-react';
import { useData } from '@/lib/dataStore';
import { useClientMap } from '@/lib/hooks';
import { markPublishedManual } from '@/lib/automations';
import { STAGE_ORDER, VIDEO_STAGE_ORDER } from '@/lib/labels';
import { cn, todayISO } from '@/lib/utils';
import { Input } from '@/components/ui';
import type { Post, VideoProject } from '@/lib/types';

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const WEEKDAYS_FULL = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_MAI = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

interface Linha {
  id: string;
  tipo: 'post' | 'video' | 'extra';
  cliente: string;
  titulo: string;
  produzido: boolean;
  aprovado: boolean;
  concluido: boolean;
  onConcluir?: () => void;
  onRemover?: () => void;
}

function linhaDoPost(p: Post, clienteNome: string): Linha {
  const idx = STAGE_ORDER.indexOf(p.stage);
  return {
    id: p.id,
    tipo: 'post',
    cliente: clienteNome,
    titulo: p.title,
    produzido: idx >= STAGE_ORDER.indexOf('edicao'),
    aprovado: p.stage === 'agendado' || p.stage === 'publicado',
    concluido: p.stage === 'publicado',
    onConcluir: p.stage === 'publicado' ? undefined : () => markPublishedManual(p.id),
  };
}

function linhaDoVideo(v: VideoProject, clienteNome: string): Linha {
  const idx = VIDEO_STAGE_ORDER.indexOf(v.stage);
  return {
    id: v.id,
    tipo: 'video',
    cliente: clienteNome,
    titulo: v.title,
    produzido: idx >= VIDEO_STAGE_ORDER.indexOf('edicao'),
    aprovado: idx >= VIDEO_STAGE_ORDER.indexOf('aprovacao') && v.stage !== 'alteracao',
    concluido: v.stage === 'entregue',
    onConcluir: v.stage === 'entregue' ? undefined : () => useData.getState().updateVideo(v.id, { stage: 'entregue' }),
  };
}

type Status = 'apagado' | 'amarelo' | 'vermelho' | 'verde';

function statusDoDia(linhas: Linha[], data: string, hoje: string): Status {
  if (data > hoje) return 'apagado';
  if (linhas.length === 0) return data === hoje ? 'amarelo' : 'apagado';
  const tudoOk = linhas.every((l) => l.concluido);
  if (tudoOk) return 'verde';
  return data === hoje ? 'amarelo' : 'vermelho';
}

const STATUS_STYLE: Record<Status, string> = {
  apagado: 'bg-white/[0.02] text-white/25 border-line',
  amarelo: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  vermelho: 'bg-red-500/15 text-red-200 border-red-500/40',
  verde: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
};

/**
 * Checklist automático em formato de calendário: um mês inteiro, um dia por
 * célula, colorida pelo andamento — amarelo (hoje, em andamento), apagado
 * (ainda não chegou), vermelho (passou e ficou coisa faltando) e verde (saiu
 * tudo). Clica no dia pra abrir a lista de posts/vídeos daquela data no
 * mesmo formato do checklist do dia, com produzido/aprovado/concluído, e dá
 * pra adicionar itens extras manualmente em qualquer dia.
 */
export function ChecklistCalendar() {
  const posts = useData((s) => s.posts);
  const videos = useData((s) => s.videos);
  const extras = useData((s) => s.checklistExtras);
  const clientMap = useClientMap();
  const today = todayISO();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [aberto, setAberto] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const map = new Map<string, Linha[]>();
    const add = (data: string | undefined, l: Linha) => {
      if (!data) return;
      if (!map.has(data)) map.set(data, []);
      map.get(data)!.push(l);
    };
    for (const p of posts) if (p.scheduledDate) add(p.scheduledDate, linhaDoPost(p, p.clientId ? clientMap[p.clientId]?.name ?? '—' : '—'));
    for (const v of videos) if (v.dueDate) add(v.dueDate, linhaDoVideo(v, v.clientId ? clientMap[v.clientId]?.name ?? '—' : '—'));
    for (const [data, itens] of Object.entries(extras)) {
      for (const it of itens) {
        add(data, {
          id: it.id, tipo: 'extra', cliente: '—', titulo: it.text,
          produzido: it.done, aprovado: it.done, concluido: it.done,
          onConcluir: () => useData.getState().toggleChecklistExtra(data, it.id),
          onRemover: () => useData.getState().removeChecklistExtra(data, it.id),
        });
      }
    }
    for (const lista of map.values()) lista.sort((a, b) => a.cliente.localeCompare(b.cliente));
    return map;
  }, [posts, videos, extras, clientMap]);

  const primeiroDiaSemana = new Date(ym.y, ym.m, 1).getDay();
  const totalDias = new Date(ym.y, ym.m + 1, 0).getDate();
  const celulas: (string | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ];

  function shift(delta: number) {
    setAberto(null);
    setYm(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  const diaAberto = aberto ? porDia.get(aberto) ?? [] : [];

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-white/85">{MESES[ym.m]} de {ym.y}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"><ChevronLeft size={16} /></button>
          <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium text-white/40">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {celulas.map((data, i) => {
          if (!data) return <div key={`vazio-${i}`} />;
          const linhas = porDia.get(data) ?? [];
          const status = statusDoDia(linhas, data, today);
          const dia = Number(data.slice(-2));
          return (
            <button
              key={data}
              onClick={() => setAberto(data === aberto ? null : data)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold transition',
                STATUS_STYLE[status],
                data === today && 'ring-2 ring-brand-400',
                data === aberto && 'brightness-125',
              )}
            >
              <span>{dia}</span>
              {linhas.length > 0 && <span className="text-[9px] font-normal opacity-70">{linhas.length}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/45">
        <Legenda cor="bg-amber-500/70" label="Em andamento (hoje)" />
        <Legenda cor="bg-white/15" label="Ainda não chegou" />
        <Legenda cor="bg-red-500/70" label="Passou, falta coisa" />
        <Legenda cor="bg-emerald-500/70" label="Tudo saiu" />
      </div>

      {aberto && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className="bg-black px-4 py-2 text-center text-sm font-bold tracking-wide text-white/85">
            {WEEKDAYS_FULL[new Date(aberto + 'T00:00').getDay()]} · {String(new Date(aberto + 'T00:00').getDate()).padStart(2, '0')} DE {MESES_MAI[new Date(aberto + 'T00:00').getMonth()]}
          </div>
          {diaAberto.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {diaAberto.map((l, i) => (
                  <tr key={l.id} className={cn(i > 0 && 'border-t border-line')}>
                    <td className="w-16 border-r border-line px-2.5 py-2 text-[11px] font-medium uppercase text-white/40">
                      {l.tipo === 'post' ? 'post' : l.tipo === 'video' ? 'vídeo' : 'extra'}
                    </td>
                    <td className="w-40 border-r border-line px-2.5 py-2 font-semibold uppercase text-white/85">{l.cliente}</td>
                    <td className="border-r border-line px-2.5 py-2 text-white/70">{l.titulo}</td>
                    {l.tipo === 'extra' ? (
                      <>
                        <Celula ok={l.concluido} label="Feito" onClick={l.onConcluir} />
                        <td className="w-10 border-line p-0">
                          <button onClick={l.onRemover} className="flex h-7 w-full items-center justify-center text-white/25 hover:text-red-300" title="Remover">
                            <X size={13} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <Celula ok={l.produzido} label="Produzido" />
                        <Celula ok={l.aprovado} label="Aprovado" />
                        <Celula ok={l.concluido} label="Concluído" onClick={l.onConcluir} />
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <AdicionarExtra data={aberto} />
        </div>
      )}
    </div>
  );
}

function AdicionarExtra({ data }: { data: string }) {
  const [texto, setTexto] = useState('');
  const add = useData((s) => s.addChecklistExtra);
  function enviar() {
    if (!texto.trim()) return;
    add(data, texto.trim());
    setTexto('');
  }
  return (
    <div className="flex gap-2 border-t border-line bg-white/[0.02] p-2.5">
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Adicionar item nesse dia…"
        onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }} />
      <button onClick={enviar} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-500">
        <Plus size={16} />
      </button>
    </div>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-sm', cor)} />
      {label}
    </span>
  );
}

function Celula({ ok, label, onClick }: { ok: boolean; label: string; onClick?: () => void }) {
  const conteudo = (
    <span className={cn('flex h-7 w-full items-center justify-center gap-1 text-[11px] font-bold', ok ? 'bg-emerald-500/90 text-white' : 'bg-white/[0.03] text-white/20')}>
      {ok ? <Check size={13} /> : <Minus size={12} />}
    </span>
  );
  return (
    <td className="w-20 border-r border-line p-0 last:border-r-0" title={label}>
      {onClick ? (
        <button onClick={onClick} className="block w-full transition hover:brightness-110" title={`Marcar "${label}"`}>
          {conteudo}
        </button>
      ) : conteudo}
    </td>
  );
}
