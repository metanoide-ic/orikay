import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { nuvem, NUVEM } from './cliente';
import { useSessao, recarregarEquipe } from './sessao';
import { useData } from '../dataStore';
import { useSettings, defaults as AJUSTES_PADRAO, type Settings } from '../settingsStore';
import { inferirDespesasFixas } from '../expenses';
import { useOnboardingTemplate } from '../onboardingTemplate';

/**
 * Sincronização com a nuvem, registro por registro.
 *
 * Não depende de cada ação da plataforma lembrar de "salvar na nuvem": o
 * motor observa os stores e compara a lista anterior com a nova. Objeto
 * novo (o zustand sempre cria um objeto novo quando algo muda) vira uma
 * gravação; id que sumiu vira exclusão. O que chega da nuvem em tempo real
 * entra no store sem voltar para a fila.
 *
 * Fila pendente fica salva no aparelho: editou sem internet, sobe quando a
 * conexão volta. O eco das próprias gravações é ignorado pela `origem`
 * (id desta aba), e registro com alteração local ainda não enviada não é
 * sobrescrito pelo que chega de fora: o local vence quando subir.
 */

/* ------------------------------------------------------------------ */
/*  O que sincroniza                                                   */
/* ------------------------------------------------------------------ */

const COLECOES = {
  clients: 'cliente',
  posts: 'post',
  videos: 'video',
  transactions: 'transacao',
  charges: 'cobranca',
  library: 'biblioteca',
  campaigns: 'campanha',
  boards: 'quadro',
  events: 'evento',
} as const;
type Colecao = keyof typeof COLECOES;
const COLECAO_DO_TIPO = Object.fromEntries(Object.entries(COLECOES).map(([c, t]) => [t, c])) as Record<string, Colecao>;

/** Ajustes que valem para a agência inteira (o resto é do aparelho). */
const AJUSTES_DA_AGENCIA = [
  'aiMode', 'aiEndpoint', 'aiKey', 'aiModel', 'brandVoice',
  'publishWebhook', 'autoPublishOnApproval', 'whatsappWebhook', 'whatsappGroup', 'sendOnApprovalStage',
  'connectorUrl', 'pixKey', 'contadorWhatsapp', 'autoBilling', 'lastAutoBillingRun',
  'postStageOrder', 'videoStageOrder', 'despesasFixas', 'geracaoIgnorada', 'despesasFixasIniciadas',
] as const satisfies ReadonlyArray<keyof Settings>;

type Item = { id: string };

interface Linha {
  agencia_id: string;
  tipo: string;
  id: string;
  dados: unknown;
  excluido: boolean;
  ordem: number;
  origem: string | null;
  atualizado_em: string;
}

interface Pendente { tipo: string; id: string; dados: unknown; excluido: boolean; ordem: number }

/* ------------------------------------------------------------------ */
/*  Estado visível (pílula de sincronização)                           */
/* ------------------------------------------------------------------ */

export const useNuvemStatus = create<{
  estado: 'parado' | 'carregando' | 'ok' | 'enviando' | 'offline' | 'erro';
  pendentes: number;
  ultimaVez: number | null;
  /** A primeira foto da agência já chegou: rotinas automáticas podem rodar. */
  carregado: boolean;
  /** Há dados de antes da nuvem neste aparelho, esperando decisão. */
  legado: { clientes: number; posts: number; videos: number } | null;
}>(() => ({ estado: 'parado', pendentes: 0, ultimaVez: null, carregado: false, legado: null }));

/* ------------------------------------------------------------------ */

const ABA = (crypto.randomUUID?.() ?? `aba-${Date.now()}-${Math.random()}`).slice(0, 36);
const CHAVE_MARCA = 'orikay.nuvem.agencia';
const chaveFila = (agencia: string) => `orikay.nuvem.fila.${agencia}`;

let agencia: string | null = null;
let aplicandoRemoto = 0;
let canal: RealtimeChannel | null = null;
let desligar: Array<() => void> = [];
let timerEnvio: ReturnType<typeof setTimeout> | null = null;
let enviando = false;
let tentativas = 0;
let ultimoVisto = '1970-01-01T00:00:00Z';

const pendentes = new Map<string, Pendente>();
const emVoo = new Set<string>();
const ordens = new Map<string, number>();

const chave = (tipo: string, id: string) => `${tipo}:${id}`;

function comoRemoto(fn: () => void) {
  aplicandoRemoto++;
  try { fn(); } finally { aplicandoRemoto--; }
}

