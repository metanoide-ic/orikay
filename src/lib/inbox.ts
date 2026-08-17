import { useEffect } from 'react';
import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { onApproved, onRejected } from './automations';
import { markChargePaid } from './billing';

/** Resposta do grupo sobre um post. */
interface PostDecision {
  tipo?: 'post';
  postId: string;
  decisao: 'aprovado' | 'alteracao';
  texto: string;
  quando: number;
}

/** Aviso do gateway de que uma cobrança foi paga. */
interface PaymentDecision {
  tipo: 'pagamento';
  chargeId: string;
  valor: number;
  quando: number;
}

type Decision = PostDecision | PaymentDecision;

/**
 * Troca "/webhook" por outro caminho no endereço do conector, preservando
 * qualquer "?token=" que exista — trocar isso por regex ingênua quebra
 * assim que o endereço tem parâmetro na URL (caso do conector hospedado).
 */
export function connectorPath(url: string, path: string): string {
  try {
    const u = new URL(url.trim());
    u.pathname = u.pathname.replace(/\/webhook\/?$/, '') + path;
    return u.toString();
  } catch {
    return url.trim().replace(/\/+$/, '').replace(/\/webhook$/, '') + path;
  }
}

/**
 * Busca no conector as respostas que o grupo já deu e aplica cada uma:
 * aprovação publica (ou agenda) o post, pedido de alteração manda o post
 * para "Alteração" com o texto do cliente registrado.
 *
 * O conector entrega cada decisão uma única vez, então não há risco de
 * aplicar a mesma resposta duas vezes.
 */
export async function pullDecisions(): Promise<number> {
  const { connectorUrl } = useSettings.getState();
  if (!connectorUrl) return 0;

  let lista: Decision[] = [];
  try {
    const res = await fetch(connectorPath(connectorUrl, '/decisoes'));
    const data = await res.json();
    if (!data?.ok) return 0;
    lista = data.decisoes ?? [];
  } catch {
    return 0; // conector fechado: silencioso de propósito, isso roda em laço
  }

  const store = useData.getState();
  let aplicadas = 0;

  for (const d of lista) {
    if (d.tipo === 'pagamento') {
      const cobranca = store.charges.find((c) => c.id === d.chargeId);
      if (!cobranca || cobranca.status === 'paga') continue;
      markChargePaid(d.chargeId);
      aplicadas++;
      continue;
    }

    if (!store.posts.some((p) => p.id === d.postId)) continue;
    if (d.decisao === 'aprovado') await onApproved(d.postId);
    else onRejected(d.postId, d.texto || 'O cliente pediu alteração no grupo.');
    aplicadas++;
  }
  return aplicadas;
}

const INTERVALO = 20_000;

/** Mantém a plataforma ouvindo as respostas do grupo enquanto estiver aberta. */
export function useApprovalInbox(): void {
  const connectorUrl = useSettings((s) => s.connectorUrl);

  useEffect(() => {
    if (!connectorUrl) return;
    let vivo = true;

    async function ciclo() {
      if (!vivo || document.hidden) return;
      await pullDecisions();
    }

    void ciclo();
    const id = setInterval(ciclo, INTERVALO);
    return () => { vivo = false; clearInterval(id); };
  }, [connectorUrl]);
}
