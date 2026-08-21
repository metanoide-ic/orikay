import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Instagram, Cpu, Sparkles, Trash2, Zap, ArrowRight, Settings2,
  Send, Receipt, CircleDollarSign, CalendarCheck, ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Badge, EmptyState, Switch } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useSettings } from '@/lib/settingsStore';
import { cn } from '@/lib/utils';
import type { AutomationEvent, EventChannel, EventStatus } from '@/lib/types';

const CH: Record<EventChannel, { icon: typeof Cpu; color: string; label: string }> = {
  whatsapp: { icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  instagram: { icon: Instagram, color: '#ec4899', label: 'Instagram' },
  ia: { icon: Sparkles, color: '#a855f7', label: 'IA' },
  sistema: { icon: Cpu, color: '#7c5cff', label: 'Sistema' },
};

const ST: Record<EventStatus, string> = { ok: '#10b981', simulado: '#f59e0b', erro: '#ef4444' };

/* -------------------------- Cartão de automação ------------------------- */
function AutoCard({
  icon,
  color,
  title,
  desc,
  right,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  desc: string;
  right: ReactNode;
}) {
  return (
    <div className="card flex items-start gap-3.5 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1c`, color }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</p>
      </div>
      <div className="shrink-0 pt-0.5">{right}</div>
    </div>
  );
}

function StatusBadge({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return <Badge color={ok ? '#10b981' : '#f59e0b'}>{ok ? onLabel : offLabel}</Badge>;
}

/* ------------------------------ Fluxos --------------------------------- */
function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-white/80">{step}</span>
          {i < steps.length - 1 && <ArrowRight size={14} className="shrink-0 text-white/30" />}
        </span>
      ))}
    </div>
  );
}

const FLOWS = [
  {
    id: 'posts',
    label: 'Posts',
    steps: ['Arrasta p/ Aprovação', 'IA gera a copy', 'Vai ao grupo do WhatsApp', 'Grupo aprova', 'Publica feed + story'],
    note: 'Se o grupo pedir mudança, o post vai para Alteração com cada pedido registrado separadamente. Reprovou → volta pra edição; refez → reenvia.',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    steps: ['Cobrança gerada no vencimento', 'Enviada no WhatsApp com Pix/boleto', 'Cliente paga', 'Asaas avisa o conector', 'Baixa automática no caixa'],
    note: 'Se o cliente perguntar valor, vencimento ou Pix no WhatsApp, o conector responde sozinho — sem precisar abrir a plataforma.',
  },
] as const;

