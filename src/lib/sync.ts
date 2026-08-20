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
 * Sincronização entre a equipe via o Conector: manda clientes, posts,
 * vídeos, financeiro (lançamentos e cobranças), biblioteca, campanhas de
 * tráfego e checklist de quem está usando agora, mescla com o que já
 * veio de todo mundo (feito no Conector) e traz de volta — é isso que
 * faz um cartão criado, uma imagem anexada ou um lançamento financeiro
 * num dispositivo aparecer nos outros. Sem o Conector configurado, a
 * plataforma continua funcionando normalmente, só que só localmente
 * (como sempre foi).
 */
async function sincronizarAgora(): Promise<boolean> {
  const { connectorUrl } = useSettings.getState();
  if (!connectorUrl) return false;

  const s = useData.getState();
  const payload: RemoteSyncData = {
    clients: s.clients,
    posts: s.posts,
    videos: s.videos,
    transactions: s.transactions,
    charges: s.charges,
    library: s.library,
    campaigns: s.campaigns,
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

/**
 * A chave da IA (OpenAI) é da equipe inteira: fica guardada no Conector
 * (arquivo local dele, fora do Git — chave em repositório público é
 * revogada e roubada) e cada navegador se acerta sozinho aqui — quem não
 * tem chave puxa a da equipe; quem acabou de colar uma chave nova empurra
 * pra equipe toda. Colou UMA vez, em qualquer dispositivo, e a IA passa a
 * funcionar pra todo mundo.
 */
async function reconciliarChaveIA(): Promise<void> {
  const s = useSettings.getState();
  if (!s.connectorUrl) return;
  try {
    const res = await fetch(connectorPath(s.connectorUrl, '/config-ia'));
    const data = await res.json();
    if (!data?.ok) return;
    const remota = (data.ia ?? {}) as { endpoint?: string; chave?: string; modelo?: string };

    if (!s.aiKey && remota.chave) {
      // Este navegador ainda não tem chave — puxa a da equipe.
      s.update({
        aiMode: 'api',
        aiKey: remota.chave,
        aiEndpoint: remota.endpoint || s.aiEndpoint,
        aiModel: remota.modelo || s.aiModel,
      });
      return;
    }
    if (s.aiKey && (remota.chave !== s.aiKey || remota.endpoint !== s.aiEndpoint || remota.modelo !== s.aiModel)) {
      // Este navegador tem uma chave/configuração mais nova — empurra pra equipe.
      await fetch(connectorPath(s.connectorUrl, '/config-ia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: s.aiKey, endpoint: s.aiEndpoint, modelo: s.aiModel }),
      });
    }
  } catch {
    // Conector fora do ar: sem drama, tenta de novo na próxima abertura.
  }
}

/**
 * Sem endereço do Conector configurado, tenta achar um rodando NESTA
 * máquina (http://localhost:8787) e se configura sozinho — é o único
 * endereço não-HTTPS que o navegador deixa um site HTTPS chamar, então na
 * máquina da agência (onde o Conector roda) fica verde sem ninguém colar
 * nada. Os outros dispositivos usam o endereço público do túnel, colado
 * uma vez em Integrações.
 */
async function detectarConectorLocal(): Promise<void> {
  const s = useSettings.getState();
  if (s.connectorUrl) return;
  try {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 1_500);
    const res = await fetch('http://localhost:8787/dados', { signal: controle.signal });
    clearTimeout(limite);
    const data = await res.json();
    // Só configura se responder como o Conector de verdade responde.
    if (data?.ok === true && data.dados) {
      s.update({ connectorUrl: 'http://localhost:8787' });
    }
  } catch {
    // Nada rodando aqui: normal em qualquer máquina que não é a do Conector.
  }
}

const INTERVALO_MS = 3_000;

/**
 * Mantém a sincronização rodando enquanto a plataforma estiver aberta:
 * uma vez ao entrar (manda de cara tudo que o dispositivo já tinha
 * localmente, mesmo o que foi criado antes de existir sincronização —
 * o Conector mescla com o resto da equipe e devolve a verdade
 * combinada), depois a cada ~3s (pausa quando a aba está em segundo
 * plano, pra não gastar bateria/dados à toa). Monta uma vez só, no
 * AppShell — pra ler o status em outra tela, use `useSyncStatus`.
 */
export function useLiveSync(): void {
  const connectorUrl = useSettings((s) => s.connectorUrl);
  const aiKey = useSettings((s) => s.aiKey);
  const emAndamento = useRef(false);

  // Acerta a chave da IA com a equipe: na entrada e sempre que a chave
  // local mudar (com um respiro de 1,2s pra não disparar a cada tecla
  // digitada no campo de Integrações).
  useEffect(() => {
    if (!connectorUrl) return;
    const id = setTimeout(() => { void reconciliarChaveIA(); }, 1_200);
    return () => clearTimeout(id);
  }, [connectorUrl, aiKey]);

  // Sem endereço configurado: procura um Conector nesta máquina, agora e a
  // cada 15s — se alguém abrir o Conector depois do site, conecta sozinho.
  useEffect(() => {
    if (connectorUrl) return;
    void detectarConectorLocal();
    const id = setInterval(() => { void detectarConectorLocal(); }, 15_000);
    return () => clearInterval(id);
  }, [connectorUrl]);

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
