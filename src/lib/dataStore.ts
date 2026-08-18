import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AutomationEvent,
  Board,
  BoardArea,
  Campaign,
  Card,
  Charge,
  ChecklistItem,
  Client,
  Column,
  ColumnAutomation,
  LibraryItem,
  Post,
  PostStage,
  Transaction,
  VideoLink,
  VideoProject,
  VideoStage,
} from './types';
import { uid, acharPorNome, normalizarNome } from './utils';
import { seedData, OLD_BRIEFINGS } from './seed';

/** Todo tipo de registro que participa da sincronização com o Conector. */
type TipoRegistro = 'post' | 'video' | 'cliente' | 'transacao' | 'cobranca' | 'biblioteca' | 'campanha';

interface DataState {
  clients: Client[];
  boards: Board[];
  transactions: Transaction[];
  posts: Post[];
  videos: VideoProject[];
  library: LibraryItem[];
  events: AutomationEvent[];
  charges: Charge[];
  campaigns: Campaign[];
  seeded: boolean;
  /**
   * Memória de quais ângulos editoriais já foram usados por cliente, pra
   * planejamento nunca repetir tema antes de passar por todos os outros.
   * Guarda uma fila embaralhada restante por cliente+formato — quando
   * esvazia, embaralha de novo (sem repetir o último usado na virada).
   */
  angleMemory: Record<string, { foto: number[]; video: number[] }>;

  /** Itens extras do checklist do calendário, adicionados manualmente por dia (chave = data ISO). */
  checklistExtras: Record<string, ChecklistItem[]>;
  addChecklistExtra: (date: string, text: string) => void;
  toggleChecklistExtra: (date: string, id: string) => void;
  removeChecklistExtra: (date: string, id: string) => void;

  loadDemo: () => void;
  /** Repõe clientes da carteira que tenham sido removidos, sem apagar nada. */
  restoreClients: () => number;
  /**
   * Preenche fee, dia de vencimento, forma de pagamento e contato de quem já
   * existe mas nasceu sem esses dados (base antiga, de antes da carteira ter
   * sido cadastrada). Só entra em campo que estiver vazio — nunca sobrescreve
   * o que já foi preenchido na tela (grupo, WhatsApp de cobrança, documento).
   */
  restoreBillingFields: () => number;
  /**
   * Atualiza o briefing de quem ainda está com a versão antiga (igual ao
   * que já veio pronto de fábrica), trazendo pesquisa nova feita sobre os
   * clientes reais. Nunca mexe em briefing que a equipe já editou na tela —
   * só troca quando o texto atual é idêntico ao briefing anterior salvo em
   * código, senão ficaria sobrescrevendo edição manual de alguém.
   */
  restoreBriefings: () => number;
  resetAll: () => void;

  // Clientes
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  removeClient: (id: string) => void;

  // Quadros
  addBoard: (b: { name: string; description?: string; clientId?: string; area?: BoardArea }) => Board;
  /** Retorna o quadro do cliente, criando um se ainda não existir. */
  ensureClientBoard: (clientId: string, name: string) => Board;
  removeBoard: (id: string) => void;
  renameBoard: (id: string, name: string) => void;
  addColumn: (boardId: string, title: string, automation?: ColumnAutomation) => void;
  renameColumn: (boardId: string, colId: string, title: string) => void;
  setColumnAutomation: (boardId: string, colId: string, automation: ColumnAutomation) => void;
  removeColumn: (boardId: string, colId: string) => void;
  addCard: (boardId: string, colId: string, card: Partial<Card> & { title: string }) => void;
  updateCard: (boardId: string, cardId: string, patch: Partial<Card>) => void;
  removeCard: (boardId: string, colId: string, cardId: string) => void;
  moveCard: (
    boardId: string,
    cardId: string,
    toColId: string,
    toIndex: number,
  ) => void;

  // Financeiro
  addTx: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTx: (id: string, patch: Partial<Transaction>) => void;
  removeTx: (id: string) => void;

