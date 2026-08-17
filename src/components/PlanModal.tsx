import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Loader2, Send } from 'lucide-react';
import { Modal, Button, Input } from './ui';
import { buildClientSlots, applyPlanToWorkspace, type PlanItem } from '@/lib/planner';
import { generatePlanIdeas } from '@/lib/ai';
import { openPlanPdf } from '@/lib/planPdf';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function PlanModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1); // próximo mês
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentMsg, setSentMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const slots = buildClientSlots(client, ym.y, ym.m);
    generatePlanIdeas(client, slots).then((titles) => {
      if (!alive) return;
      setItems(slots.map((s, i) => ({ ...s, title: titles[i] ?? s.title })));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [client, ym]);

  function shift(delta: number) {
    setYm(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  function enviar() {
    const res = applyPlanToWorkspace(client, items);
    setSentMsg(`${res.posts} posts e ${res.videos} vídeos criados. Já estão prontos no pipeline pra equipe seguir.`);
  }

  const semCadencia = !client.weeklyPlan || Object.values(client.weeklyPlan).every((v) => !v.length);

  return (
    <Modal open onClose={onClose} wide title={`Planejamento: ${client.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"><ChevronLeft size={16} /></button>
            <span className="w-40 text-center font-display text-lg font-semibold text-white">{MESES[ym.m]} {ym.y}</span>
            <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"><ChevronRight size={16} /></button>
          </div>
          <span className="text-sm text-white/45">{items.length} publicações</span>
        </div>

        {semCadencia && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
            Este cliente ainda não tem cadência semanal. Edite o cliente e marque os dias de post e vídeo; as datas comemorativas continuam entrando.
          </p>
        )}

        {loading ? (
          <div className="grid place-items-center py-14 text-white/50"><Loader2 className="animate-spin" size={22} /></div>
        ) : (
          <div className="max-h-[44vh] space-y-1.5 overflow-y-auto pr-1">
            {items.map((item, i) => {
              const d = new Date(item.date + 'T00:00');
              return (
                <div key={`${item.date}-${i}`} className="flex items-start gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                  <span className="w-12 shrink-0 pt-1 text-center">
                    <span className="block font-display text-sm font-semibold text-white">{String(d.getDate()).padStart(2, '0')}</span>
                    <span className="block text-[10px] uppercase text-white/40">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                  </span>
                  <span className={cn('mt-1.5 w-20 shrink-0 text-xs font-medium', item.isVideo ? 'text-cyan-300' : 'text-brand-300')}>{item.type}</span>
                  <div className="flex-1 space-y-1">
                    <Input
                      value={item.title.replace(/^[^:]+:\s*/, '')}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...item, title: `${item.type}: ${e.target.value}` };
                        setItems(next);
                      }}
                      className="h-9 w-full"
                    />
                    <p className="text-[11px] leading-snug text-white/40">{item.brief}</p>
                  </div>
                  {item.holiday && <span className="mt-1.5 shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{item.holiday}</span>}
                </div>
              );
            })}
            {items.length === 0 && <p className="py-10 text-center text-sm text-white/40">Nenhuma publicação neste mês.</p>}
          </div>
        )}

        {sentMsg ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-200">
            {sentMsg}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="soft" onClick={() => { onClose(); navigate('/app/posts'); }}>Abrir Posts</Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" disabled={loading || items.length === 0} onClick={() => openPlanPdf(client, items, ym.y, ym.m)}>
              <FileText size={16} /> Gerar PDF
            </Button>
            <Button disabled={loading || items.length === 0} onClick={enviar}>
              <Send size={16} /> Enviar para produção
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
