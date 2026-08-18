import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useData, type RemoteSyncData } from './dataStore';
import { useSettings } from './settingsStore';
import { connectorPath } from './inbox';

interface SyncStatus {
  sincronizando: boolean;
  ultimaVez: number | null;
  ultimoErro: boolean;
}

/** Status da sincronização, lido de qualquer tela (ex.: Integrações) — quem roda de fato é `useLiveSync`, montado uma vez só no AppShell. */
export const useSyncStatus = create<SyncStatus>(() => ({
  sincronizando: false,
  ultimaVez: null,
  ultimoErro: false,
}));

/**
 * Sincronização entre a equipe via o Conector: manda os clientes,
 * posts, vídeos e checklist de quem está usando agora, mescla com o que
 * já veio de todo mundo (feito no Conector) e traz de volta — é isso que
 * faz um cartão criado ou uma imagem anexada num dispositivo aparecer
 * nos outros. Sem o Conector configurado, a plataforma continua
 * funcionando normalmente, só que só localmente (como sempre foi).
 */
async function sincronizarAgora(): Promise<boolean> {
  const { connectorUrl } = useSettings.getState();
  if (!connectorUrl) return false;

  const s = useData.getState();
  const payload: RemoteSyncData = {
    clients: s.clients,
    posts: s.posts,
    videos: s.videos,
    checklistExtras: s.checklistExtras,
    tombstones: s.tombstones,
  };

  try {
    const res = await fetch(connectorPath(connectorUrl, '/dados'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data?.ok) return false;
    s.applyRemoteState(data.dados as RemoteSyncData);
    return true;
  } catch {
    return false; // Conector fechado ou fora do ar: silencioso, roda em laço
  }
}

const INTERVALO_MS = 8_000;

/**
 * Mantém a sincronização rodando enquanto a plataforma estiver aberta:
 * uma vez ao entrar, depois a cada ~8s (pausa quando a aba está em
 * segundo plano, pra não gastar bateria/dados à toa). Monta uma vez só,
 * no AppShell — pra ler o status em outra tela, use `useSyncStatus`.
 */
export function useLiveSync(): void {
  const connectorUrl = useSettings((s) => s.connectorUrl);
  const emAndamento = useRef(false);

  useEffect(() => {
    if (!connectorUrl) return;
    let vivo = true;

    async function ciclo() {
      if (!vivo || document.hidden || emAndamento.current) return;
      emAndamento.current = true;
      useSyncStatus.setState({ sincronizando: true });
      const ok = await sincronizarAgora();
      emAndamento.current = false;
      useSyncStatus.setState((st) => ({
        sincronizando: false,
        ultimaVez: ok ? Date.now() : st.ultimaVez,
        ultimoErro: !ok,
      }));
    }

    void ciclo();
    const id = setInterval(ciclo, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [connectorUrl]);
}
