import { Link } from 'react-router-dom';
import { MessageCircle, Instagram, Cpu, Sparkles, Trash2, Zap, ArrowRight, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Badge, EmptyState } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useSettings } from '@/lib/settingsStore';
import type { AutomationEvent, EventChannel, EventStatus } from '@/lib/types';

const CH: Record<EventChannel, { icon: typeof Cpu; color: string; label: string }> = {
  whatsapp: { icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  instagram: { icon: Instagram, color: '#ec4899', label: 'Instagram' },
  ia: { icon: Sparkles, color: '#a855f7', label: 'IA' },
  sistema: { icon: Cpu, color: '#7c5cff', label: 'Sistema' },
};

const ST: Record<EventStatus, string> = { ok: '#10b981', simulado: '#f59e0b', erro: '#ef4444' };

export default function Automations() {
  const { events, clearEvents } = useData();
  const s = useSettings();
  const wppOk = Boolean(s.whatsappWebhook);
  const pubOk = Boolean(s.publishWebhook);

  return (
    <div>
      <PageHeader
        title="Automações"
        subtitle="Histórico e status do fluxo de aprovação e publicação."
        action={events.length > 0 ? <Button variant="ghost" onClick={clearEvents}><Trash2 size={16} /> Limpar</Button> : undefined}
      />

      {/* Fluxo */}
      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center gap-2 text-white"><Zap size={18} className="text-brand-300" /><h3 className="font-semibold">Como o fluxo funciona</h3></div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {['Arrasta p/ Aprovação', 'IA gera a copy', 'Vai ao grupo do WhatsApp', 'Grupo aprova', 'Publica no feed + story'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-white/80">{step}</span>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-white/30" />}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/50">
          Se o grupo pedir mudança, o post vai para <b className="text-rose-300">Alteração</b> com cada pedido registrado
          separadamente. Reprovou → volta pra edição; refez → reenvia.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge color={wppOk ? '#10b981' : '#f59e0b'}>WhatsApp: {wppOk ? 'conectado' : 'simulado'}</Badge>
          <Badge color={pubOk ? '#10b981' : '#f59e0b'}>Publicação: {pubOk ? 'conectada' : 'simulada'}</Badge>
          <Badge color={s.aiMode === 'api' ? '#10b981' : '#a855f7'}>IA: {s.aiMode === 'api' ? 'externa' : 'grátis (template)'}</Badge>
          <Link to="/app/integracoes" className="ml-auto inline-flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200"><Settings2 size={14} /> Configurar integrações</Link>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<Zap size={40} />} title="Nenhuma atividade registrada"
          description="Mova um post para Aprovação para iniciar o fluxo. Cada etapa fica registrada aqui." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {events.map((e) => <EventRow key={e.id} e={e} />)}
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
