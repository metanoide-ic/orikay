import { useData } from './dataStore';
import { currentMonthKey, monthLabel } from './billing';

/**
 * Despesas fixas da agência: folha, casa e estrutura. Servem de modelo para
 * gerar o lançamento do mês — o valor pode ser ajustado depois (a conta de
 * luz, por exemplo, varia).
 */
const DESPESAS_FIXAS: Array<{ description: string; amount: number; category: string; day: number }> = [
  { description: 'AL7 - Daniel Designer', amount: 2100, category: 'Equipe', day: 5 },
  { description: 'AL7 - João Paulo', amount: 3000, category: 'Equipe', day: 5 },
  { description: 'AL7 - Júnior Gerenciador', amount: 2500, category: 'Equipe', day: 5 },
  { description: 'Celular', amount: 250, category: 'Software', day: 5 },
  { description: 'Internet', amount: 150, category: 'Software', day: 5 },
  { description: 'Aluguel Casa', amount: 3000, category: 'Outros', day: 10 },
  { description: 'Carro', amount: 1500, category: 'Outros', day: 10 },
  { description: 'Contador - Carlos', amount: 400, category: 'Terceiros', day: 10 },
  { description: 'Plano de Saúde', amount: 1000, category: 'Outros', day: 10 },
  { description: 'Luz', amount: 600, category: 'Outros', day: 19 },
];

/**
 * Gera as despesas fixas do mês corrente, uma vez só (idempotente: quem já
 * tem lançamento no mês, pelo mesmo nome, é pulado). Nascem pendentes — a
 * lista de Lançamentos em Financeiro já funciona como checklist de
 * pagamento, com o clique que alterna pago/pendente.
 */
export function generateMonthlyExpenses(): number {
  const s = useData.getState();
  const month = currentMonthKey();
  let criadas = 0;

  for (const d of DESPESAS_FIXAS) {
    const jaExiste = s.transactions.some(
      (t) => t.type === 'despesa' && t.description === d.description && t.date.slice(0, 7) === month,
    );
    if (jaExiste) continue;
    s.addTx({
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