  // Posts
  addPost: (p: Omit<Post, 'id' | 'createdAt' | 'checklist' | 'revisions'> & { checklist?: Post['checklist'] }) => Post;
  updatePost: (id: string, patch: Partial<Post>) => void;
  setPostStage: (id: string, stage: PostStage) => void;
  movePost: (postId: string, toStage: PostStage, toIndex: number) => void;
  removePost: (id: string) => void;
  addRevision: (postId: string, text: string) => void;
  updateRevision: (postId: string, revId: string, patch: Partial<{ text: string; resolved: boolean }>) => void;
  removeRevision: (postId: string, revId: string) => void;

  // Vídeos
  addVideo: (v: { title: string; clientId?: string; editor?: string; dueDate?: string; notes?: string; mediaUrls?: string[] }) => VideoProject;
  updateVideo: (id: string, patch: Partial<VideoProject>) => void;
  removeVideo: (id: string) => void;
  moveVideo: (id: string, stage: VideoStage) => void;
  addVideoLink: (id: string, link: Omit<VideoLink, 'id'>) => void;
  removeVideoLink: (id: string, linkId: string) => void;
  addVideoRevision: (id: string, text: string) => void;
  toggleVideoRevision: (id: string, revId: string) => void;

  // Biblioteca
  addLibraryItem: (i: Omit<LibraryItem, 'id' | 'createdAt'>) => void;
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void;
  removeLibraryItem: (id: string) => void;

  // Automações
  addEvent: (e: Omit<AutomationEvent, 'id' | 'createdAt'>) => void;
  clearEvents: () => void;

  // Tráfego pago
  addCampaign: (c: Omit<Campaign, 'id' | 'createdAt' | 'metrics'> & { metrics?: Campaign['metrics'] }) => void;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;

  // Cobranças
  upsertCharges: (list: Charge[]) => void;
  updateCharge: (id: string, patch: Partial<Charge>) => void;
  removeCharge: (id: string) => void;

  /**
   * Tira o próximo índice de ângulo pra esse cliente+formato, sem repetir
   * nenhum antes de passar pelo pool inteiro. `poolSize` é o tamanho atual
   * do pool de ângulos (se o código adicionar mais ângulos depois, a fila
   * antiga é descartada e recomeça do zero automaticamente).
   */
  nextAngle: (clientId: string, tipo: 'foto' | 'video', poolSize: number) => number;

  /**
   * Registros excluídos recentemente (post/vídeo/cliente) — sem isso, a
   * sincronização com o Conector faria um registro apagado aqui
   * "ressuscitar" quando outro dispositivo, que ainda tem ele localmente,
   * manda de volta na próxima sincronização.
   */
  tombstones: Array<{ tipo: TipoRegistro; id: string; quando: number }>;
  /**
   * Aplica o estado que veio do Conector (já mesclado lá com o de todo
   * mundo): registro por registro, ganha quem tiver o `updatedAt` mais
   * recente; ids marcados como excluídos (tombstones, de qualquer lado)
   * somem daqui. Usada só pelo módulo de sincronização (`lib/sync.ts`).
   */
  applyRemoteState: (remote: RemoteSyncData) => void;
}

const empty = {
  clients: [], boards: [], transactions: [], posts: [],
  videos: [], library: [], events: [], charges: [], campaigns: [],
  angleMemory: {} as Record<string, { foto: number[]; video: number[] }>,
  checklistExtras: {} as Record<string, ChecklistItem[]>,
  tombstones: [] as Array<{ tipo: TipoRegistro; id: string; quando: number }>,
};

/** Formato trocado com o Conector pra sincronizar a plataforma inteira entre a equipe. */
export interface RemoteSyncData {
  clients: Client[];
  posts: Post[];
  videos: VideoProject[];
  transactions: Transaction[];
  charges: Charge[];
  library: LibraryItem[];
  campaigns: Campaign[];
  checklistExtras: Record<string, ChecklistItem[]>;
  tombstones: Array<{ tipo: TipoRegistro; id: string; quando: number }>;
}

