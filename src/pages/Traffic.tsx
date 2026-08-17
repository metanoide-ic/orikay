import { useMemo, useState } from 'react';
import { Plus, Megaphone, Trash2, Pencil, RefreshCw, Loader2, ArrowDownToLine } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ClientFilter } from '@/components/ClientFilter';
import { Button, Field, Input, Textarea, Select, Modal, Badge, EmptyState, Stat } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { useClientMap } from '@/lib/hooks';
import { derived, syncCampaignMetrics, postSpendToFinance } from '@/lib/ads';
import { CampaignDoctor, CampaignFindings, SeverityDot } from '@/components/CampaignDoctor';
import { diagnosticar, severidadeGeral } from '@/lib/adsDoctor';
import {
  AREA_LABEL, AREA_ORDEM, FUNNEL_LABEL, OBJETIVO_COM_ROAS, PLATFORM_RULES, RAIO_PADRAO_KM,
  buildUtm, descreverGeo, playbook, verbaMinimaRecomendada,
} from '@/lib/adsPlaybook';
import { money, todayISO } from '@/lib/utils';
import type { AdPlatform, Campaign, CampaignFunnel, CampaignObjective, CampaignStatus, ServiceArea } from '@/lib/types';

const PLATFORMS: AdPlatform[] = ['Meta', 'Google', 'TikTok'];
const OBJECTIVES: CampaignObjective[] = ['Reconhecimento', 'Tráfego', 'Engajamento', 'Mensagens', 'Leads', 'Vendas'];
const STATUS_META: Record<CampaignStatus, { label: string; color: string }> = {
  planejada: { label: 'Planejada', color: '#94a3b8' },
  ativa: { label: 'Ativa', color: '#34d399' },
  pausada: { label: 'Pausada', color: '#f59e0b' },
  encerrada: { label: 'Encerrada', color: '#7c5cff' },
};

const blank = {
  name: '', clientId: '', platform: 'Meta' as AdPlatform, objective: 'Vendas' as CampaignObjective,
  status: 'ativa' as CampaignStatus, dailyBudget: '', totalBudget: '',
  startDate: todayISO(), endDate: '', externalId: '', notes: '',
  funnel: 'topo' as CampaignFunnel, targetCpa: '', targetRoas: '', landingUrl: '',
  geoMode: 'cidade' as ServiceArea, geoPlaces: '', geoRadiusKm: '',
};

const num = (v: string) => (v ? parseFloat(v.replace(',', '.')) : undefined);
const int = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n));

