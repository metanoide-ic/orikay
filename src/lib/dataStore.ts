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
import { uid, acharPorNome } from './utils';
import { seedData } from './seed';

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
  addPost: (p: Omit<Post, 'id' | 'createdAt' | 'checklist' | 'revisions'> & { checklist?: Post['checklist'] }) => void;
  updatePost: (id: string, patch: Partial<Post>) => void;
  setPostStage: (id: string, stage: PostStage) => void;
  movePost: (postId: string, toStage: PostStage, toIndex: number) => void;
  removePost: (id: string) => void;
  addRevision: (postId: string, text: string) => void;
  updateRevision: (postId: string, revId: string, patch: Partial<{ text: string; resolved: boolean }>) => void;
  removeRevision: (postId: string, revId: string) => void;

  // Vídeos
  addVideo: (v: { title: string; clientId?: string; editor?: string; dueDate?: string; notes?: string }) => VideoProject;
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
}

const empty = {
  clients: [], boards: [], transactions: [], posts: [],
  videos: [], library: [], events: [], charges: [], campaigns: [],
  angleMemory: {} as Record<string, { foto: number[]; video: number[] }>,
  checklistExtras: {} as Record<string, ChecklistItem[]>,
};

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
    (set, get) => ({
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
      resetAll: () => set({ ...empty, seeded: true }),

      // ---------- Clientes ----------
      addClient: (c) => {
        const client: Client = { ...c, id: uid('cli'), createdAt: Date.now() };
        set((s) => ({ clients: [...s.clients, client] }));
        return client;
      },
      updateClient: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeClient: (id) =>
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

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
          transactions: [{ ...t, id: uid('tx'), createdAt: Date.now() }, ...s.transactions],
        })),
      updateTx: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTx: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      // ---------- Posts ----------
      addPost: (p) =>
        set((s) => ({
          posts: [
            { ...p, id: uid('post'), createdAt: Date.now(), checklist: p.checklist ?? [], revisions: [] },
            ...s.posts,
          ],
        })),
      updatePost: (id, patch) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      setPostStage: (id, stage) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, stage } : p)),
        })),
      movePost: (postId, toStage, toIndex) =>
        set((s) => {
          const moving = s.posts.find((p) => p.id === postId);
          if (!moving) return {};
          const without = s.posts.filter((p) => p.id !== postId);
          const updated = { ...moving, stage: toStage };
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
      removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
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
      addVideo: ({ title, clientId, editor, dueDate, notes }) => {
        const video: VideoProject = {
          id: uid('vid'), title, clientId, editor, dueDate, notes,
          stage: 'briefing', links: [], checklist: [], revisions: [], createdAt: Date.now(),
        };
        set((s) => ({ videos: [video, ...s.videos] }));
        return video;
      },
      updateVideo: (id, patch) =>
        set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      removeVideo: (id) => set((s) => ({ videos: s.videos.filter((v) => v.id !== id) })),
      moveVideo: (id, stage) =>
        set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, stage } : v)) })),
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
        set((s) => ({ library: [{ ...i, id: uid('lib'), createdAt: Date.now() }, ...s.library] })),
      updateLibraryItem: (id, patch) =>
        set((s) => ({ library: s.library.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeLibraryItem: (id) =>
        set((s) => ({ library: s.library.filter((l) => l.id !== id) })),

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
              metrics: c.metrics ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 },
            },
            ...s.campaigns,
          ],
        })),
      updateCampaign: (id, patch) =>
        set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCampaign: (id) =>
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),

      // ---------- Cobranças ----------
      upsertCharges: (list) =>
        set((s) => ({
          charges: [
            ...s.charges,
            ...list.filter((n) => !s.charges.some((c) => c.clientId === n.clientId && c.month === n.month)),
          ],
        })),
      updateCharge: (id, patch) =>
        set((s) => ({ charges: s.charges.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCharge: (id) =>
        set((s) => ({ charges: s.charges.filter((c) => c.id !== id) })),

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
    }),
    { name: 'origem.data' },
  ),
);
