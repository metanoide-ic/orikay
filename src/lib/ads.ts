import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import type { Campaign } from './types';
import { todayISO } from './utils';

/** Indicadores derivados, calculados sempre a partir das métricas brutas. */
export function derived(m: Campaign['metrics']) {
  return {
    ctr: m.impressions ? (m.clicks / m.impressions) * 100 : 0,
    cpc: m.clicks ? m.spend / m.clicks : 0,
    cpm: m.impressions ? (m.spend / m.impressions) * 1000 : 0,
    cpr: m.results ? m.spend / m.results : 0,
  };
}

export interface SyncResult {
  ok: boolean;
  atualizadas: number;
  erro?: string;
  /** Plataformas que falharam sem impedir as demais de sincronizar. */
  avisos?: string[];
}

/**
 * Puxa os números reais das campanhas pelo Conector Orikay.
 * Só funciona com o conector aberto e o endereço preenchido em Integrações.
 */
export async function syncCampaignMetrics(): Promise<SyncResult> {
  const store = useData.getState();
  const { connectorUrl } = useSettings.getState();

  if (!connectorUrl) {
    return { ok: false, atualizadas: 0, erro: 'Informe o endereço do Conector Orikay em Integrações.' };
  }

  const comId = store.campaigns.filter((c) => c.externalId);
  if (comId.length === 0) {
    return {
      ok: false,
      atualizadas: 0,
      erro: 'Nenhuma campanha com o ID preenchido. Abra a campanha e informe o ID que ela tem na plataforma de anúncios.',
    };
  }

  try {
    const res = await fetch(connectorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'metricas',
        campanhas: comId.map((c) => ({ id: c.id, externalId: c.externalId, plataforma: c.platform })),
      }),
    });
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.erro || 'o conector não conseguiu buscar os números');

    let atualizadas = 0;
    for (const item of data.metricas ?? []) {
      const alvo = store.campaigns.find((c) => c.id === item.id);
      if (!alvo) continue;
      store.updateCampaign(alvo.id, {
        metrics: {
          spend: Number(item.spend) || 0,
          impressions: Number(item.impressions) || 0,
          reach: Number(item.reach) || 0,
          clicks: Number(item.clicks) || 0,
          results: Number(item.results) || 0,
          frequency: Number(item.frequency) || undefined,
          revenue: Number(item.revenue) || undefined,
          updatedAt: Date.now(),
        },
        // Histórico só é sobrescrito quando vem: plataforma que não devolve
        // o dia a dia não pode apagar o que já foi guardado.
        ...(Array.isArray(item.history) && item.history.length ? { history: item.history } : {}),
        ...(item.geo ? { geoReal: item.geo } : {}),
      });
      atualizadas++;
    }

    const avisos: string[] = data.avisos ?? [];
    store.addEvent({
      channel: 'sistema',
      title: 'Métricas de tráfego atualizadas',
      status: avisos.length ? 'erro' : 'ok',
      detail: `${atualizadas} campanha(s) sincronizada(s).` + (avisos.length ? ` Sem retorno de: ${avisos.join('; ')}` : ''),
    });
    return { ok: true, atualizadas, avisos };
  } catch (e) {
    const erro = (e as Error).message;
    store.addEvent({ channel: 'sistema', title: 'Falha ao sincronizar métricas', status: 'erro', detail: erro });
    return { ok: false, atualizadas: 0, erro };
  }
}

/** Lança o investimento da campanha como despesa de mídia no caixa. */
export function postSpendToFinance(campaignId: string): void {
  const store = useData.getState();
  const c = store.campaigns.find((x) => x.id === campaignId);
  if (!c || !c.metrics.spend) return;
  const client = store.clients.find((x) => x.id === c.clientId);

  store.addTx({
    type: 'despesa',
    description: `Tráfego pago: ${c.name}${client ? ` (${client.name})` : ''}`,
    amount: c.metrics.spend,
    category: 'Mídia',
    clientId: c.clientId,
    date: todayISO(),
    status: 'pago',
  });
  store.updateCampaign(campaignId, { postedToFinance: true });
  store.addEvent({
    channel: 'sistema',
    title: `Investimento lançado no caixa: ${c.name}`,
    status: 'ok',
    detail: 'Despesa criada na categoria Mídia.',
  });
}
