import { Plus, Trash2 } from 'lucide-react';
import { Select, Textarea } from './ui';
import type { MensagemSemanal } from '@/lib/types';
import { uid } from '@/lib/utils';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Mensagens que saem sozinhas no grupo do cliente, toda semana, no dia e
 * hora marcados (ex.: segunda às 9h, pedir os valores da promoção). Quem
 * dispara é o Conector, que fica ligado o tempo todo.
 */
export function MensagensSemanais({ valor, onChange }: { valor: MensagemSemanal[]; onChange: (v: MensagemSemanal[]) => void }) {
  const muda = (id: string, patch: Partial<MensagemSemanal>) => onChange(valor.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-white/70">Mensagens automáticas semanais</div>
          <div className="text-[11px] text-white/40">Saem no grupo do cliente pelo Conector, toda semana.</div>
        </div>
        <button type="button" onClick={() => onChange([...valor, { id: uid('msg'), dia: 1, hora: 9, mensagem: '' }])}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-300 hover:bg-white/5">
          <Plus size={13} /> Adicionar
        </button>
      </div>
      {valor.length === 0 && <p className="text-[11px] text-white/35">Nenhuma. Ex.: toda segunda às 9h, perguntar os valores da promoção da semana.</p>}
      <div className="space-y-3">
        {valor.map((m) => (
          <div key={m.id} className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
            <div className="flex gap-2">
              <Select value={String(m.dia)} onChange={(e) => muda(m.id, { dia: Number(e.target.value) })} aria-label="Dia da semana">
                {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
              <Select value={String(m.hora)} onChange={(e) => muda(m.id, { hora: Number(e.target.value) })} aria-label="Hora">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
              </Select>
              <button type="button" onClick={() => onChange(valor.filter((x) => x.id !== m.id))} aria-label="Remover mensagem"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 size={15} />
              </button>
            </div>
            <Textarea value={m.mensagem} onChange={(e) => muda(m.id, { mensagem: e.target.value })} className="min-h-[64px]"
              placeholder="Bom dia! Quais são os valores da promoção desta semana?" />
          </div>
        ))}
      </div>
    </div>
  );
}