/* -------------------------------- Página -------------------------------- */
export default function Automations() {
  const { events, clearEvents } = useData();
  const s = useSettings();
  // O Conector cobre os dois canais quando os webhooks avulsos (Make/n8n)
  // não estão configurados — conectado, tudo dispara de verdade por ele.
  const wppOk = Boolean(s.whatsappWebhook || s.connectorUrl);
  const pubOk = Boolean(s.publishWebhook || s.connectorUrl);
  const gatewayOk = Boolean(s.connectorUrl); // confirmação automática de pagamento depende do conector com Asaas
  const [flow, setFlow] = useState<(typeof FLOWS)[number]['id']>('posts');
  const [filtro, setFiltro] = useState<'todos' | EventChannel>('todos');

  const eventosFiltrados = useMemo(
    () => events.filter((e) => filtro === 'todos' || e.channel === filtro),
    [events, filtro],
  );

  const grupos = useMemo(() => {
    const map = new Map<string, AutomationEvent[]>();
    for (const e of eventosFiltrados) {
      const dia = new Date(e.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia)!.push(e);
    }
    return [...map.entries()];
  }, [eventosFiltrados]);

  return (
    <div>
      <PageHeader
        title="Automações"
        subtitle="O que a plataforma faz sozinha, e o histórico de cada vez que agiu."
        action={events.length > 0 ? <Button variant="ghost" onClick={clearEvents}><Trash2 size={16} /> Limpar histórico</Button> : undefined}
      />

      {/* Ligar/desligar */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AutoCard
          icon={<Send size={18} />} color="#25D366" title="Aprovação por WhatsApp"
          desc="Ao mover um post para Aprovação, gera a copy e manda pro grupo do cliente."
          right={<Switch checked={s.sendOnApprovalStage} onChange={(v) => s.update({ sendOnApprovalStage: v })} label="Aprovação por WhatsApp" />}
        />
        <AutoCard
          icon={<Instagram size={18} />} color="#ec4899" title="Publicação automática"
          desc="Quando o grupo aprova, publica sozinho no feed e no story."
          right={<Switch checked={s.autoPublishOnApproval} onChange={(v) => s.update({ autoPublishOnApproval: v })} label="Publicação automática" />}
        />
        <AutoCard
          icon={<CircleDollarSign size={18} />} color="#34d399" title="Cobrança do mês"
          desc="Gera e envia as cobranças vencidas sozinho, toda vez que a plataforma abre."
          right={<Switch checked={s.autoBilling} onChange={(v) => s.update({ autoBilling: v })} label="Cobrança do mês" />}
        />
        <AutoCard
          icon={<Receipt size={18} />} color="#34d399" title="Confirmação de pagamento"
          desc="O Asaas avisa o conector quando o cliente paga, e a cobrança é baixada sozinha."
          right={<StatusBadge ok={gatewayOk} onLabel="conector ligado" offLabel="precisa do conector" />}
        />
        <AutoCard
          icon={<MessageCircle size={18} />} color="#25D366" title="Atendimento de cobrança"
          desc={'Responde sozinho no WhatsApp quando perguntam valor, vencimento ou Pix.'}
          right={<StatusBadge ok={gatewayOk} onLabel="conector ligado" offLabel="precisa do conector" />}
        />
        <AutoCard
          icon={<Sparkles size={18} />} color="#a855f7" title="Copy por IA"
          desc={s.aiMode === 'api' ? `Usando IA externa (${s.aiModel || 'configurada'}).` : 'Usando o gerador local grátis — configure uma chave para textos mais elaborados.'}
          right={<StatusBadge ok={s.aiMode === 'api'} onLabel="IA externa" offLabel="modelo grátis" />}
        />
      </div>

      {/* Checklist do dia */}
      <div className="card mb-6 flex items-center gap-3.5 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><CalendarCheck size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Checklist do dia</p>
          <p className="mt-0.5 text-xs text-white/50">Mostra o que precisa sair hoje e atualiza sozinho conforme cada post é publicado.</p>
        </div>
        <Link to="/app/checklist" className="shrink-0 text-xs text-brand-300 hover:text-brand-200">Ver Checklist</Link>
      </div>

      {/* Como cada fluxo funciona */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 text-white"><Zap size={18} className="text-brand-300" /><h3 className="font-semibold">Como cada fluxo funciona</h3></div>
          <div className="flex gap-1 rounded-full bg-white/[0.04] p-1">
            {FLOWS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFlow(f.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition',
                  flow === f.id ? 'bg-brand-500/25 text-brand-100' : 'text-white/50 hover:text-white',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          <FlowSteps steps={[...FLOWS.find((f) => f.id === flow)!.steps]} />
          <p className="mt-3 text-sm text-white/50">{FLOWS.find((f) => f.id === flow)!.note}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color={wppOk ? '#10b981' : '#f59e0b'}>WhatsApp: {wppOk ? 'conectado' : 'simulado'}</Badge>
            <Badge color={pubOk ? '#10b981' : '#f59e0b'}>Publicação: {pubOk ? 'conectada' : 'simulada'}</Badge>
            <Badge color={s.aiMode === 'api' ? '#10b981' : '#a855f7'}>IA: {s.aiMode === 'api' ? 'externa' : 'grátis (template)'}</Badge>
            <Link to="/app/integracoes" className="ml-auto inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200"><Settings2 size={14} /> Configurar integrações</Link>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['todos', 'whatsapp', 'instagram', 'ia', 'sistema'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition',
              filtro === f ? 'bg-brand-500/20 text-brand-100' : 'text-white/50 hover:bg-white/5',
            )}
          >
            {f === 'todos' ? 'Todos' : CH[f].label}
          </button>
        ))}
      </div>

      {eventosFiltrados.length === 0 ? (
        <EmptyState icon={<Zap size={40} />} title="Nenhuma atividade registrada"
          description="Mova um post para Aprovação, cobre um cliente ou arraste um cartão numa coluna de automação para começar." />
      ) : (
        <div className="space-y-5">
          {grupos.map(([dia, lista]) => (
            <div key={dia}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <ChevronDown size={13} className="text-white/25" />
                <span className="text-xs font-medium uppercase tracking-wide text-white/35">{dia}</span>
              </div>
              <div className="card divide-y divide-line overflow-hidden">
                {lista.map((e) => <EventRow key={e.id} e={e} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ e }: { e: AutomationEvent }) {
  const ch = CH[e.channel];
  const Icon = ch.icon;
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${ch.color}22`, color: ch.color }}><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{e.title}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${ST[e.status]}22`, color: ST[e.status] }}>{e.status}</span>
        </div>
        {e.detail && <p className="mt-1 whitespace-pre-wrap text-xs text-white/50">{e.detail}</p>}
      </div>
      <span className="shrink-0 text-[11px] text-white/35">{new Date(e.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}
