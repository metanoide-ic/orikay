import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Plus,
  Wallet,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Modal, Select, Badge, EmptyState, Stat } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useSettings } from '@/lib/settingsStore';
import { useClientMap, monthKey } from '@/lib/hooks';
import {
  generateMonthlyCharges, sendCharge, sendAllPending, markChargePaid,
  isOverdue, currentMonthKey, monthLabel, METHOD_LABEL,
} from '@/lib/billing';
import { generateMonthlyExpenses } from '@/lib/expenses';
import { money, todayISO, cn } from '@/lib/utils';
import type { TxType, TxStatus } from '@/lib/types';

const CATEGORIES = ['Contrato', 'Projeto', 'Mídia', 'Software', 'Terceiros', 'Equipe', 'Outros'];

export default function Finance() {
  const { transactions, clients, charges, addTx, updateTx, removeTx, removeCharge } = useData();
  const autoBilling = useSettings((s) => s.autoBilling);
  const clientMap = useClientMap();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'todos' | TxType>('todos');
  const [billingMsg, setBillingMsg] = useState('');

  // Gera as cobranças e as contas fixas do mês automaticamente (idempotente).
  useEffect(() => {
    if (autoBilling) generateMonthlyCharges();
    generateMonthlyExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const month = currentMonthKey();
  const monthCharges = useMemo(
    () =>
      charges
        .filter((c) => c.month === month)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [charges, month],
  );
  const chargeTotals = useMemo(() => {
    const pagas = monthCharges.filter((c) => c.status === 'paga');
    const atrasadas = monthCharges.filter(isOverdue);
    return { pagas: pagas.length, atrasadas: atrasadas.length, total: monthCharges.length };
  }, [monthCharges]);

  const [form, setForm] = useState({
    type: 'receita' as TxType,
    description: '',
    amount: '',
    category: 'Contrato',
    clientId: '',
    date: todayISO(),
    status: 'pago' as TxStatus,
  });

  const totals = useMemo(() => {
    const receita = transactions.filter((t) => t.type === 'receita' && t.status === 'pago').reduce((a, t) => a + t.amount, 0);
    const despesa = transactions.filter((t) => t.type === 'despesa' && t.status === 'pago').reduce((a, t) => a + t.amount, 0);
    const pendente = transactions.filter((t) => t.status === 'pendente' && t.type === 'receita').reduce((a, t) => a + t.amount, 0);
    return { receita, despesa, saldo: receita - despesa, pendente };
  }, [transactions]);

  const chart = useMemo(() => {
    const map = new Map<string, { receita: number; despesa: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(d.toISOString().slice(0, 7), { receita: 0, despesa: 0 });
    }
    transactions.forEach((t) => {
      const e = map.get(monthKey(t.date));
      if (e) e[t.type] += t.amount;
    });
    return [...map.entries()].map(([k, v]) => ({
      mes: new Date(k + '-02').toLocaleDateString('pt-BR', { month: 'short' }),
      ...v,
    }));
  }, [transactions]);

  const list = useMemo(
    () =>
      transactions
        .filter((t) => filter === 'todos' || t.type === filter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, filter],
  );

  // Checklist de pagamentos do mês: despesas fixas + as demais lançadas.
  const monthExpenses = useMemo(
    () => transactions.filter((t) => t.type === 'despesa' && monthKey(t.date) === month),
    [transactions, month],
  );
  const expensesPaid = monthExpenses.filter((t) => t.status === 'pago').length;

  function save() {
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!form.description.trim() || !amount || amount <= 0) return;
    addTx({
      type: form.type,
      description: form.description.trim(),
      amount,
      category: form.category,
      clientId: form.clientId || undefined,
      date: form.date,
      status: form.status,
    });
    setForm({ ...form, description: '', amount: '' });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas, despesas e saldo da agência."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} /> Lançamento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receitas (pagas)" value={money(totals.receita)} valueColor="#34d399" />
        <Stat label="Despesas (pagas)" value={money(totals.despesa)} valueColor="#f87171" />
        <Stat label="Saldo" value={money(totals.saldo)} dot="#7c5cff" />
        <Stat label="A receber" value={money(totals.pendente)} dot="#f59e0b" />
      </div>

      {/* Cobranças do mês */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">Cobranças de {monthLabel(month)}</h3>
            <p className="mt-0.5 text-xs text-white/45">
              {chargeTotals.total} cobrança(s) · {chargeTotals.pagas} paga(s)
              {chargeTotals.atrasadas > 0 && <span className="text-red-300"> · {chargeTotals.atrasadas} atrasada(s)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const n = generateMonthlyCharges();
              setBillingMsg(n ? `${n} cobrança(s) nova(s) gerada(s).` : 'Todas as cobranças do mês já estão geradas.');
              setTimeout(() => setBillingMsg(''), 4000);
            }}>Gerar cobranças</Button>
            <Button size="sm" onClick={async () => {
              const n = await sendAllPending();
              setBillingMsg(n ? `${n} cobrança(s) enviada(s) no WhatsApp.` : 'Nenhuma cobrança vencida pendente de envio.');
              setTimeout(() => setBillingMsg(''), 4000);
            }}>Cobrar vencidas</Button>
          </div>
        </div>
        {billingMsg && <p className="border-b border-line bg-white/[0.02] px-5 py-2.5 text-sm text-white/70">{billingMsg}</p>}
        {monthCharges.length > 0 && (
          <div className="border-b border-line px-5 py-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.round((chargeTotals.pagas / chargeTotals.total) * 100)}%` }} />
            </div>
          </div>
        )}
        {monthCharges.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-white/40">
            Nenhuma cobrança este mês. Defina o fee mensal dos clientes para gerar automaticamente.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {monthCharges.map((ch) => {
                const client = clientMap[ch.clientId];
                const overdue = isOverdue(ch);
                return (
                  <tr key={ch.id} className="group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: client?.color ?? '#666' }} />
                        <span className="font-medium text-white">{client?.name ?? 'Cliente removido'}</span>
                        {client?.billingWhatsapp && <span className="hidden text-xs text-white/35 sm:inline">{client.billingWhatsapp}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-white/60">{METHOD_LABEL[ch.method]}</td>
                    <td className="px-3 py-3 text-xs text-white/60">
                      vence {new Date(ch.dueDate + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{money(ch.amount)}</td>
                    <td className="px-3 py-3">
                      {ch.status === 'paga'
                        ? <Badge color="#34d399">Paga</Badge>
                        : overdue
                          ? <Badge color="#f87171">Atrasada</Badge>
                          : ch.status === 'enviada'
                            ? <Badge color="#60a5fa">Enviada</Badge>
                            : <Badge>Pendente</Badge>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {ch.status !== 'paga' && (
                          <>
                            <Button size="sm" variant="soft" onClick={() => { void sendCharge(ch.id); }}>
                              {ch.status === 'enviada' ? 'Reenviar' : 'Cobrar'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => markChargePaid(ch.id)}>Marcar paga</Button>
                          </>
                        )}
                        <button onClick={() => removeCharge(ch.id)} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 opacity-0 transition hover:text-red-300 group-hover:opacity-100">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 card p-5">
        <h3 className="mb-4 font-semibold text-white">Evolução (6 meses)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: '#ffffff66', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#ffffff44', fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip
                contentStyle={{ background: '#17171c', border: '1px solid #24242c', borderRadius: 12, color: '#fff' }}
                formatter={(v: number) => money(v)}
              />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2} fill="url(#gR)" />
              <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#7c5cff" strokeWidth={2} fill="url(#gD)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lançamentos */}
      <div className="mt-6">
        {monthExpenses.length > 0 && (
          <div className="mb-3 card px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>Checklist de pagamentos — {monthLabel(month)}</span>
              <span>{expensesPaid}/{monthExpenses.length} pagas</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-brand-400 transition-all"
                style={{ width: `${Math.round((expensesPaid / monthExpenses.length) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="mb-3 flex items-center gap-2">
          {(['todos', 'receita', 'despesa'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition',
                filter === f ? 'bg-brand-500/20 text-brand-100' : 'text-white/50 hover:bg-white/5',
              )}
            >
              {f === 'todos' ? 'Todos' : f === 'receita' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<Wallet size={40} />}
            title="Nenhum lançamento"
            description="Registre receitas e despesas para acompanhar o caixa."
            action={<Button onClick={() => setOpen(true)}><Plus size={18} /> Novo lançamento</Button>}
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {list.map((t) => {
              const client = t.clientId ? clientMap[t.clientId] : undefined;
              const income = t.type === 'receita';
              return (
                <div key={t.id} className="group flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                      income ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-500/15 text-brand-300',
                    )}
                  >
                    {income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{t.description}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/45">
                      <span>{new Date(t.date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                      <span>· {t.category}</span>
                      {client && (
                        <span className="inline-flex items-center gap-1">
                          · <span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} /> {client.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => updateTx(t.id, { status: t.status === 'pago' ? 'pendente' : 'pago' })}
                    title="Alternar status"
                  >
                    <Badge color={t.status === 'pago' ? '#10b981' : '#f59e0b'}>
                      {t.status === 'pago' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </button>
                  <div className={cn('w-28 text-right font-semibold tabular-nums', income ? 'text-emerald-400' : 'text-white')}>
                    {income ? '+' : '−'} {money(t.amount)}
                  </div>
                  <button
                    onClick={() => removeTx(t.id)}
                    className="text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo lançamento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['receita', 'despesa'] as TxType[]).map((tp) => (
              <button
                key={tp}
                onClick={() => setForm({ ...form, type: tp })}
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm font-medium capitalize transition',
                  form.type === tp
                    ? tp === 'receita'
                      ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-brand-400/50 bg-brand-500/10 text-brand-200'
                    : 'border-line text-white/50 hover:border-white/20',
                )}
              >
                {tp}
              </button>
            ))}
          </div>
          <Field label="Descrição">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Fee mensal — Cliente X" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)">
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" inputMode="decimal" />
            </Field>
            <Field label="Data">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TxStatus })}>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </Select>
            </Field>
          </div>
          <Field label="Cliente (opcional)">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