function salvarFila() {
  if (!agencia) return;
  try { localStorage.setItem(chaveFila(agencia), JSON.stringify([...pendentes.values()])); } catch { /* cheio: segue em memória */ }
  useNuvemStatus.setState({ pendentes: pendentes.size });
}

function enfileirar(p: Pendente) {
  pendentes.set(chave(p.tipo, p.id), p);
  salvarFila();
  agendarEnvio(600);
}

function agendarEnvio(ms: number) {
  if (timerEnvio) clearTimeout(timerEnvio);
  timerEnvio = setTimeout(() => { timerEnvio = null; void enviar(); }, ms);
}

/* ------------------------------------------------------------------ */
/*  Ordem dos cartões                                                  */
/* ------------------------------------------------------------------ */

function ordemNaLista(tipo: string, lista: Item[], i: number): number {
  const atual = ordens.get(chave(tipo, lista[i].id));
  const antes = i > 0 ? ordens.get(chave(tipo, lista[i - 1].id)) : undefined;
  const depois = i < lista.length - 1 ? ordens.get(chave(tipo, lista[i + 1].id)) : undefined;
  // Já está entre os vizinhos: foi edição, não movimento. Mantém.
  if (atual !== undefined && (antes === undefined || antes < atual) && (depois === undefined || atual < depois)) return atual;
  let nova: number;
  if (antes !== undefined && depois !== undefined) nova = (antes + depois) / 2;
  else if (antes !== undefined) nova = antes + 1;
  else if (depois !== undefined) nova = depois - 1;
  else nova = i;
  ordens.set(chave(tipo, lista[i].id), nova);
  return nova;
}

function inserirPorOrdem<T extends Item>(tipo: string, lista: T[], item: T, ordem: number): T[] {
  const semEle = lista.filter((x) => x.id !== item.id);
  const pos = semEle.findIndex((x) => (ordens.get(chave(tipo, x.id)) ?? Number.MAX_SAFE_INTEGER) > ordem);
  if (pos === -1) return [...semEle, item];
  return [...semEle.slice(0, pos), item, ...semEle.slice(pos)];
}

/* ------------------------------------------------------------------ */
/*  Local → nuvem: observando os stores                                */
/* ------------------------------------------------------------------ */

function compararLista(tipo: string, nova: Item[], antiga: Item[]) {
  if (nova === antiga) return;
  const antes = new Map(antiga.map((x) => [x.id, x]));
  nova.forEach((item, i) => {
    if (antes.get(item.id) !== item) {
      enfileirar({ tipo, id: item.id, dados: item, excluido: false, ordem: ordemNaLista(tipo, nova, i) });
    }
    antes.delete(item.id);
  });
  for (const [id, item] of antes) {
    enfileirar({ tipo, id, dados: item, excluido: true, ordem: ordens.get(chave(tipo, id)) ?? 0 });
  }
}

type DadosState = ReturnType<typeof useData.getState>;

function observarDados(s: DadosState, antes: DadosState) {
  if (aplicandoRemoto || !agencia) return;
  for (const col of Object.keys(COLECOES) as Colecao[]) {
    compararLista(COLECOES[col], s[col] as Item[], antes[col] as Item[]);
  }
  if (s.checklistExtras !== antes.checklistExtras) {
    const datas = new Set([...Object.keys(s.checklistExtras), ...Object.keys(antes.checklistExtras)]);
    for (const d of datas) {
      if (s.checklistExtras[d] !== antes.checklistExtras[d]) {
        enfileirar({ tipo: 'checklist_extra', id: d, dados: s.checklistExtras[d] ?? [], excluido: !s.checklistExtras[d], ordem: 0 });
      }
    }
  }
  if (s.angleMemory !== antes.angleMemory) {
    enfileirar({ tipo: 'memoria', id: 'angulos', dados: s.angleMemory, excluido: false, ordem: 0 });
  }
}

function ajustesDaAgencia(s: Settings): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of AJUSTES_DA_AGENCIA) out[k] = s[k];
  // Conector achado em localhost vale só para esta máquina: não espalha.
  if (typeof out.connectorUrl === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(out.connectorUrl)) {
    delete out.connectorUrl;
  }
  return out as Partial<Settings>;
}

function observarAjustes(s: Settings, antes: Settings) {
  if (aplicandoRemoto || !agencia) return;
  const mudou = AJUSTES_DA_AGENCIA.some((k) => s[k] !== antes[k]);
  if (mudou) enfileirar({ tipo: 'config', id: 'agencia', dados: ajustesDaAgencia(s), excluido: false, ordem: 0 });
}