/** Mescla um registro só (por id) com o remoto: fica quem tem updatedAt mais novo. Sem updatedAt em nenhum dos dois, o local prevalece (evita sumir dado antigo). */
function mesclarLista<T extends { id: string; updatedAt?: number }>(locais: T[], remotos: T[], excluidos: Set<string>): T[] {
  const porId = new Map<string, T>();
  for (const l of locais) porId.set(l.id, l);
  for (const r of remotos) {
    const atual = porId.get(r.id);
    if (!atual || (r.updatedAt ?? 0) > (atual.updatedAt ?? 0)) porId.set(r.id, r);
  }
  return [...porId.values()].filter((x) => !excluidos.has(x.id));
}

/**
 * Antes da sincronização existir, cada dispositivo semeava a própria
 * carteira de clientes sozinho — o mesmo "Vidroscar" nasceu com um id
 * diferente em cada tela. Sem tratar isso, a primeira sincronização
 * duplicaria a carteira inteira. Agrupa por nome normalizado; o mais
 * antigo (createdAt menor) vira o canônico, os outros viram tombstone e
 * têm o clientId de post/vídeo remapeado pro canônico.
 */
function deduplicarClientesPorNome(
  clients: Client[],
  posts: Post[],
  videos: VideoProject[],
  transactions: Transaction[],
  charges: Charge[],
  campaigns: Campaign[],
): {
  clients: Client[]; posts: Post[]; videos: VideoProject[];
  transactions: Transaction[]; charges: Charge[]; campaigns: Campaign[];
  excluidos: Array<{ tipo: 'cliente'; id: string; quando: number }>;
} {
  const grupos = new Map<string, Client[]>();
  for (const c of clients) {
    const chave = normalizarNome(c.name);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(c);
  }

  const remap = new Map<string, string>(); // id perdedor -> id canônico
  const canonicos: Client[] = [];
  const excluidos: Array<{ tipo: 'cliente'; id: string; quando: number }> = [];

  for (const grupo of grupos.values()) {
    if (grupo.length === 1) { canonicos.push(grupo[0]); continue; }
    const ordenado = [...grupo].sort((a, b) => a.createdAt - b.createdAt);
    const [vencedor, ...perdedores] = ordenado;
    // O vencedor fica com o melhor de cada campo preenchido entre os duplicados,
    // pra não perder briefing/grupo de WhatsApp que só um dos dois tinha.
    let mesclado = vencedor;
    for (const p of perdedores) {
      mesclado = {
        ...p, ...mesclado,
        briefing: mesclado.briefing || p.briefing,
        whatsappGroup: mesclado.whatsappGroup || p.whatsappGroup,
        cities: mesclado.cities?.length ? mesclado.cities : p.cities,
        weeklyPlan: Object.keys(mesclado.weeklyPlan ?? {}).length ? mesclado.weeklyPlan : p.weeklyPlan,
        updatedAt: Date.now(),
      };
      remap.set(p.id, vencedor.id);
      excluidos.push({ tipo: 'cliente', id: p.id, quando: Date.now() });
    }
    canonicos.push(mesclado);
  }

  if (remap.size === 0) return { clients, posts, videos, transactions, charges, campaigns, excluidos: [] };
  // Bumpa updatedAt junto: sem isso, o remapeamento só convence os outros
  // dispositivos na próxima vez que alguém mexer de verdade nesse
  // registro — com timestamp igual ao que o servidor já tem, a mesclagem
  // por "quem é mais novo" não teria motivo pra propagar a correção.
  return {
    clients: canonicos,
    posts: posts.map((p) => (p.clientId && remap.has(p.clientId) ? { ...p, clientId: remap.get(p.clientId), updatedAt: Date.now() } : p)),
    videos: videos.map((v) => (v.clientId && remap.has(v.clientId) ? { ...v, clientId: remap.get(v.clientId), updatedAt: Date.now() } : v)),
    transactions: transactions.map((t) => (t.clientId && remap.has(t.clientId) ? { ...t, clientId: remap.get(t.clientId), updatedAt: Date.now() } : t)),
    charges: charges.map((c) => (remap.has(c.clientId) ? { ...c, clientId: remap.get(c.clientId)!, updatedAt: Date.now() } : c)),
    campaigns: campaigns.map((c) => (c.clientId && remap.has(c.clientId) ? { ...c, clientId: remap.get(c.clientId), updatedAt: Date.now() } : c)),
    excluidos,
  };
}

