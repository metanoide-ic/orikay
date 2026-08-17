import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { fireWebhook } from './automations';
import type { Client } from './types';

/** Só entram os agentes ativos: têm o prefixo "Omni " e o grupo cadastrado. */
export function omniAtivos() {
  return useData.getState().clients.filter((c) => c.name.startsWith('Omni ') && c.whatsappGroup);
}

/** Todo cliente com grupo de WhatsApp cadastrado — a audiência possível de um disparo em massa. */
export function clientesComGrupo(): Client[] {
  return useData.getState().clients.filter((c) => c.whatsappGroup);
}

/**
 * Manda a mesma mensagem para o grupo de WhatsApp de cada agente Omni ativo.
 * Quem saiu (sem grupo cadastrado) fica de fora — não tem como adivinhar.
 */
export async function sendOmniBroadcast(mensagem: string): Promise<{ enviados: number; falhas: number }> {
  return sendBroadcast(mensagem, omniAtivos());
}

/**
 * Manda a mesma mensagem para o grupo de WhatsApp de cada cliente da lista.
 * Base do "IA Helper" de disparo em massa — a lista de alvos é sempre
 * decidida na tela (nunca adivinhada pela IA), pra nunca mandar pra quem
 * não devia.
 */
export async function sendBroadcast(mensagem: string, alvos: Client[]): Promise<{ enviados: number; falhas: number }> {
  const store = useData.getState();
  const settings = useSettings.getState();
  let enviados = 0;
  let falhas = 0;

  for (const client of alvos) {
    const payload = { tipo: 'mensagem', numero: client.whatsappGroup, cliente: client.name, mensagem };
    let ok = false;
    let detalhe = '';
    if (settings.connectorUrl) {
      try {
        const res = await fetch(settings.connectorUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        ok = Boolean(data?.ok);
        detalhe = data?.erro ?? '';
      } catch (e) {
        detalhe = (e as Error).message;
      }
    } else if (settings.whatsappWebhook) {
      ok = await fireWebhook(settings.whatsappWebhook, payload);
    }
    if (ok) enviados++; else falhas++;
    store.addEvent({
      channel: 'whatsapp',
      title: `Aviso para ${client.name}`,
      status: ok ? 'ok' : 'erro',
      detail: ok ? 'Enviado ao grupo.' : (detalhe || 'Conector/webhook do WhatsApp não configurado.'),
    });
  }
  return { enviados, falhas };
}