function observarModelo(s: { items: unknown[] }, antes: { items: unknown[] }) {
  if (aplicandoRemoto || !agencia || s.items === antes.items) return;
  enfileirar({ tipo: 'modelo', id: 'onboarding', dados: s.items, excluido: false, ordem: 0 });
}

/* ------------------------------------------------------------------ */
/*  Imagens embutidas (data URL) → armazenamento de arquivos           */
/* ------------------------------------------------------------------ */

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'application/pdf': 'pdf',
};

async function subirDataUrl(dataUrl: string, tipo: string, id: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const mime = blob.type || 'application/octet-stream';
  const nome = `${agencia}/${tipo}/${id}/${crypto.randomUUID?.() ?? Date.now()}.${EXT[mime] ?? 'bin'}`;
  const { error } = await nuvem.storage.from('midia').upload(nome, blob, { contentType: mime, upsert: false });
  if (error) throw error;
  return nuvem.storage.from('midia').getPublicUrl(nome).data.publicUrl;
}

async function trocarDataUrls(valor: unknown, tipo: string, id: string): Promise<{ valor: unknown; trocou: boolean }> {
  if (typeof valor === 'string') {
    if (valor.startsWith('data:') && valor.length > 512) return { valor: await subirDataUrl(valor, tipo, id), trocou: true };
    return { valor, trocou: false };
  }
  if (Array.isArray(valor)) {
    let trocou = false;
    const out = [];
    for (const v of valor) { const r = await trocarDataUrls(v, tipo, id); trocou ||= r.trocou; out.push(r.valor); }
    return { valor: trocou ? out : valor, trocou };
  }
  if (valor && typeof valor === 'object') {
    let trocou = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) { const r = await trocarDataUrls(v, tipo, id); trocou ||= r.trocou; out[k] = r.valor; }
    return { valor: trocou ? out : valor, trocou };
  }
  return { valor, trocou: false };
}

/* ------------------------------------------------------------------ */
/*  Envio                                                              */
/* ------------------------------------------------------------------ */

async function enviar(): Promise<void> {
  if (!agencia || enviando || pendentes.size === 0) return;
  if (!navigator.onLine) { useNuvemStatus.setState({ estado: 'offline' }); return; }
  enviando = true;
  useNuvemStatus.setState({ estado: 'enviando' });

  const lote = [...pendentes.values()].slice(0, 300);
  for (const p of lote) { pendentes.delete(chave(p.tipo, p.id)); emVoo.add(chave(p.tipo, p.id)); }
  const devolver = (lista: Pendente[]) => {
    for (const p of lista) if (!pendentes.has(chave(p.tipo, p.id))) pendentes.set(chave(p.tipo, p.id), p);
  };

  try {
    for (const p of lote) {
      if (p.excluido) continue;
      const r = await trocarDataUrls(p.dados, p.tipo, p.id);
      if (!r.trocou) continue;
      p.dados = r.valor;
      // O aparelho também passa a usar o link, e o localStorage para de carregar a imagem inteira.
      const col = COLECAO_DO_TIPO[p.tipo];
      if (col) {
        comoRemoto(() => useData.setState((s) => ({
          [col]: (s[col] as Item[]).map((x) => (x.id === p.id ? (r.valor as Item) : x)),
        }) as Partial<DadosState>));
      }
    }

    const linhas = lote.map((p) => ({
      agencia_id: agencia, tipo: p.tipo, id: p.id, dados: p.dados ?? null, excluido: p.excluido, ordem: p.ordem, origem: ABA,
    }));
    const { error } = await nuvem.from('registros').upsert(linhas, { onConflict: 'agencia_id,tipo,id' });
    if (error) {
      // Sem permissão (ex.: quem não tem Financeiro mexeu em algo financeiro
      // que tinha em cache): descarta só o que foi recusado e tenta o resto.
      if (error.code === '42501' && lote.length > 1) {
        const financeiros = lote.filter((p) => p.tipo === 'transacao' || p.tipo === 'cobranca');
        devolver(lote.filter((p) => !financeiros.includes(p)));
      } else if (error.code !== '42501') {
        throw error;
      }
    }
    tentativas = 0;
    useNuvemStatus.setState({ estado: 'ok', ultimaVez: Date.now() });
  } catch {
    devolver(lote);
    tentativas++;
    useNuvemStatus.setState({ estado: navigator.onLine ? 'erro' : 'offline' });
  } finally {
    for (const p of lote) emVoo.delete(chave(p.tipo, p.id));
    enviando = false;
    salvarFila();
    if (pendentes.size) agendarEnvio(tentativas ? Math.min(30_000, 1_000 * 2 ** tentativas) : 200);
  }
}

