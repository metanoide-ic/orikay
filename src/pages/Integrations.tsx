import { useState } from 'react';
import { Sparkles, MessageCircle, Instagram, Bell, ShieldCheck, Check, Info, Receipt, Plug } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Field, Input, Textarea, Avatar, Badge } from '@/components/ui';
import { useSettings } from '@/lib/settingsStore';
import { useAuth } from '@/lib/authStore';
import { useData } from '@/lib/dataStore';
import { requestNotifyPermission } from '@/lib/notifications';
import { cn } from '@/lib/utils';

function Section({ icon, title, desc, children, tint }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; tint: string }) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${tint}22`, color: tint }}>{icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-white">{title}</h3>
          {desc && <p className="mt-0.5 text-sm text-white/50">{desc}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-3.5 py-2.5 text-xs text-white/60">
      <Info size={14} className="mt-0.5 shrink-0 text-brand-300" />
      <div>{children}</div>
    </div>
  );
}

export default function Integrations() {
  const s = useSettings();
  const user = useAuth((x) => x.current());
  const accounts = useAuth((x) => x.accounts);
  const setPermission = useAuth((x) => x.setPermission);
  const clients = useData((x) => x.clients);
  const [saved, setSaved] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 1500); }

  return (
    <div>
      <PageHeader title="Integrações" subtitle="Conecte IA, WhatsApp, publicação automática e notificações." />
      {saved && <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300"><Check size={14} /> Salvo automaticamente</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* IA */}
        <Section icon={<Sparkles size={20} />} title="IA para copies" tint="#a855f7"
          desc="Gera legendas automáticas. Grátis por template ou conecte uma IA externa.">
          <div className="grid grid-cols-2 gap-2">
            {(['template', 'api'] as const).map((m) => (
              <button key={m} onClick={() => { s.update({ aiMode: m }); flash(); }}
                className={cn('rounded-xl border px-4 py-3 text-sm font-medium transition', s.aiMode === m ? 'border-brand-400/60 bg-brand-500/10 text-white' : 'border-line text-white/50 hover:border-white/20')}>
                {m === 'template' ? 'Grátis (template)' : 'IA externa (API)'}
              </button>
            ))}
          </div>
          {s.aiMode === 'api' && (
            <>
              <Field label="Endpoint (compatível com OpenAI)" hint="Ex.: Groq, OpenRouter, OpenAI, Gemini (via proxy OpenAI).">
                <Input value={s.aiEndpoint} onChange={(e) => s.update({ aiEndpoint: e.target.value })} placeholder="https://api.groq.com/openai/v1/chat/completions" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Chave (API key)"><Input type="password" value={s.aiKey} onChange={(e) => s.update({ aiKey: e.target.value })} placeholder="sk-…" /></Field>
                <Field label="Modelo"><Input value={s.aiModel} onChange={(e) => s.update({ aiModel: e.target.value })} placeholder="llama-3.3-70b-versatile" /></Field>
              </div>
              <Note>Groq e OpenRouter têm camadas gratuitas generosas. A chave fica salva só neste navegador.</Note>
            </>
          )}
          <Field label="Tom de voz da marca">
            <Textarea value={s.brandVoice} onChange={(e) => s.update({ brandVoice: e.target.value })} className="min-h-[70px]" />
          </Field>
        </Section>

        {/* WhatsApp */}
        <Section icon={<MessageCircle size={20} />} title="WhatsApp" tint="#25D366"
          desc="Envia posts para aprovação e lê as respostas do grupo.">
          <Field label="Webhook de saída (envio ao grupo)" hint="Conecte a Make/n8n/WhatsApp Cloud API.">
            <Input value={s.whatsappWebhook} onChange={(e) => s.update({ whatsappWebhook: e.target.value })} placeholder="https://hook.make.com/…" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-white/70">
            <input type="checkbox" checked={s.sendOnApprovalStage} onChange={(e) => s.update({ sendOnApprovalStage: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" />
            Enviar ao grupo automaticamente ao mover para “Aprovação”
          </label>
          <div>
            <div className="mb-1.5 text-xs font-medium text-white/60">Grupos por cliente</div>
            {clients.length === 0 ? (
              <p className="text-xs text-white/40">Cadastre clientes para mapear os grupos.</p>
            ) : (
              <div className="space-y-1.5">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="w-32 shrink-0 truncate text-sm text-white/70">{c.name}</span>
                    <Input value={c.whatsappGroup ?? ''} onChange={(e) => useData.getState().updateClient(c.id, { whatsappGroup: e.target.value })} placeholder="ID/nome do grupo" className="h-9" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <Note>
            Para a plataforma <b>ler</b> as respostas do grupo e aprovar sozinha, aponte o webhook de
            mensagens recebidas do seu provedor para o endereço de entrada que aparece na tela do
            Conector. Enquanto isso não estiver ligado, use os botões de aprovar e pedir alteração
            dentro do post.
          </Note>
        </Section>

        {/* Publicação */}
        <Section icon={<Instagram size={20} />} title="Publicação automática" tint="#ec4899"
          desc="Posta no feed e no story quando o grupo aprova.">
          <Field label="Webhook de publicação" hint="Conecte à Instagram Graph API via Make/n8n/serviço próprio.">
            <Input value={s.publishWebhook} onChange={(e) => s.update({ publishWebhook: e.target.value })} placeholder="https://hook.make.com/…" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-white/70">
            <input type="checkbox" checked={s.autoPublishOnApproval} onChange={(e) => s.update({ autoPublishOnApproval: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" />
            Publicar automaticamente quando aprovado
          </label>
          <Note>Postar no Instagram exige a Graph API oficial (conta Profissional + Meta). O webhook entrega os dados prontos para seu fluxo publicar — do jeito seguro, sem risco às contas.</Note>
        </Section>

        {/* Conector */}
        <Section icon={<Plug size={20} />} title="Conector Orikay" tint="#7c5cff"
          desc="Programa local que executa WhatsApp, Instagram e tráfego sem depender de outros serviços.">
          <Field label="Endereço do conector" hint="Aparece na tela do conector, normalmente http://localhost:8787/webhook">
            <Input value={s.connectorUrl} onChange={(e) => s.update({ connectorUrl: e.target.value })} placeholder="http://localhost:8787/webhook" />
          </Field>
          <Note>
            Cole o mesmo endereço nos campos de WhatsApp e de publicação abaixo. Este
            campo é o que permite trazer os números das campanhas de tráfego.
          </Note>
        </Section>

        {/* Cobrança */}
        <Section icon={<Receipt size={20} />} title="Cobrança" tint="#34d399"
          desc="Cobra os clientes no WhatsApp e pede a nota fiscal ao contador.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Chave Pix da agência" hint="Vai na mensagem de cobrança por Pix.">
              <Input value={s.pixKey} onChange={(e) => s.update({ pixKey: e.target.value })} placeholder="CNPJ, e-mail ou chave aleatória" />
            </Field>
            <Field label="WhatsApp do contador" hint="Recebe os pedidos de nota fiscal.">
              <Input value={s.contadorWhatsapp} onChange={(e) => s.update({ contadorWhatsapp: e.target.value })} placeholder="55249..." inputMode="tel" />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-white/70">
            <input type="checkbox" checked={s.autoBilling} onChange={(e) => s.update({ autoBilling: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" />
            Gerar e cobrar sozinho todo dia, sem precisar abrir o Financeiro
          </label>
          <Note>
            Com isso ligado, ao abrir a plataforma (em qualquer tela) ela gera as
            cobranças do mês e manda no WhatsApp quem já venceu — uma vez por dia,
            só quem tiver o Conector ou o webhook do WhatsApp configurado abaixo.
            Sem canal de envio configurado, as cobranças ficam prontas mas não saem
            sozinhas, para nunca marcar como enviada uma cobrança que não saiu de
            verdade. Confirmação automática de pagamento exige o gateway (Asaas):
            o Conector dá baixa sozinho quando o cliente paga. Sem gateway, use o
            botão "Marcar paga".
          </Note>
        </Section>

        {/* Notificações */}
        <Section icon={<Bell size={20} />} title="Notificações" tint="#f59e0b"
          desc="Avisa quando um post precisa ir hoje e ainda não foi.">
          <label className="flex items-center gap-2.5 text-sm text-white/70">
            <input type="checkbox" checked={s.notifyEnabled} onChange={async (e) => {
              const on = e.target.checked;
              if (on) { const ok = await requestNotifyPermission(); if (!ok) { setNotifMsg('Permissão negada pelo navegador.'); return; } }
              s.update({ notifyEnabled: on }); setNotifMsg(on ? 'Notificações ativadas.' : '');
            }} className="h-4 w-4 accent-[#7c5cff]" />
            Ativar notificações do navegador (funciona no app instalado)
          </label>
          {notifMsg && <p className="text-xs text-white/50">{notifMsg}</p>}
        </Section>
      </div>

      {/* Permissões (apenas admin) */}
      {user?.admin && (
        <div className="mt-6">
          <Section icon={<ShieldCheck size={20} />} title="Permissões da equipe" tint="#10b981"
            desc="Controle quem acessa o Financeiro e quem é administrador.">
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3">
                  <Avatar name={a.name} color={a.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{a.name} {a.id === user.id && <span className="text-white/40">(você)</span>}</div>
                    <div className="text-xs text-white/45">{a.role}</div>
                  </div>
                  {a.admin && <Badge color="#7c5cff">admin</Badge>}
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input type="checkbox" checked={a.canFinance} onChange={(e) => setPermission(a.id, { canFinance: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" />
                    Financeiro
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input type="checkbox" checked={a.admin} onChange={(e) => setPermission(a.id, { admin: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" />
                    Admin
                  </label>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
