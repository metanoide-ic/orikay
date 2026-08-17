import { useMemo } from 'react';
import { Check, Minus, ListChecks } from 'lucide-react';
import { useData } from '@/lib/dataStore';
import { useClientMap } from '@/lib/hooks';
import { markPublishedManual } from '@/lib/automations';
import { STAGE_ORDER, VIDEO_STAGE_ORDER } from '@/lib/labels';
import { cn, todayISO } from '@/lib/utils';
import { EmptyState } from '@/components/ui';
import type { Post, VideoProject } from '@/lib/types';

const WEEKDAYS = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

interface Linha {
  id: string;
  tipo: 'post' | 'video';
  cliente: string;
  titulo: string;
  data: string;
  produzido: boolean;
  aprovado: boolean;
  concluido: boolean;
  onConcluir?: () => void;
}

function linhaDoPost(p: Post, clienteNome: string): Linha {
  const idx = STAGE_ORDER.indexOf(p.stage);
  return {
    id: p.id,
    tipo: 'post',
    cliente: clienteNome,
    titulo: p.title,
    data: p.scheduledDate!,
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
    data: v.dueDate!,
    produzido: idx >= VIDEO_STAGE_ORDER.indexOf('edicao'),
    aprovado: idx >= VIDEO_STAGE_ORDER.indexOf('aprovacao') && v.stage !== 'alteracao',
    concluido: false,
    onConcluir: () => useData.getState().updateVideo(v.id, { stage: 'entregue' }),
  };
}

/**
 * Checklist do dia, no formato de planilha que a equipe já usava: um bloco
 * por dia (cabeçalho preto com o dia da semana e a data), linha por post ou
 * vídeo com o tipo, o cliente, a tarefa e três marcações — produzido,
 * aprovado e concluído — que vão ficando verdes sozinhas conforme o item
 * anda no pipeline. A última marcação (concluído) pode ser clicada pra
 * marcar como postado na hora, e o item some da lista de pendentes.
 */
export function DailyChecklist({ fullPage = false }: { fullPage?: boolean }) {
  const posts = useData((s) => s.posts);
  const videos = useData((s) => s.videos);
  const clientMap = useClientMap();
  const today = todayISO();

  const dias = useMemo(() => {
    const linhas: Linha[] = [
      ...posts
        .filter((p) => p.scheduledDate && p.scheduledDate <= today && p.stage !== 'publicado')
        .map((p) => linhaDoPost(p, p.clientId ? clientMap[p.clientId]?.name ?? '—' : '—')),
      ...videos
        .filter((v) => v.dueDate && v.dueDate <= today && v.stage !== 'entregue')
        .map((v) => linhaDoVideo(v, v.clientId ? clientMap[v.clientId]?.name ?? '—' : '—')),
    ];
    const map = new Map<string, Linha[]>();
    for (const l of linhas) {
      if (!map.has(l.data)) map.set(l.data, []);
      map.get(l.data)!.push(l);
    }
    for (const lista of map.values()) lista.sort((a, b) => a.cliente.localeCompare(b.cliente));
    // Mais atrasado primeiro, hoje por último — é o que precisa de atenção na hora.
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [posts, videos, clientMap, today]);

  const totalPendente = dias.reduce((n, [, l]) => n + l.length, 0);

  if (totalPendente === 0) {
    if (!fullPage) return null;
    return (
      <EmptyState
        icon={<ListChecks size={40} />}
        title="Nada pendente por hoje"
        description="Assim que houver posts ou vídeos agendados pra hoje (ou atrasados), eles aparecem aqui, dia por dia, pra marcar conforme forem saindo."
      />
    );
  }

  return (
    <div className={cn('space-y-4', !fullPage && 'mb-6')}>
      {dias.map(([data, linhas]) => (
        <DiaBloco key={data} data={data} linhas={linhas} hoje={data === today} />
      ))}
    </div>
  );
}

function DiaBloco({ data, linhas, hoje }: { data: string; linhas: Linha[]; hoje: boolean }) {
  const d = new Date(data + 'T00:00');
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className={cn('px-4 py-2 text-center text-sm font-bold tracking-wide', hoje ? 'bg-brand-600 text-white' : 'bg-black text-red-300')}>
        {WEEKDAYS[d.getDay()]} · {String(d.getDate()).padStart(2, '0')} DE {MESES[d.getMonth()]}
        {!hoje && <span className="ml-2 font-normal text-red-300/70">(atrasado)</span>}
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.id} className={cn(i > 0 && 'border-t border-line')}>
              <td className="w-16 border-r border-line px-2.5 py-2 text-[11px] font-medium uppercase text-white/40">{l.tipo === 'post' ? 'post' : 'vídeo'}</td>
              <td className="w-44 border-r border-line px-2.5 py-2 font-semibold uppercase text-white/85">{l.cliente}</td>
              <td className="border-r border-line px-2.5 py-2 text-white/70">{l.titulo}</td>
              <Celula ok={l.produzido} label="Produzido" />
              <Celula ok={l.aprovado} label="Aprovado" />
              <Celula ok={l.concluido} label="Concluído" onClick={l.onConcluir} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Celula({ ok, label, onClick }: { ok: boolean; label: string; onClick?: () => void }) {
  const conteudo = (
    <span
      className={cn(
        'flex h-7 w-full items-center justify-center gap-1 text-[11px] font-bold',
        ok ? 'bg-emerald-500/90 text-white' : 'bg-white/[0.03] text-white/20',
      )}
    >
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
