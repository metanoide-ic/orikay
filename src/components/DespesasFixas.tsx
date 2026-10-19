import { useState } from 'react';
import { CalendarClock, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button, Input, Select } from './ui';
import { useSettings, type DespesaFixa } from '@/lib/settingsStore';
import { generateMonthlyExpenses, inferirDespesasFixas } from '@/lib/expenses';
import { money, parseBRL, uid } from '@/lib/utils';

const CATEGORIAS = ['Equipe', 'Software', 'Terceiros', 'Mídia', 'Outros'];

/**
 * Despesas que se repetem todo mês (folha, aluguel, internet...). Cada uma
 * vira um lançamento pendente no começo do mês, uma vez só.
 */
export function DespesasFixas() {
  const lista = useSettings((s) => s.despesasFixas ?? []);
  const update = useSettings((s) => s.update);
  const [nova, setNova] = useState({ description: '', amount: '', category: 'Outros', day: '5' });
  const [msg, setMsg] = useState('');

  const salvar = (l: DespesaFixa[]) => update({ despesasFixas: l });
  const total = lista.reduce((a, d) => a + d.amount, 0);

  function adicionar() {
    const amount = parseBRL(nova.amount) ?? NaN;
    if (!nova.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMsg('Preencha a descrição e um valor maior que zero.');
      return;
    }
    const day = Math.min(28, Math.max(1, Number(nova.day) || 5));
    salvar([...lista, { id: uid('fixa'), description: nova.description.trim(), amount, category: nova.category, day }]);
    setNova({ description: '', amount: '', category: nova.category, day: nova.day });
    setMsg('');
  }

  function sugerir() {
    const existentes = new Set(lista.map((d) => d.description));
    const sugestoes = inferirDespesasFixas().filter((d) => !existentes.has(d.description));
    if (!sugestoes.length) { setMsg('Nenhuma despesa nova se repetindo há dois meses ou mais nos lançamentos.'); return; }
    salvar([...lista, ...sugestoes]);
    setMsg(`${sugestoes.length} despesa(s) que já se repetiam nos lançamentos foram adicionadas. Confira os valores.`);
  }

  return (
    <div className="mt-6 card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white"><CalendarClock size={17} className="text-brand-300" /> Despesas fixas</h3>
          <p className="mt-0.5 text-xs text-white/45">
            Lançadas como pendentes todo mês, uma vez só. {lista.length > 0 && <>Total: {money(total)} por mês.</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={sugerir}><Wand2 size={14} /> Sugerir pelo histórico</Button>
          {lista.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => {
              const n = generateMonthlyExpenses();
              setMsg(n ? `${n} despesa(s) deste mês lançada(s).` : 'As despesas fixas deste mês já estavam lançadas.');
            }}>Lançar as deste mês</Button>
          )}
        </div>
      </div>

      {lista.length > 0 && (
        <div className="divide-y divide-line">
          {lista.map((d) => (
            <div key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 text-sm sm:grid-cols-[1fr_9rem_8rem_5rem_auto]">
              <Input value={d.description} aria-label="Descrição"
                onChange={(e) => salvar(lista.map((x) => (x.id === d.id ? { ...x, description: e.target.value } : x)))} />
              <Input value={String(d.amount).replace('.', ',')} inputMode="decimal" aria-label="Valor" className="max-sm:hidden"
                onChange={(e) => {
                  const v = parseBRL(e.target.value) ?? NaN;
                  if (Number.isFinite(v)) salvar(lista.map((x) => (x.id === d.id ? { ...x, amount: v } : x)));
                }} />
              <Select value={d.category} aria-label="Categoria" className="max-sm:hidden"
                onChange={(e) => salvar(lista.map((x) => (x.id === d.id ? { ...x, category: e.target.value } : x)))}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Input value={String(d.day)} inputMode="numeric" aria-label="Dia do vencimento" className="max-sm:hidden"
                onChange={(e) => salvar(lista.map((x) => (x.id === d.id ? { ...x, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) } : x)))} />
              <button onClick={() => salvar(lista.filter((x) => x.id !== d.id))} aria-label={`Remover ${d.description}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 border-t border-line bg-white/[0.015] px-5 py-4 sm:grid-cols-[1fr_9rem_8rem_5rem_auto]">
        <Input value={nova.description} onChange={(e) => setNova({ ...nova, description: e.target.value })} placeholder="Ex.: Aluguel da sala" />
        <Input value={nova.amount} onChange={(e) => setNova({ ...nova, amount: e.target.value })} placeholder="Valor (R$)" inputMode="decimal" />
        <Select value={nova.category} onChange={(e) => setNova({ ...nova, category: e.target.value })}>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Input value={nova.day} onChange={(e) => setNova({ ...nova, day: e.target.value })} placeholder="Dia" inputMode="numeric" aria-label="Dia do vencimento" />
        <Button size="sm" onClick={adicionar}><Plus size={14} /> Adicionar</Button>
      </div>
      {msg && <p className="border-t border-line px-5 py-3 text-sm text-white/60">{msg}</p>}
    </div>
  );
}
