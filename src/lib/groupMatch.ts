import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { connectorPath } from './inbox';
import { acharPorNome } from './utils';

export interface GrupoRemoto {
  id: string;
  nome: string;
}

/** Busca no conector a lista de grupos que a instância de WhatsApp enxerga. */
export async function buscarGruposDoConector(): Promise<{ ok: boolean; grupos: GrupoRemoto[]; erro?: string }> {
  const { connectorUrl } = useSettings.getState();
  if (!connectorUrl) return { ok: false, grupos: [], erro: 'Conector não configurado — cole o endereço dele aqui embaixo primeiro.' };
  try {
    const res = await fetch(connectorPath(connectorUrl, '/grupos'));
    const data = await res.json();
    if (!data?.ok) return { ok: false, grupos: [], erro: data?.erro || 'Não foi possível buscar os grupos.' };
    return { ok: true, grupos: data.grupos ?? [] };
  } catch (e) {
    return { ok: false, grupos: [], erro: `Conector não respondeu: ${(e as Error).message}` };
  }
}

/**
 * Casa cada cliente com o grupo de nome mais parecido — é o "botzinho"
 * decidindo sozinho, pelo nome, em vez de colar o ID de grupo um por um.
 * Só preenche quem ainda está sem grupo cadastrado: nunca troca um grupo
 * que já foi configurado (à mão ou numa busca anterior).
 */
export function autoMatchGroups(grupos: GrupoRemoto[]): { casados: number; semGrupo: string[] } {
  const store = useData.getState();
  let casados = 0;
  const semGrupo: string[] = [];
  for (const client of store.clients) {
    if (client.whatsappGroup) continue;
    const alvo = acharPorNome(client.name, grupos, (g) => g.nome);
    if (alvo) {
      store.updateClient(client.id, { whatsappGroup: alvo.id });
      casados++;
    } else {
      semGrupo.push(client.name);
    }
  }
  return { casados, semGrupo };
}
