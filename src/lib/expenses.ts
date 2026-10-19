import { useData } from './dataStore';
import { currentMonthKey, monthLabel } from './billing';
import { useSettings, type DespesaFixa } from './settingsStore';
import { uid } from './utils';

/**
 * Gera as despesas fixas do mês corrente, uma vez só (idempotente: quem já
 * tem lançamento no mês, pelo mesmo nome, é pulado). Nascem pendentes — a
 * lista de Lançamentos em Financeiro já funciona como checklist de
 * pagamento, com o clique que alterna pago/pendente.
 */
export function generateMonthlyExpenses(): number {
  // Primeira vez: as despesas fixas eram uma lista no código; agora são da
  // agência. Monta a lista com o que já se repetia mês a mês no Financeiro,
  // para nenhum mês ficar sem lançar.
  const ajustes = useSettings.getState();
  if (!ajustes.despesasFixasIniciadas) {
    ajustes.update({
      despesasFixasIniciadas: true,
      despesasFixas: ajustes.despesasFixas?.length ? ajustes.despesasFixas : inferirDespesasFixas(),
    });
  }
  const s = useData.getState();
  const month = currentMonthKey();
  let criadas = 0;

  const ignorados = new Set(useSettings.getState().geracaoIgnorada ?? []);
  // Cada agência cadastra as suas em Financeiro → Despesas fixas.
  for (const d of useSettings.getState().despesasFixas ?? []) {
    // Id fixo (despesa + mês): não duplica entre aparelhos e, se alguém
    // apagar o lançamento do mês, ele não volta.
    const id = `fixa_${d.id}_${month}`;
    if (ignorados.has(id)) continue;
    const jaExiste = s.transactions.some(
      (t) => t.id === id || (t.type === 'despesa' && t.description === d.description && t.date.slice(0, 7) === month),
    );
    if (jaExiste) continue;
    s.addTx({
      id,
      type: 'despesa',
      description: d.description,
      amount: d.amount,
      category: d.category,
      date: `${month}-${String(d.day).padStart(2, '0')}`,
      status: 'pendente',
    });
    criadas++;
  }

  if (criadas) {
    s.addEvent({
      channel: 'sistema',
      title: `Contas fixas de ${monthLabel(month)} geradas`,
      status: 'ok',
      detail: `${criadas} despesa(s) fixa(s) lançada(s) como pendente.`,
    });
  }
  return criadas;
}

/**
 * Sugere despesas fixas a partir do histórico: o que aparece como despesa,
 * com a mesma descrição, em pelo menos dois meses diferentes. Valor e dia
 * vêm do lançamento mais recente.
 */
export function inferirDespesasFixas(): DespesaFixa[] {
  const porDescricao = new Map<string, { meses: Set<string>; ultimo: { amount: number; category: string; date: string } }>();
  for (const t of useData.getState().transactions) {
    if (t.type !== 'despesa' || !t.description?.trim()) continue;
    const atual = porDescricao.get(t.description) ?? { meses: new Set<string>(), ultimo: t };
    atual.meses.add(t.date.slice(0, 7));
    if (t.date >= atual.ultimo.date) atual.ultimo = t;
    porDescricao.set(t.description, atual);
  }
  return [...porDescricao.entries()]
    .filter(([, v]) => v.meses.size >= 2)
    .map(([description, v]) => ({
      id: uid('fixa'),
      description,
      amount: v.ultimo.amount,
      category: v.ultimo.category,
      day: Math.min(28, Math.max(1, Number(v.ultimo.date.slice(8, 10)) || 5)),
    }))
    .sort((a, b) => a.day - b.day || a.description.localeCompare(b.description));
}