export default function Traffic() {
  const { campaigns, clients, addCampaign, updateCampaign, removeCampaign } = useData();
  const canFinance = !!useAuth((s) => s.current()?.canFinance);
  const clientMap = useClientMap();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(blank);
  const [clientFilter, setClientFilter] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const visible = useMemo(
    () => (clientFilter ? campaigns.filter((c) => c.clientId === clientFilter) : campaigns),
    [campaigns, clientFilter],
  );

  const totals = useMemo(() => {
    const t = visible.reduce(
      (a, c) => ({
        spend: a.spend + c.metrics.spend,
        impressions: a.impressions + c.metrics.impressions,
        clicks: a.clicks + c.metrics.clicks,
        results: a.results + c.metrics.results,
      }),
      { spend: 0, impressions: 0, clicks: 0, results: 0 },
    );
    return { ...t, ...derived({ ...t, reach: 0, results: t.results }) };
  }, [visible]);

  function openNew() {
    setEditing(null);
    // Já nasce com a região do cliente selecionado: o padrão certo evita o
    // erro mais caro, que é subir a campanha aberta para o país inteiro.
    const c = clientFilter ? clientMap[clientFilter] : undefined;
    setForm({
      ...blank,
      clientId: clientFilter,
      geoMode: c?.serviceArea ?? blank.geoMode,
      geoPlaces: (c?.cities ?? []).join(', '),
      geoRadiusKm: (c?.serviceRadiusKm ?? '').toString(),
    });
    setOpen(true);
  }
  function openEdit(c: Campaign) {
    setEditing(c);
    setForm({
      name: c.name, clientId: c.clientId ?? '', platform: c.platform, objective: c.objective,
      status: c.status, dailyBudget: c.dailyBudget?.toString() ?? '', totalBudget: c.totalBudget?.toString() ?? '',
      startDate: c.startDate ?? '', endDate: c.endDate ?? '', externalId: c.externalId ?? '', notes: c.notes ?? '',
      funnel: c.funnel ?? 'topo', targetCpa: c.targetCpa?.toString() ?? '',
      targetRoas: c.targetRoas?.toString() ?? '', landingUrl: c.landingUrl ?? '',
      geoMode: c.geoMode ?? 'cidade', geoPlaces: c.geoPlaces ?? '',
      geoRadiusKm: (c.geoRadiusKm ?? '').toString(),
    });
    setOpen(true);
  }
  function save() {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(), clientId: form.clientId || undefined,
      platform: form.platform, objective: form.objective, status: form.status,
      dailyBudget: num(form.dailyBudget), totalBudget: num(form.totalBudget),
      startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      externalId: form.externalId.trim() || undefined, notes: form.notes.trim() || undefined,
      funnel: form.funnel, targetCpa: num(form.targetCpa), targetRoas: num(form.targetRoas),
      landingUrl: form.landingUrl.trim() || undefined,
      geoMode: form.geoMode, geoPlaces: form.geoPlaces.trim() || undefined,
      geoRadiusKm: form.geoMode === 'raio'
        ? (parseInt(form.geoRadiusKm, 10) || RAIO_PADRAO_KM)
        : undefined,
    };
    if (editing) updateCampaign(editing.id, payload);
    else addCampaign(payload);
    setOpen(false);
  }

  const guia = useMemo(() => playbook(form.platform, form.objective), [form.platform, form.objective]);
  const alertaArea = useMemo(() => {
    const c = form.clientId ? clientMap[form.clientId] : undefined;
    if (!c) return '';
    if (!c.serviceArea) return `${c.name} está sem área de atendimento cadastrada. Preencha no cadastro do cliente para a plataforma conseguir conferir.`;
    if (AREA_ORDEM[form.geoMode] > AREA_ORDEM[c.serviceArea]) {
      return `${c.name} atende ${AREA_LABEL[c.serviceArea].toLowerCase()}. Entregar para ${AREA_LABEL[form.geoMode].toLowerCase()} gasta verba com quem não tem como comprar.`;
    }
    return '';
  }, [form.clientId, form.geoMode, clientMap]);
  const utm = useMemo(
    () => buildUtm({ landingUrl: form.landingUrl, platform: form.platform, name: form.name, objective: form.objective }),
    [form.landingUrl, form.platform, form.name, form.objective],
  );
  const dicaVerba = useMemo(() => {
    const alvo = num(form.targetCpa);
    const minimo = verbaMinimaRecomendada(form.platform, alvo);
    const r = PLATFORM_RULES[form.platform];
    return alvo
      ? `Com esta meta, a verba precisa ser de ${money(minimo)} por dia para juntar ${r.eventosAprendizado} resultados na semana e sair do aprendizado.`
      : `Sem meta não dá para dizer se a campanha está cara. O ${form.platform} pede pelo menos ${money(r.verbaMinimaDia)} por dia.`;
  }, [form.targetCpa, form.platform]);

  async function sincronizar() {
    setSyncing(true);
    const r = await syncCampaignMetrics();
    if (!r.ok) setMsg(r.erro ?? 'Não foi possível sincronizar.');
    else setMsg(
      `${r.atualizadas} campanha(s) atualizada(s).` +
      (r.avisos?.length ? ` Sem retorno de ${r.avisos.join('; ')}.` : ''),
    );
    setSyncing(false);
    setTimeout(() => setMsg(''), 7000);
  }

  return (
    <div>
      <PageHeader
        title="Tráfego pago"
        subtitle="Campanhas por cliente, com verba, resultados e investimento no caixa."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={sincronizar} disabled={syncing}>
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sincronizar números
            </Button>
            <Button onClick={openNew}><Plus size={18} /> Nova campanha</Button>
          </div>
        }
      />

      {msg && <p className="mb-4 rounded-lg border border-line bg-white/[0.03] px-4 py-3 text-sm text-white/75">{msg}</p>}

      <ClientFilter clients={clients} value={clientFilter} onChange={setClientFilter} />

      {campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone size={40} />} title="Nenhuma campanha"
          description="Cadastre as campanhas para acompanhar verba, resultados e custo por resultado."
          action={<Button onClick={openNew}><Plus size={18} /> Nova campanha</Button>} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Investido" value={money(totals.spend)} valueColor="#f87171" />
            <Stat label="Resultados" value={int(totals.results)} dot="#34d399" hint={totals.cpr ? `${money(totals.cpr)} por resultado` : undefined} />
            <Stat label="Cliques" value={int(totals.clicks)} dot="#38bdf8" hint={totals.ctr ? `CTR ${totals.ctr.toFixed(2)}%` : undefined} />
            <Stat label="Impressões" value={int(totals.impressions)} dot="#7c5cff" hint={totals.cpm ? `CPM ${money(totals.cpm)}` : undefined} />
          </div>

          <div className="mt-4">
            <CampaignDoctor campaigns={visible} clients={clientMap} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-white/40">
                  <th className="w-8 px-4 py-3 font-medium"><span className="sr-only">Situação</span></th>
                  <th className="px-4 py-3 font-medium">Campanha</th>
                  <th className="px-3 py-3 font-medium">Verba</th>
                  <th className="px-3 py-3 text-right font-medium">Investido</th>
                  <th className="px-3 py-3 text-right font-medium">Resultados</th>
                  <th className="px-3 py-3 text-right font-medium">Custo/result.</th>
                  <th className="px-3 py-3 text-right font-medium">CTR</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((c) => {
                  const d = derived(c.metrics);
                  const client = c.clientId ? clientMap[c.clientId] : undefined;
                  const achados = diagnosticar(c, c.clientId ? clientMap[c.clientId] : undefined);
                  const pior = severidadeGeral(achados);
                  const resumo = achados.find((a) => a.severidade === pior);
                  return (
                    <tr key={c.id} className="group">
                      <td className="px-4 py-3.5">
                        <SeverityDot sev={pior} title={resumo ? resumo.titulo : 'Sem apontamentos'} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{c.name}</span>
                          <Badge color={STATUS_META[c.status].color}>{STATUS_META[c.status].label}</Badge>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>{c.platform}</span>
                          <span>· {c.objective}</span>
                          {client && (
                            <span className="inline-flex items-center gap-1">
                              · <span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} />{client.name}
                            </span>
                          )}
                          {c.metrics.updatedAt && (
                            <span>· números de {new Date(c.metrics.updatedAt).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-white/60">
                        {c.dailyBudget ? `${money(c.dailyBudget)}/dia` : c.totalBudget ? money(c.totalBudget) : '—'}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-white">{money(c.metrics.spend)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-white">{int(c.metrics.results)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-white/70">{d.cpr ? money(d.cpr) : '—'}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-white/70">{d.ctr ? `${d.ctr.toFixed(2)}%` : '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {canFinance && c.metrics.spend > 0 && !c.postedToFinance && (
                            <Button size="sm" variant="soft" onClick={() => postSpendToFinance(c.id)}>
                              <ArrowDownToLine size={14} /> Lançar no caixa
                            </Button>
                          )}
                          {c.postedToFinance && <span className="text-[11px] text-white/35">no caixa</span>}
                          <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-white"><Pencil size={15} /></button>
                          <button onClick={() => removeCampaign(c.id)} className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar campanha' : 'Nova campanha'} wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button></>}>
        <div className="space-y-4">
          <Field label="Nome da campanha">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Vendas: coleção de verão" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cliente">
              <Select value={form.clientId} onChange={(e) => {
                const c = clientMap[e.target.value];
                setForm({
                  ...form,
                  clientId: e.target.value,
                  ...(c ? {
                    geoMode: c.serviceArea ?? form.geoMode,
                    geoPlaces: c.cities?.length ? c.cities.join(', ') : form.geoPlaces,
                    geoRadiusKm: (c.serviceRadiusKm ?? '').toString(),
                  } : {}),
                });
              }}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Plataforma">
              <Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as AdPlatform })}>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Objetivo">
              <Select value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value as CampaignObjective })}>
                {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Verba por dia"><Input value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} placeholder="0,00" inputMode="decimal" /></Field>
            <Field label="Verba total"><Input value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: e.target.value })} placeholder="0,00" inputMode="decimal" /></Field>
            <Field label="Situação">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}>
                {(Object.keys(STATUS_META) as CampaignStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Início"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Fim"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
            <Field label={`ID na ${form.platform}`} hint="Para puxar os números.">
              <Input value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} placeholder="1203..." />
            </Field>
          </div>
          <div className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-white/45">Metas e funil</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Custo por resultado aceitável" hint={dicaVerba}>
                <Input value={form.targetCpa} onChange={(e) => setForm({ ...form, targetCpa: e.target.value })} placeholder="0,00" inputMode="decimal" />
              </Field>
              {OBJETIVO_COM_ROAS.includes(form.objective) && (
                <Field label="Retorno esperado" hint="Quantos reais de venda para cada real investido.">
                  <Input value={form.targetRoas} onChange={(e) => setForm({ ...form, targetRoas: e.target.value })} placeholder="3" inputMode="decimal" />
                </Field>
              )}
              <Field label="Etapa do funil" hint="Define o limite de frequência.">
                <Select value={form.funnel} onChange={(e) => setForm({ ...form, funnel: e.target.value as CampaignFunnel })}>
                  {(Object.keys(FUNNEL_LABEL) as CampaignFunnel[]).map((f) => (
                    <option key={f} value={f}>{FUNNEL_LABEL[f]}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/45">Onde vai entregar</div>
            <p className="mb-3 text-xs text-white/40">{guia.regiao}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Alcance">
                <Select value={form.geoMode} onChange={(e) => setForm({ ...form, geoMode: e.target.value as ServiceArea })}>
                  {(Object.keys(AREA_LABEL) as ServiceArea[]).map((a) => (
                    <option key={a} value={a}>{AREA_LABEL[a]}</option>
                  ))}
                </Select>
              </Field>
              {form.geoMode === 'raio' ? (
                <>
                  <Field label="Cidade ou endereço central">
                    <Input value={form.geoPlaces} onChange={(e) => setForm({ ...form, geoPlaces: e.target.value })} placeholder="Volta Redonda, RJ" />
                  </Field>
                  <Field label="Raio em km">
                    <Input value={form.geoRadiusKm} onChange={(e) => setForm({ ...form, geoRadiusKm: e.target.value })} placeholder="8" inputMode="numeric" />
                  </Field>
                </>
              ) : form.geoMode !== 'nacional' ? (
                <Field label="Cidades ou estados" hint="Separe por vírgula.">
                  <Input value={form.geoPlaces} onChange={(e) => setForm({ ...form, geoPlaces: e.target.value })} placeholder="Volta Redonda, Barra Mansa" />
                </Field>
              ) : null}
            </div>
            {alertaArea && <p className="mt-3 text-xs text-amber-300">{alertaArea}</p>}
            {editing?.geoReal && (
              <p className="mt-3 text-xs text-white/45">
                No ar agora, segundo a {editing.platform}: {descreverGeo(editing.geoReal)}.
              </p>
            )}
          </div>

          <Field label="Página de destino" hint={utm ? 'Link com UTMs pronto abaixo.' : 'Para gerar as UTMs e medir de onde vem cada venda.'}>
            <Input value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} placeholder="https://cliente.com.br/promocao" />
          </Field>
          {utm && (
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white/50">Link com UTMs</span>
                <button type="button" onClick={() => navigator.clipboard?.writeText(utm)}
                  className="text-xs text-brand-300 transition hover:text-brand-200">Copiar</button>
              </div>
              <p className="break-all font-mono text-xs text-white/60">{utm}</p>
            </div>
          )}

          <div className="rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="mb-2.5 text-xs font-medium uppercase tracking-wide text-white/45">
              Como montar: {form.objective} no {form.platform}
            </div>
            <dl className="space-y-2.5 text-sm">
              {([['Estrutura', guia.estrutura], ['Criativos', guia.criativos], ['Público', guia.publico], ['Medição', guia.medicao]] as const).map(([t, v]) => (
                <div key={t}>
                  <dt className="text-xs font-medium text-white/55">{t}</dt>
                  <dd className="text-white/45">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {editing && <CampaignFindings campaign={editing} client={editing.clientId ? clientMap[editing.clientId] : undefined} />}

          <Field label="Observações">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Público, criativos, testes em andamento." />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