/* ------------------------------------------------------------------ */
/*  Nuvem → local                                                      */
/* ------------------------------------------------------------------ */

function aplicarLinha(l: Linha) {
  if (l.atualizado_em > ultimoVisto) ultimoVisto = l.atualizado_em;
  if (l.origem === ABA) return;
  const k = chave(l.tipo, l.id);
  if (pendentes.has(k) || emVoo.has(k)) return;

  comoRemoto(() => {
    const col = COLECAO_DO_TIPO[l.tipo];
    if (col) {
      ordens.set(k, l.ordem);
      useData.setState((s) => {
        const lista = s[col] as Item[];
        const nova = l.excluido
          ? lista.filter((x) => x.id !== l.id)
          : inserirPorOrdem(l.tipo, lista, l.dados as Item, l.ordem);
        return { [col]: nova } as Partial<DadosState>;
      });
      return;
    }
    if (l.tipo === 'checklist_extra') {
      useData.setState((s) => {
        const extras = { ...s.checklistExtras };
        if (l.excluido) delete extras[l.id];
        else extras[l.id] = l.dados as DadosState['checklistExtras'][string];
        return { checklistExtras: extras };
      });
    } else if (l.tipo === 'memoria' && l.id === 'angulos' && !l.excluido) {
      useData.setState({ angleMemory: l.dados as DadosState['angleMemory'] });
    } else if (l.tipo === 'config' && l.id === 'agencia' && !l.excluido) {
      useSettings.setState(l.dados as Partial<Settings>);
    } else if (l.tipo === 'modelo' && l.id === 'onboarding' && !l.excluido && Array.isArray(l.dados)) {
      useOnboardingTemplate.setState({ items: l.dados as ReturnType<typeof useOnboardingTemplate.getState>['items'] });
    }
  });
}