function mergeRemoteIntoStore(
  set: (fn: (s: DataState) => Partial<DataState>) => void,
  get: () => DataState,
  remote: RemoteSyncData,
): void {
  const s = get();
  const tombstonesTodos = [...s.tombstones, ...remote.tombstones];
  const excluidos = new Set(tombstonesTodos.map((t) => t.id));

  const clientesMesclados = mesclarLista(s.clients, remote.clients, excluidos);
  const postsMesclados = mesclarLista(s.posts, remote.posts, excluidos);
  const videosMesclados = mesclarLista(s.videos, remote.videos, excluidos);
  const transactionsMescladas = mesclarLista(s.transactions, remote.transactions, excluidos);
  const chargesMescladas = mesclarLista(s.charges, remote.charges, excluidos);
  const libraryMesclada = mesclarLista(s.library, remote.library, excluidos);
  const campaignsMescladas = mesclarLista(s.campaigns, remote.campaigns, excluidos);

  const dedup = deduplicarClientesPorNome(clientesMesclados, postsMesclados, videosMesclados, transactionsMescladas, chargesMescladas, campaignsMescladas);
  const tombstonesFinais = new Map([...tombstonesTodos, ...dedup.excluidos].map((t) => [`${t.tipo}:${t.id}`, t]));

  const checklistExtrasMerged: Record<string, ChecklistItem[]> = { ...remote.checklistExtras, ...s.checklistExtras };
  for (const data of Object.keys(remote.checklistExtras)) {
    const locais = s.checklistExtras[data] ?? [];
    const remotos = remote.checklistExtras[data] ?? [];
    const idsLocais = new Set(locais.map((i) => i.id));
    checklistExtrasMerged[data] = [...locais, ...remotos.filter((i) => !idsLocais.has(i.id))];
  }

  set(() => ({
    clients: dedup.clients,
    posts: dedup.posts,
    videos: dedup.videos,
    transactions: dedup.transactions,
    charges: dedup.charges,
    library: libraryMesclada,
    campaigns: dedup.campaigns,
    checklistExtras: checklistExtrasMerged,
    tombstones: [...tombstonesFinais.values()].slice(0, 500),
  }));
}

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const useData = create<DataState>()(
  persist(
    (set, get) => {
      /**
       * Marca um registro como excluído — sem isso, sincronizar com o
       * Conector faria o registro "ressuscitar" quando outro dispositivo
       * ainda tem ele localmente e manda de volta.
       */
      function marcarExcluido(tipo: TipoRegistro, id: string) {
        set((s) => ({
          tombstones: [{ tipo, id, quando: Date.now() }, ...s.tombstones].slice(0, 500),
        }));
      }

      return {
      ...empty,
      seeded: false,

      loadDemo: () => set({ ...seedData(), seeded: true }),

      restoreClients: () => {
        const atuais = get().clients;
        // Aproximado, não exato: "Agente Omni Cotia" e "Omni Cotia" contam
        // como o mesmo cliente, para não duplicar quem só mudou de grafia.
        const faltando = seedData().clients.filter(
          (c) => !acharPorNome(c.name, atuais, (a) => a.name),
        );
        if (faltando.length) set((s) => ({ clients: [...s.clients, ...faltando] }));
        return faltando.length;
      },
      restoreBillingFields: () => {
        const seedClients = seedData().clients;
        let corrigidos = 0;
        set((s) => ({
          clients: s.clients.map((c) => {
            const base = acharPorNome(c.name, seedClients, (sc) => sc.name);
            if (!base) return c;
            const patch: Partial<Client> = {};
            if (!c.monthlyFee && base.monthlyFee) patch.monthlyFee = base.monthlyFee;
            if (!c.billingDay && base.billingDay) patch.billingDay = base.billingDay;
            if (!c.billingMethod && base.billingMethod) patch.billingMethod = base.billingMethod;
            if (!c.contact && base.contact) patch.contact = base.contact;
            if (Object.keys(patch).length === 0) return c;
            corrigidos++;
            return { ...c, ...patch };
          }),
        }));
        return corrigidos;
      },
      restoreBriefings: () => {
        const seedClients = seedData().clients;
        let atualizados = 0;
        set((s) => ({
          clients: s.clients.map((c) => {
            const base = acharPorNome(c.name, seedClients, (sc) => sc.name);
            if (!base || !base.briefing) return c;
            // Só troca se o briefing salvo ainda bate com uma das versões
            // "de fábrica" de rodadas anteriores — se a equipe já editou na
            // tela, ou já está com a pesquisa mais nova, não mexe.
            const antigos = OLD_BRIEFINGS[c.name];
            if (!antigos || c.briefing === undefined || !antigos.includes(c.briefing) || c.briefing === base.briefing) return c;
            atualizados++;
            return { ...c, briefing: base.briefing };
          }),
        }));
        return atualizados;
      },
      resetAll: () => set({ ...empty, seeded: true }),

      // ---------- Clientes ----------
      addClient: (c) => {
        const client: Client = { ...c, id: uid('cli'), createdAt: Date.now(), updatedAt: Date.now() };
        set((s) => ({ clients: [...s.clients, client] }));
        return client;
      },
      updateClient: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
        })),
      removeClient: (id) => {
        marcarExcluido('cliente', id);
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
      },

      // ---------- Quadros ----------
      addBoard: ({ name, description, clientId, area }) => {
        const mk = (title: string): Column => ({ id: uid('col'), title, cardIds: [] });
        const board: Board = {
          id: uid('board'),
          name,
          description,
          clientId,
          area,
          columns: [mk('A fazer'), mk('Em produção'), mk('Revisão'), mk('Prontos'), mk('Concluído')],
          cards: {},
          createdAt: Date.now(),
        };
        set((s) => ({ boards: [...s.boards, board] }));
        return board;
      },
      ensureClientBoard: (clientId, name) => {
        const existing = get().boards.find((b) => b.clientId === clientId);
        if (existing) return existing;
        return get().addBoard({ name, clientId });
      },
      removeBoard: (id) =>
        set((s) => ({ boards: s.boards.filter((b) => b.id !== id) })),
      renameBoard: (id, name) =>
        set((s) => ({
          boards: s.boards.map((b) => (b.id === id ? { ...b, name } : b)),
        })),
      addColumn: (boardId, title, automation) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? { ...b, columns: [...b.columns, { id: uid('col'), title, cardIds: [], automation }] }
              : b,
          ),
        })),
      renameColumn: (boardId, colId, title) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  columns: b.columns.map((c) => (c.id === colId ? { ...c, title } : c)),
                }
              : b,
          ),
        })),
      setColumnAutomation: (boardId, colId, automation) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? { ...b, columns: b.columns.map((c) => (c.id === colId ? { ...c, automation } : c)) }
              : b,
          ),
        })),
      removeColumn: (boardId, colId) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b;
            const col = b.columns.find((c) => c.id === colId);
            const cards = { ...b.cards };
            col?.cardIds.forEach((id) => delete cards[id]);
            return { ...b, cards, columns: b.columns.filter((c) => c.id !== colId) };
          }),
        })),
      addCard: (boardId, colId, card) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b;
            const id = uid('card');
            const full: Card = {
              id,
              title: card.title,
              description: card.description,
              labels: card.labels ?? [],
              priority: card.priority,
              dueDate: card.dueDate,
              clientId: card.clientId ?? b.clientId,
              assigneeId: card.assigneeId,
              checklist: card.checklist ?? [],
              createdAt: Date.now(),
              mediaUrl: card.mediaUrl,
              awaitingClientReply: card.awaitingClientReply,
            };
            return {
              ...b,
              cards: { ...b.cards, [id]: full },
              columns: b.columns.map((c) =>
                c.id === colId ? { ...c, cardIds: [...c.cardIds, id] } : c,
              ),
            };
          }),
        })),
      updateCard: (boardId, cardId, patch) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? { ...b, cards: { ...b.cards, [cardId]: { ...b.cards[cardId], ...patch } } }
              : b,
          ),
        })),
      removeCard: (boardId, colId, cardId) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b;
            const cards = { ...b.cards };
            delete cards[cardId];
            return {
              ...b,
              cards,
              columns: b.columns.map((c) =>
                c.id === colId
                  ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) }
                  : c,
              ),
            };
          }),
        })),
      moveCard: (boardId, cardId, toColId, toIndex) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b;
            const columns = b.columns.map((c) => ({
              ...c,
              cardIds: c.cardIds.filter((id) => id !== cardId),
            }));
            const target = columns.find((c) => c.id === toColId);
            if (target) {
              const idx = Math.max(0, Math.min(toIndex, target.cardIds.length));
              target.cardIds.splice(idx, 0, cardId);
            }
            return { ...b, columns };
          }),
        })),

      // ---------- Financeiro ----------
      addTx: (t) =>
        set((s) => ({
          transactions: [{ ...t, id: uid('tx'), createdAt: Date.now(), updatedAt: Date.now() }, ...s.transactions],
        })),
      updateTx: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
        })),
      removeTx: (id) => {
        marcarExcluido('transacao', id);
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },

      // ---------- Posts ----------
      addPost: (p) => {
        const post: Post = { ...p, id: uid('post'), createdAt: Date.now(), updatedAt: Date.now(), checklist: p.checklist ?? [], revisions: [] };
        set((s) => ({ posts: [post, ...s.posts] }));
        return post;
      },
      updatePost: (id, patch) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
        })),
      setPostStage: (id, stage) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, stage, updatedAt: Date.now() } : p)),
        })),
      movePost: (postId, toStage, toIndex) =>
        set((s) => {
          const moving = s.posts.find((p) => p.id === postId);
          if (!moving) return {};
          const without = s.posts.filter((p) => p.id !== postId);
          const updated = { ...moving, stage: toStage, updatedAt: Date.now() };
          const targetIds = without.filter((p) => p.stage === toStage).map((p) => p.id);
          const idx = Math.max(0, Math.min(toIndex, targetIds.length));
          let globalIndex: number;
          if (idx >= targetIds.length) {
            const lastId = targetIds[targetIds.length - 1];
            globalIndex = lastId ? without.findIndex((p) => p.id === lastId) + 1 : without.length;
          } else {
            globalIndex = without.findIndex((p) => p.id === targetIds[idx]);
          }
          const result = [...without];
          result.splice(globalIndex, 0, updated);
          return { posts: result };
        }),
      removePost: (id) => {
        marcarExcluido('post', id);
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
      },
      addRevision: (postId, text) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, revisions: [...(p.revisions ?? []), { id: uid('rev'), text, resolved: false, createdAt: Date.now() }] }
              : p,
          ),
        })),
      updateRevision: (postId, revId, patch) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, revisions: (p.revisions ?? []).map((r) => (r.id === revId ? { ...r, ...patch } : r)) }
              : p,
          ),
        })),
      removeRevision: (postId, revId) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, revisions: (p.revisions ?? []).filter((r) => r.id !== revId) } : p,
          ),
        })),

      // ---------- Vídeos ----------
      addVideo: ({ title, clientId, editor, dueDate, notes, mediaUrls }) => {
        const video: VideoProject = {
          id: uid('vid'), title, clientId, editor, dueDate, notes, mediaUrls,
          stage: 'briefing', links: [], checklist: [], revisions: [], createdAt: Date.now(), updatedAt: Date.now(),
        };
        set((s) => ({ videos: [video, ...s.videos] }));
        return video;
      },
      updateVideo: (id, patch) =>
        set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v)) })),
      removeVideo: (id) => {
        marcarExcluido('video', id);
        set((s) => ({ videos: s.videos.filter((v) => v.id !== id) }));
      },
      moveVideo: (id, stage) =>
        set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, stage, updatedAt: Date.now() } : v)) })),
      addVideoLink: (id, link) =>
        set((s) => ({
          videos: s.videos.map((v) =>
            v.id === id ? { ...v, links: [...v.links, { ...link, id: uid('lnk') }] } : v,
          ),
        })),
      removeVideoLink: (id, linkId) =>
        set((s) => ({
          videos: s.videos.map((v) =>
            v.id === id ? { ...v, links: v.links.filter((l) => l.id !== linkId) } : v,
          ),
        })),
      addVideoRevision: (id, text) =>
        set((s) => ({
          videos: s.videos.map((v) =>
            v.id === id
              ? { ...v, revisions: [...v.revisions, { id: uid('rev'), text, resolved: false, createdAt: Date.now() }] }
              : v,
          ),
        })),
      toggleVideoRevision: (id, revId) =>
        set((s) => ({
          videos: s.videos.map((v) =>
            v.id === id
              ? { ...v, revisions: v.revisions.map((r) => (r.id === revId ? { ...r, resolved: !r.resolved } : r)) }
              : v,
          ),
        })),

      // ---------- Biblioteca ----------
      addLibraryItem: (i) =>
        set((s) => ({ library: [{ ...i, id: uid('lib'), createdAt: Date.now(), updatedAt: Date.now() }, ...s.library] })),
      updateLibraryItem: (id, patch) =>
        set((s) => ({ library: s.library.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)) })),
      removeLibraryItem: (id) => {
        marcarExcluido('biblioteca', id);
        set((s) => ({ library: s.library.filter((l) => l.id !== id) }));
      },

      // ---------- Automações ----------
      addEvent: (e) =>
        set((s) => ({
          events: [{ ...e, id: uid('ev'), createdAt: Date.now() }, ...s.events].slice(0, 200),
        })),
      clearEvents: () => set({ events: [] }),

      // ---------- Tráfego pago ----------
      addCampaign: (c) =>
        set((s) => ({
          campaigns: [
            {
              ...c,
              id: uid('camp'),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              metrics: c.metrics ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 },
            },
            ...s.campaigns,
          ],
        })),
      updateCampaign: (id, patch) =>
        set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) })),
      removeCampaign: (id) => {
        marcarExcluido('campanha', id);
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }));
      },

      // ---------- Cobranças ----------
      upsertCharges: (list) =>
        set((s) => ({
          charges: [
            ...s.charges,
            ...list.filter((n) => !s.charges.some((c) => c.clientId === n.clientId && c.month === n.month))
              .map((n) => ({ ...n, updatedAt: Date.now() })),
          ],
        })),
      updateCharge: (id, patch) =>
        set((s) => ({ charges: s.charges.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) })),
      removeCharge: (id) => {
        marcarExcluido('cobranca', id);
        set((s) => ({ charges: s.charges.filter((c) => c.id !== id) }));
      },

      nextAngle: (clientId, tipo, poolSize) => {
        const atual = get().angleMemory[clientId] ?? { foto: [], video: [] };
        let fila = atual[tipo];
        // Fila vazia ou de um pool de tamanho diferente (código mudou a
        // lista de ângulos) — embaralha uma nova, evitando repetir o
        // último índice usado bem na virada.
        if (fila.length === 0 || fila.some((i) => i >= poolSize)) {
          const ultimo = fila[fila.length - 1];
          let nova = embaralhar([...Array(poolSize).keys()]);
          if (nova[0] === ultimo && nova.length > 1) [nova[0], nova[1]] = [nova[1], nova[0]];
          fila = nova;
        }
        const idx = fila[0];
        const resto = fila.slice(1);
        set((s) => ({
          angleMemory: { ...s.angleMemory, [clientId]: { ...atual, [tipo]: resto } },
        }));
        return idx;
      },

      addChecklistExtra: (date, text) =>
        set((s) => ({
          checklistExtras: {
            ...s.checklistExtras,
            [date]: [...(s.checklistExtras[date] ?? []), { id: uid('ckx'), text, done: false }],
          },
        })),
      toggleChecklistExtra: (date, id) =>
        set((s) => ({
          checklistExtras: {
            ...s.checklistExtras,
            [date]: (s.checklistExtras[date] ?? []).map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
          },
        })),
      removeChecklistExtra: (date, id) =>
        set((s) => ({
          checklistExtras: {
            ...s.checklistExtras,
            [date]: (s.checklistExtras[date] ?? []).filter((i) => i.id !== id),
          },
        })),

      applyRemoteState: (remote) => mergeRemoteIntoStore(set, get, remote),
      };
    },
    { name: 'origem.data' },
  ),
);