async function baixarTudo(desde?: string): Promise<Linha[]> {
  const todas: Linha[] = [];
  const PAGINA = 1000;
  for (let de = 0; ; de += PAGINA) {
    let q = nuvem.from('registros').select('*').eq('agencia_id', agencia!).order('tipo').order('id').range(de, de + PAGINA - 1);
    if (desde) q = q.gt('atualizado_em', desde);
    const { data, error } = await q;
    if (error) throw error;
    todas.push(...((data ?? []) as Linha[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

/** Substitui os dados do aparelho pelo que está na nuvem (a verdade da agência). */
function aplicarFotoCompleta(linhas: Linha[]) {
  const porCol: Partial<Record<Colecao, Array<{ item: Item; ordem: number }>>> = {};
  const extras: DadosState['checklistExtras'] = {};
  let memoria: DadosState['angleMemory'] | undefined;
  let config: Partial<Settings> | undefined;
  let modelo: unknown[] | undefined;
  ordens.clear();

  for (const l of linhas) {
    if (l.atualizado_em > ultimoVisto) ultimoVisto = l.atualizado_em;
    if (l.excluido) continue;
    const col = COLECAO_DO_TIPO[l.tipo];
    if (col) {
      ordens.set(chave(l.tipo, l.id), l.ordem);
      (porCol[col] ??= []).push({ item: l.dados as Item, ordem: l.ordem });
    } else if (l.tipo === 'checklist_extra') extras[l.id] = l.dados as DadosState['checklistExtras'][string];
    else if (l.tipo === 'memoria') memoria = l.dados as DadosState['angleMemory'];
    else if (l.tipo === 'config') config = l.dados as Partial<Settings>;
    else if (l.tipo === 'modelo' && Array.isArray(l.dados)) modelo = l.dados;
  }

  comoRemoto(() => {
    const patch: Record<string, unknown> = { checklistExtras: extras, seeded: true, tombstones: [] };
    for (const col of Object.keys(COLECOES) as Colecao[]) {
      const lista = (porCol[col] ?? []).sort((a, b) => a.ordem - b.ordem).map((x) => x.item);
      patch[col] = lista;
    }
    patch.angleMemory = memoria ?? {};
    useData.setState(patch as Partial<DadosState>);
    const padrao: Record<string, unknown> = {};
    for (const k of AJUSTES_DA_AGENCIA) padrao[k] = AJUSTES_PADRAO[k];
    // Agência sem ajustes salvos ainda: volta ao padrão, sem herdar nada de
    // outra agência que usou este aparelho antes.
    useSettings.setState({ ...(padrao as Partial<Settings>), ...(config ?? {}) });
    if (modelo) useOnboardingTemplate.setState({ items: modelo as ReturnType<typeof useOnboardingTemplate.getState>['items'] });
  });
}

/** Reaplica a fila pendente por cima (alterações feitas sem internet). */
function reaplicarPendentes() {
  for (const p of pendentes.values()) {
    aplicarLinha({ ...p, agencia_id: agencia!, origem: null, atualizado_em: ultimoVisto } as Linha);
  }
}

/** Depois de cair a conexão: busca só o que mudou desde a última vez. */
async function alcancar() {
  if (!agencia) return;
  try {
    const novas = await baixarTudo(ultimoVisto);
    novas.forEach(aplicarLinha);
    await recarregarEquipe();
    useNuvemStatus.setState({ estado: pendentes.size ? 'enviando' : 'ok', ultimaVez: Date.now() });
    void enviar();
  } catch {
    useNuvemStatus.setState({ estado: navigator.onLine ? 'erro' : 'offline' });
  }
}

/* ------------------------------------------------------------------ */
/*  Dados de antes da nuvem neste aparelho                             */
/* ------------------------------------------------------------------ */

function contarLegado() {
  const s = useData.getState();
  return { clientes: s.clients.length, posts: s.posts.length, videos: s.videos.length };
}

/** Sobe tudo que este aparelho tem para a agência (usado na migração). */
export async function importarDesteAparelho(): Promise<void> {
  if (!agencia) return;
  const s = useData.getState();
  for (const col of Object.keys(COLECOES) as Colecao[]) {
    const tipo = COLECOES[col];
    (s[col] as Item[]).forEach((item, i) => {
      ordens.set(chave(tipo, item.id), i);
      pendentes.set(chave(tipo, item.id), { tipo, id: item.id, dados: item, excluido: false, ordem: i });
    });
  }
  for (const [d, itens] of Object.entries(s.checklistExtras)) {
    pendentes.set(chave('checklist_extra', d), { tipo: 'checklist_extra', id: d, dados: itens, excluido: false, ordem: 0 });
  }
  pendentes.set(chave('memoria', 'angulos'), { tipo: 'memoria', id: 'angulos', dados: s.angleMemory, excluido: false, ordem: 0 });
  // Antes da nuvem, as despesas fixas eram uma lista no código. Agora são
  // da agência: parte do que já se repetia mês a mês no Financeiro.
  if (!useSettings.getState().despesasFixas?.length) {
    comoRemoto(() => useSettings.setState({ despesasFixas: inferirDespesasFixas() }));
  }
  pendentes.set(chave('config', 'agencia'), { tipo: 'config', id: 'agencia', dados: ajustesDaAgencia(useSettings.getState()), excluido: false, ordem: 0 });
  pendentes.set(chave('modelo', 'onboarding'), { tipo: 'modelo', id: 'onboarding', dados: useOnboardingTemplate.getState().items, excluido: false, ordem: 0 });
  salvarFila();
  try { localStorage.setItem(CHAVE_MARCA, agencia); } catch { /* ok */ }
  useNuvemStatus.setState({ legado: null });
  while (pendentes.size) {
    const antes = pendentes.size;
    await enviar();
    if (pendentes.size >= antes) break; // falhou: a fila segue salva e tenta depois
  }
  await ligarTempoReal();
}

/** Descarta o que este aparelho tinha e fica só com o que está na agência. */
export async function descartarDesteAparelho(): Promise<void> {
  if (!agencia) return;
  try { localStorage.setItem(CHAVE_MARCA, agencia); } catch { /* ok */ }
  useNuvemStatus.setState({ legado: null });
  await ligarTempoReal();
}

/* ------------------------------------------------------------------ */
/*  Liga / desliga                                                     */
/* ------------------------------------------------------------------ */

async function ligarTempoReal() {
  if (!agencia) return;
  const id = agencia;
  useNuvemStatus.setState({ estado: 'carregando' });

  // 1) Sobe o que ficou pendente de antes (alterações sem internet).
  await enviar();

  // 2) Foto completa da agência.
  try {
    const linhas = await baixarTudo();
    if (agencia !== id) return;
    aplicarFotoCompleta(linhas);
    reaplicarPendentes();
    useNuvemStatus.setState({ estado: 'ok', ultimaVez: Date.now(), carregado: true });
  } catch {
    useNuvemStatus.setState({ estado: navigator.onLine ? 'erro' : 'offline' });
  }

  // 3) Começa a observar o aparelho e a ouvir a agência.
  desligar.push(useData.subscribe(observarDados));
  desligar.push(useSettings.subscribe(observarAjustes));
  desligar.push(useOnboardingTemplate.subscribe(observarModelo));

  let primeira = true;
  canal = nuvem.channel(`agencia:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registros', filter: `agencia_id=eq.${id}` },
      (msg) => { if (msg.new && 'tipo' in msg.new) aplicarLinha(msg.new as Linha); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'membros', filter: `agencia_id=eq.${id}` },
      () => { void recarregarEquipe(); })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Reconectou depois de cair: pode ter perdido eventos no meio.
        if (!primeira) void alcancar();
        primeira = false;
      }
    });

  const online = () => { void alcancar(); };
  const visivel = () => { if (!document.hidden) void alcancar(); };
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', visivel);
  desligar.push(() => window.removeEventListener('online', online));
  desligar.push(() => document.removeEventListener('visibilitychange', visivel));
}

/** Esvazia o aparelho (ao sair da conta): dado de agência não fica para o próximo. */
function limparAparelho() {
  comoRemoto(() => {
    const vazio: Record<string, unknown> = { checklistExtras: {}, angleMemory: {}, tombstones: [] };
    for (const col of Object.keys(COLECOES)) vazio[col] = [];
    useData.setState(vazio as Partial<DadosState>);
    const padrao: Record<string, unknown> = {};
    for (const k of AJUSTES_DA_AGENCIA) padrao[k] = AJUSTES_PADRAO[k];
    useSettings.setState(padrao as Partial<Settings>);
  });
  try { localStorage.removeItem(CHAVE_MARCA); } catch { /* ok */ }
}

function parar() {
  desligar.forEach((f) => f());
  desligar = [];
  if (canal) { void nuvem.removeChannel(canal); canal = null; }
  if (timerEnvio) { clearTimeout(timerEnvio); timerEnvio = null; }
  pendentes.clear();
  ordens.clear();
  agencia = null;
  ultimoVisto = '1970-01-01T00:00:00Z';
  useNuvemStatus.setState({ estado: 'parado', pendentes: 0, legado: null, carregado: false });
}

async function iniciar(id: string) {
  parar();
  agencia = id;
  try {
    const fila = JSON.parse(localStorage.getItem(chaveFila(id)) ?? '[]') as Pendente[];
    for (const p of fila) pendentes.set(chave(p.tipo, p.id), p);
  } catch { /* fila corrompida: ignora */ }
  useNuvemStatus.setState({ pendentes: pendentes.size });

  let marca: string | null = null;
  try { marca = localStorage.getItem(CHAVE_MARCA); } catch { /* ok */ }

  if (marca === id) { await ligarTempoReal(); return; }

  const legado = contarLegado();
  const temLegado = !marca && (legado.clientes > 0 || legado.posts > 0 || legado.videos > 0);
  const souAdmin = useSessao.getState().membros.some((m) => m.user_id === useSessao.getState().user?.id && m.admin);
  if (temLegado && souAdmin) {
    // Aparelho que usava a plataforma antes da nuvem: pergunta o que fazer.
    useNuvemStatus.setState({ legado, estado: 'parado' });
    return;
  }
  // Aparelho de outra agência (ou sem nada a importar): começa limpo.
  try { localStorage.setItem(CHAVE_MARCA, id); } catch { /* ok */ }
  await ligarTempoReal();
}

let ligado = false;

/** Acompanha a sessão: entrou numa agência, sincroniza; saiu, para. */
export function ligarSincronizacao(): void {
  if (!NUVEM || ligado) return;
  ligado = true;
  let atual: string | null = null;
  const reagir = () => {
    const { fase, agenciaId } = useSessao.getState();
    const alvo = fase === 'pronta' ? agenciaId : null;
    if (alvo === atual) return;
    const saiu = atual !== null && alvo === null && fase === 'deslogado';
    atual = alvo;
    if (alvo) void iniciar(alvo);
    else {
      parar();
      if (saiu) limparAparelho();
    }
  };
  useSessao.subscribe(reagir);
  reagir();
}
