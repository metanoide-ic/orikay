/**
 * Conector Orikay
 *
 * Programa local que recebe os eventos da plataforma e executa as ações reais:
 * envia mensagens no WhatsApp (aprovação, cobrança, nota fiscal) e publica no
 * Instagram (feed e story). Substitui o Make.com: não precisa de mais nenhuma
 * assinatura nem de cenários montados à mão.
 *
 * Uso:  node conector.mjs      (depois abra http://localhost:8787)
 * Sem dependências: usa apenas o Node 18+.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const DIR = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(DIR, 'conector.config.json');
const DADOS_FILE = join(DIR, 'dados-compartilhados.json');

// No computador de casa, ninguém mais alcança "localhost" — sem exigência
// nenhuma, como sempre foi. Hospedado num servidor com endereço público,
// EXIGIR_TOKEN=1 tranca tudo atrás do token (o mesmo que já protege
// /entrada e /entrada-pagamento) — sem isso, a tela e as credenciais
// ficariam visíveis pra qualquer um que descobrisse o endereço.
const EXIGIR_TOKEN = process.env.EXIGIR_TOKEN === '1';

const CONFIG_PADRAO = {
  provedor: 'zapi', // 'zapi' | 'evolution'
  zapiInstancia: '',
  zapiToken: '',
  zapiClientToken: '',
  evolutionUrl: '',
  evolutionInstancia: '',
  evolutionApiKey: '',
  igUserId: '',
  igToken: '',
  adAccountId: '',
  adsToken: '',
  googleDevToken: '',
  googleClientId: '',
  googleClientSecret: '',
  googleRefreshToken: '',
  googleCustomerId: '',
  googleLoginCustomerId: '',
  tiktokToken: '',
  tiktokAdvertiserId: '',
  asaasToken: '',
  asaasAmbiente: 'producao', // 'producao' | 'sandbox'
  entradaToken: '',
  /** Liga o túnel sozinho ao abrir o conector. */
  tunelAutomatico: true,
  /** Data (ISO, segunda-feira) da última pergunta semanal da Terça da Sorte já enviada — pra nunca perguntar duas vezes na mesma semana. */
  tercaDaSorteUltimoEnvio: '',
  /**
   * IA da equipe (OpenAI ou compatível): a chave fica gravada AQUI, no
   * conector.config.json (fora do Git de propósito — chave em repositório
   * público é revogada e roubada), e cada navegador da equipe puxa sozinho
   * na sincronização. Cola uma vez, em qualquer dispositivo, e a IA passa a
   * funcionar pra todo mundo.
   */
  iaEndpoint: '',
  iaChave: '',
  iaModelo: '',
};

function lerConfig() {
  if (!existsSync(CONFIG_FILE)) return { ...CONFIG_PADRAO };
  try {
    return { ...CONFIG_PADRAO, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

function gravarConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let config = lerConfig();

// Segredo do endereço de entrada: sem ele, qualquer um que descobrisse o
// endereço público conseguiria aprovar posts.
if (!config.entradaToken) {
  config.entradaToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  gravarConfig(config);
}

/** Últimos eventos processados, mostrados na tela do conector. */
const historico = [];
function registrar(tipo, texto, ok = true) {
  historico.unshift({ quando: new Date().toISOString(), tipo, texto, ok });
  historico.length = Math.min(historico.length, 40);
  const marca = ok ? 'OK ' : 'ERRO';
  console.log(`[${marca}] ${tipo}: ${texto}`);
}

/**
 * Caixa de entrada crua do WhatsApp: toda mensagem de grupo que chega,
 * independente de virar decisão ou não, fica guardada aqui — é o que a IA
 * Helper da plataforma lê quando o admin pede pra ver o que os clientes
 * mandaram. Não apaga sozinha (diferente de `decisoes`, que é consumida
 * uma vez): fica só um limite de tamanho, as mais antigas saem.
 */
const mensagensRecebidas = [];
function guardarMensagem(grupo, texto) {
  if (!texto) return;
  mensagensRecebidas.unshift({ grupo, texto: String(texto).slice(0, 2000), quando: Date.now() });
  mensagensRecebidas.length = Math.min(mensagensRecebidas.length, 300);
}

/**
 * Estado compartilhado da equipe (clientes, posts, vídeos, financeiro,
 * biblioteca, campanhas, checklist) — o que faz "quando um sobe uma
 * imagem, aparece pra todo mundo" funcionar.
 * Cada dispositivo manda o que tem de mais novo pra cá em POST /dados, o
 * Conector mescla (ganha quem tem updatedAt mais recente, por registro) e
 * devolve o resultado — que já é a verdade combinada de todo mundo até
 * agora. Fica salvo em arquivo, sobrevive a reiniciar o Conector.
 */
const DADOS_VAZIOS = { clients: [], posts: [], videos: [], transactions: [], charges: [], library: [], campaigns: [], checklistExtras: {}, tombstones: [] };
function lerDadosCompartilhados() {
  if (!existsSync(DADOS_FILE)) return { ...DADOS_VAZIOS };
  try {
    return { ...DADOS_VAZIOS, ...JSON.parse(readFileSync(DADOS_FILE, 'utf8')) };
  } catch {
    return { ...DADOS_VAZIOS };
  }
}
let dadosCompartilhados = lerDadosCompartilhados();
let gravarDadosPendente = null;
function gravarDadosCompartilhados() {
  // Debounce simples: várias sincronizações em sequência não batem disco toda hora.
  if (gravarDadosPendente) clearTimeout(gravarDadosPendente);
  gravarDadosPendente = setTimeout(() => {
    try { writeFileSync(DADOS_FILE, JSON.stringify(dadosCompartilhados)); } catch (e) { registrar('sync', `falha ao gravar dados: ${e.message}`, false); }
  }, 500);
}

/** Mescla uma lista por id: ganha quem tem `updatedAt` mais recente. Sem updatedAt nos dois, o que já estava aqui prevalece. */
function mesclarLista(atuais, recebidos, excluidos) {
  const porId = new Map(atuais.map((x) => [x.id, x]));
  for (const r of recebidos) {
    const existente = porId.get(r.id);
    if (!existente || (r.updatedAt ?? 0) > (existente.updatedAt ?? 0)) porId.set(r.id, r);
  }
  return [...porId.values()].filter((x) => !excluidos.has(x.id));
}

function mesclarDados(recebido) {
  const tombstonesTodos = [...dadosCompartilhados.tombstones, ...(recebido.tombstones || [])];
  const vistos = new Set();
  const tombstonesUnicos = tombstonesTodos.filter((t) => {
    const chave = `${t.tipo}:${t.id}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).slice(0, 500);
  const excluidos = new Set(tombstonesUnicos.map((t) => t.id));

  const checklistExtras = { ...dadosCompartilhados.checklistExtras };
  for (const data of Object.keys(recebido.checklistExtras || {})) {
    const atuais = checklistExtras[data] ?? [];
    const recebidos = recebido.checklistExtras[data] ?? [];
    const idsAtuais = new Set(atuais.map((i) => i.id));
    checklistExtras[data] = [...atuais, ...recebidos.filter((i) => !idsAtuais.has(i.id))];
  }

  dadosCompartilhados = {
    clients: mesclarLista(dadosCompartilhados.clients, recebido.clients || [], excluidos),
    posts: mesclarLista(dadosCompartilhados.posts, recebido.posts || [], excluidos),
    videos: mesclarLista(dadosCompartilhados.videos, recebido.videos || [], excluidos),
    transactions: mesclarLista(dadosCompartilhados.transactions, recebido.transactions || [], excluidos),
    charges: mesclarLista(dadosCompartilhados.charges, recebido.charges || [], excluidos),
    library: mesclarLista(dadosCompartilhados.library, recebido.library || [], excluidos),
    campaigns: mesclarLista(dadosCompartilhados.campaigns, recebido.campaigns || [], excluidos),
    checklistExtras,
    tombstones: tombstonesUnicos,
  };
  gravarDadosCompartilhados();
  return dadosCompartilhados;
}

/* ------------------------------ WhatsApp ------------------------------ */

function whatsappConfigurado() {
  return config.provedor === 'zapi'
    ? Boolean(config.zapiInstancia && config.zapiToken)
    : Boolean(config.evolutionUrl && config.evolutionInstancia && config.evolutionApiKey);
}

async function enviarWhatsapp(numero, mensagem) {
  if (!numero) throw new Error('sem número/grupo de destino');
  if (!whatsappConfigurado()) throw new Error('WhatsApp não configurado no conector');

  if (config.provedor === 'zapi') {
    const url = `${API_ZAPI}/instances/${config.zapiInstancia}/token/${config.zapiToken}/send-text`;
    const headers = { 'Content-Type': 'application/json' };
    if (config.zapiClientToken) headers['Client-Token'] = config.zapiClientToken;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: numero, message: mensagem }),
    });
    const texto = await res.text();
    // A Z-API às vezes responde 200 mesmo sem entregar nada — por exemplo
    // quando a instância nunca foi conectada ao WhatsApp pelo QR Code.
    // Por isso olha o corpo da resposta também, não só o status HTTP.
    let corpo = {};
    try { corpo = JSON.parse(texto); } catch { /* resposta não era JSON */ }
    if (!res.ok || corpo.error || corpo.value === false || corpo.connected === false) {
      throw new Error(`Z-API não confirmou o envio: ${texto.slice(0, 200)}`);
    }
    return;
  }

  const base = config.evolutionUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/message/sendText/${config.evolutionInstancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.evolutionApiKey },
    body: JSON.stringify({ number: numero, text: mensagem }),
  });
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

/* --------------------- Pergunta semanal da Terça da Sorte --------------------- */

/**
 * A Rede de Postos Margarida tem a promoção "Terça da Sorte" toda semana —
 * antes de produzir a arte de segunda, alguém da equipe precisa perguntar
 * pro cliente os valores daquela semana. Isso vivia só na memória de quem
 * lembrasse; agora o Conector pergunta sozinho: toda segunda-feira, a
 * partir das 9h (horário de Brasília), manda a pergunta pro grupo do
 * WhatsApp desse cliente — uma vez só por semana, mesmo reiniciando o
 * Conector várias vezes no mesmo dia.
 */
const NOME_CLIENTE_TERCA_DA_SORTE = 'Rede de Postos Margarida';

function normalizarNomeSimples(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

/** Data/hora atual no fuso de Brasília, sem depender do fuso do servidor onde o Conector está hospedado. */
function agoraEmSaoPaulo() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const diaSemanaMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    diaSemana: diaSemanaMap[partes.weekday],
    hora: Number(partes.hour),
  };
}

async function verificarTercaDaSorte() {
  const { data, diaSemana, hora } = agoraEmSaoPaulo();
  if (diaSemana !== 1 || hora < 9) return; // só segunda-feira, a partir das 9h
  if (config.tercaDaSorteUltimoEnvio === data) return; // já perguntou essa semana
  if (!whatsappConfigurado()) return; // WhatsApp desligado, nem tenta

  const cliente = dadosCompartilhados.clients.find(
    (c) => normalizarNomeSimples(c.name) === normalizarNomeSimples(NOME_CLIENTE_TERCA_DA_SORTE),
  );
  if (!cliente || !cliente.whatsappGroup) {
    registrar('terca-da-sorte',
      `Cliente "${NOME_CLIENTE_TERCA_DA_SORTE}" não encontrado (ou sem grupo de WhatsApp cadastrado) — pergunta semanal não enviada.`, false);
    return;
  }

  const mensagem =
    'Bom dia! É segunda-feira, hora de fechar a arte da Terça da Sorte de amanhã.\n\n' +
    'Quais são os valores da promoção dessa semana?';
  try {
    await enviarWhatsapp(cliente.whatsappGroup, mensagem);
    config.tercaDaSorteUltimoEnvio = data;
    gravarConfig(config);
    registrar('terca-da-sorte', `Pergunta semanal da Terça da Sorte enviada para ${cliente.name}.`, true);
  } catch (e) {
    registrar('terca-da-sorte', `Falha ao enviar a pergunta semanal: ${e.message}`, false);
  }
}

// Checa a cada 5 minutos (e uma vez já na subida — cobre o Conector ligado
// depois das 9h de segunda) se está na hora de perguntar.
setInterval(() => { verificarTercaDaSorte().catch(() => {}); }, 5 * 60 * 1000);
verificarTercaDaSorte().catch(() => {});

/**
 * Lista os grupos de WhatsApp que a instância conectada enxerga — é o que
 * deixa a plataforma "adivinhar" sozinha qual grupo é de qual cliente, sem
 * precisar copiar e colar ID de grupo um por um.
 */
async function listarGrupos() {
  if (!whatsappConfigurado()) throw new Error('WhatsApp não configurado no conector');

  if (config.provedor === 'zapi') {
    const headers = {};
    if (config.zapiClientToken) headers['Client-Token'] = config.zapiClientToken;
    const grupos = [];
    // Percorre as páginas até a Z-API devolver menos que o pedido (acabou a lista).
    for (let pagina = 1; pagina <= 10; pagina++) {
      const url = `${API_ZAPI}/instances/${config.zapiInstancia}/token/${config.zapiToken}/chats?page=${pagina}&pageSize=100`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Z-API respondeu ${res.status} ao listar conversas`);
      const lista = await res.json();
      if (!Array.isArray(lista) || lista.length === 0) break;
      for (const c of lista) {
        if (c.isGroup) grupos.push({ id: c.phone, nome: c.name || c.phone });
      }
      if (lista.length < 100) break;
    }
    return grupos;
  }

  const base = config.evolutionUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/group/fetchAllGroups/${config.evolutionInstancia}?getParticipants=false`, {
    headers: { apikey: config.evolutionApiKey },
  });
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status} ao listar grupos`);
  const lista = await res.json();
  if (!Array.isArray(lista)) return [];
  return lista.map((g) => ({ id: g.id, nome: g.subject || g.id }));
}

/* ------------------------------ Instagram ----------------------------- */

async function publicarInstagram(destino, legenda, mediaUrl) {
  if (!config.igUserId || !config.igToken) throw new Error('Instagram não configurado no conector');
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    throw new Error('a imagem precisa estar numa URL pública (o Instagram não aceita arquivo colado)');
  }

  const criar = new URL(`https://graph.facebook.com/v21.0/${config.igUserId}/media`);
  criar.searchParams.set('access_token', config.igToken);
  criar.searchParams.set('image_url', mediaUrl);
  if (legenda) criar.searchParams.set('caption', legenda);
  if (destino === 'story') criar.searchParams.set('media_type', 'STORIES');

  const r1 = await fetch(criar, { method: 'POST' });
  const d1 = await r1.json();
  if (!r1.ok || !d1.id) throw new Error(`Graph API (criar): ${JSON.stringify(d1).slice(0, 200)}`);

  const publicar = new URL(`https://graph.facebook.com/v21.0/${config.igUserId}/media_publish`);
  publicar.searchParams.set('access_token', config.igToken);
  publicar.searchParams.set('creation_id', d1.id);

  const r2 = await fetch(publicar, { method: 'POST' });
  const d2 = await r2.json();
  if (!r2.ok) throw new Error(`Graph API (publicar): ${JSON.stringify(d2).slice(0, 200)}`);
}

/* ------------------------- Tráfego pago (Meta Ads) -------------------- */

// Endereços das APIs. Variáveis de ambiente só existem para poder testar
// o conector sem bater nas plataformas de verdade.
const API_META = process.env.API_META || 'https://graph.facebook.com/v21.0';
const API_GOOGLE = process.env.API_GOOGLE || 'https://googleads.googleapis.com/v18';
const API_GOOGLE_OAUTH = process.env.API_GOOGLE_OAUTH || 'https://oauth2.googleapis.com/token';
const API_TIKTOK = process.env.API_TIKTOK || 'https://business-api.tiktok.com/open_api/v1.3';
const API_ZAPI = process.env.API_ZAPI || 'https://api.z-api.io';

const zero = (id) => ({ id, spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 });

/** Uma campanha na Meta. */
async function metricasMeta(c) {
  const token = config.adsToken || config.igToken;
  if (!token) throw new Error('token de anúncios da Meta não configurado');

  // "Resultados" varia com o objetivo: pega a ação mais relevante disponível.
  const PRIORIDADE = ['purchase', 'lead', 'onsite_conversion.messaging_conversation_started_7d', 'link_click'];
  const contarAcoes = (lista) => {
    for (const tipo of PRIORIDADE) {
      const achou = (lista || []).find((a) => a.action_type === tipo);
      if (achou) return Number(achou.value) || 0;
    }
    return 0;
  };
  const somarValores = (lista) => {
    const achou = (lista || []).find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
    return achou ? Number(achou.value) || 0 : 0;
  };

  const campos = 'spend,impressions,reach,clicks,frequency,actions,action_values';

  // Totais do período inteiro.
  const geral = new URL(`${API_META}/${c.externalId}/insights`);
  geral.searchParams.set('access_token', token);
  geral.searchParams.set('fields', campos);
  geral.searchParams.set('date_preset', 'maximum');

  const res = await fetch(geral);
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta: ${JSON.stringify(json).slice(0, 180)}`);

  const linha = json.data?.[0];
  if (!linha) return zero(c.id);

  // Dia a dia dos últimos 30, para enxergar tendência e fadiga. Se falhar,
  // os totais já valem: histórico é melhoria, não requisito.
  let history = [];
  try {
    const diario = new URL(`${API_META}/${c.externalId}/insights`);
    diario.searchParams.set('access_token', token);
    diario.searchParams.set('fields', campos);
    diario.searchParams.set('date_preset', 'last_30d');
    diario.searchParams.set('time_increment', '1');
    const rd = await fetch(diario);
    const jd = await rd.json();
    if (rd.ok) {
      history = (jd.data || []).map((l) => ({
        date: l.date_start,
        spend: Number(l.spend) || 0,
        impressions: Number(l.impressions) || 0,
        clicks: Number(l.clicks) || 0,
        results: contarAcoes(l.actions),
        revenue: somarValores(l.action_values),
        frequency: Number(l.frequency) || 0,
      }));
    }
  } catch {
    history = [];
  }

  return {
    id: c.id,
    spend: Number(linha.spend) || 0,
    impressions: Number(linha.impressions) || 0,
    reach: Number(linha.reach) || 0,
    clicks: Number(linha.clicks) || 0,
    results: contarAcoes(linha.actions),
    revenue: somarValores(linha.action_values),
    frequency: Number(linha.frequency) || 0,
    history,
    geo: await geoMeta(c.externalId, token),
  };
}

/**
 * Lê a segmentação geográfica que está de fato no ar, juntando o que cada
 * conjunto da campanha tem. É o que permite flagrar a pizzaria de bairro
 * sendo entregue para o Brasil inteiro: o combinado pode estar certo no
 * papel e errado no gerenciador.
 */
async function geoMeta(campanhaId, token) {
  try {
    const url = new URL(`${API_META}/${campanhaId}/adsets`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('fields', 'targeting{geo_locations}');
    url.searchParams.set('limit', '50');

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) return { paises: [], estados: [], cidades: [], desconhecido: true };

    const paises = new Set();
    const estados = new Set();
    const cidades = new Map();

    for (const conjunto of json.data || []) {
      const g = conjunto.targeting?.geo_locations;
      if (!g) continue;
      for (const p of g.countries || []) paises.add(p);
      for (const r of g.regions || []) estados.add(r.name || r.key);
      for (const cid of g.cities || []) {
        const nome = cid.name || String(cid.key);
        // A Meta devolve o raio na unidade escolhida no gerenciador.
        const raio = cid.radius !== undefined
          ? (cid.distance_unit === 'mile' ? Math.round(Number(cid.radius) * 1.609) : Number(cid.radius))
          : undefined;
        // Entre conjuntos, o maior raio é o que manda no alcance real.
        const atual = cidades.get(nome);
        if (!atual || (raio !== undefined && (atual.raioKm ?? 0) < raio)) {
          cidades.set(nome, { nome, raioKm: raio });
        }
      }
    }

    const vazio = paises.size === 0 && estados.size === 0 && cidades.size === 0;
    return {
      paises: [...paises],
      estados: [...estados],
      cidades: [...cidades.values()],
      ...(vazio ? { desconhecido: true } : {}),
    };
  } catch {
    return { paises: [], estados: [], cidades: [], desconhecido: true };
  }
}

/** O Google devolve token de acesso curto a partir do refresh token. */
let googleToken = { valor: '', validoAte: 0 };
async function tokenGoogle() {
  if (googleToken.valor && Date.now() < googleToken.validoAte) return googleToken.valor;
  const { googleClientId, googleClientSecret, googleRefreshToken } = config;
  if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
    throw new Error('Google Ads não configurado (cliente, segredo e refresh token)');
  }
  const res = await fetch(API_GOOGLE_OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Google (login): ${JSON.stringify(json).slice(0, 180)}`);
  googleToken = { valor: json.access_token, validoAte: Date.now() + (Number(json.expires_in) || 3000) * 900 };
  return googleToken.valor;
}

/** Uma campanha no Google Ads. */
async function metricasGoogle(c) {
  const cliente = String(config.googleCustomerId || '').replace(/\D/g, '');
  if (!cliente) throw new Error('ID da conta do Google Ads não configurado');
  const token = await tokenGoogle();

  const consulta =
    'SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, ' +
    'metrics.conversions_value FROM campaign WHERE campaign.id = ' + String(c.externalId).replace(/\D/g, '');

  const res = await fetch(`${API_GOOGLE}/customers/${cliente}/googleAds:search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'developer-token': config.googleDevToken || '',
      ...(config.googleLoginCustomerId
        ? { 'login-customer-id': String(config.googleLoginCustomerId).replace(/\D/g, '') }
        : {}),
    },
    body: JSON.stringify({ query: consulta }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google: ${JSON.stringify(json).slice(0, 180)}`);

  const m = json.results?.[0]?.metrics;
  if (!m) return zero(c.id);
  return {
    id: c.id,
    spend: (Number(m.costMicros) || 0) / 1e6, // o Google devolve em micros
    impressions: Number(m.impressions) || 0,
    reach: 0, // o Google Ads não expõe alcance como a Meta
    clicks: Number(m.clicks) || 0,
    results: Math.round(Number(m.conversions) || 0),
    revenue: Number(m.conversionsValue) || 0,
  };
}

/** Uma campanha no TikTok Ads. */
async function metricasTiktok(c) {
  const { tiktokToken, tiktokAdvertiserId } = config;
  if (!tiktokToken || !tiktokAdvertiserId) throw new Error('TikTok Ads não configurado');

  const url = new URL(`${API_TIKTOK}/report/integrated/get/`);
  url.searchParams.set('advertiser_id', tiktokAdvertiserId);
  url.searchParams.set('report_type', 'BASIC');
  url.searchParams.set('data_level', 'AUCTION_CAMPAIGN');
  url.searchParams.set('dimensions', JSON.stringify(['campaign_id']));
  url.searchParams.set('metrics', JSON.stringify(['spend', 'impressions', 'reach', 'clicks', 'conversion', 'frequency', 'total_purchase_value']));
  url.searchParams.set('filters', JSON.stringify([
    { field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([String(c.externalId)]) },
  ]));
  url.searchParams.set('lifetime', 'true');

  const res = await fetch(url, { headers: { 'Access-Token': tiktokToken } });
  const json = await res.json();
  if (!res.ok || (json.code && json.code !== 0)) {
    throw new Error(`TikTok: ${(json.message || JSON.stringify(json)).slice(0, 180)}`);
  }

  const m = json.data?.list?.[0]?.metrics;
  if (!m) return zero(c.id);
  return {
    id: c.id,
    spend: Number(m.spend) || 0,
    impressions: Number(m.impressions) || 0,
    reach: Number(m.reach) || 0,
    clicks: Number(m.clicks) || 0,
    results: Number(m.conversion) || 0,
    revenue: Number(m.total_purchase_value) || 0,
    frequency: Number(m.frequency) || 0,
  };
}

/**
 * Busca os números de cada campanha na plataforma dela. Uma plataforma
 * desconfigurada não derruba as outras: vira aviso, e o resto sincroniza.
 */
async function buscarMetricas(campanhas) {
  const saida = [];
  const avisos = [];
  const jaAvisou = new Set();

  for (const c of campanhas) {
    if (!c.externalId) continue;
    const plataforma = c.plataforma || 'Meta';
    try {
      if (plataforma === 'Google') saida.push(await metricasGoogle(c));
      else if (plataforma === 'TikTok') saida.push(await metricasTiktok(c));
      else saida.push(await metricasMeta(c));
    } catch (e) {
      if (!jaAvisou.has(plataforma)) {
        jaAvisou.add(plataforma);
        avisos.push(`${plataforma}: ${e.message}`);
      }
    }
  }

  if (saida.length === 0 && avisos.length > 0) throw new Error(avisos.join(' | '));
  return { metricas: saida, avisos };
}

/* ----------------------- Cobrança (gateway Asaas) --------------------- */

const API_ASAAS = process.env.API_ASAAS || '';

function baseAsaas() {
  if (API_ASAAS) return API_ASAAS;
  return config.asaasAmbiente === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';
}

async function asaas(caminho, opcoes = {}) {
  if (!config.asaasToken) throw new Error('gateway de cobrança não configurado');
  const res = await fetch(baseAsaas() + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', access_token: config.asaasToken, ...(opcoes.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalhe = json.errors?.[0]?.description || JSON.stringify(json).slice(0, 160);
    throw new Error(`Asaas: ${detalhe}`);
  }
  return json;
}

/** Acha o cliente no gateway pelo documento, ou cria. */
async function clienteAsaas({ nome, documento, telefone }) {
  const doc = String(documento || '').replace(/\D/g, '');
  if (!doc) throw new Error('cliente sem CPF/CNPJ cadastrado');

  const busca = await asaas(`/customers?cpfCnpj=${doc}`);
  if (busca.data?.[0]?.id) return busca.data[0].id;

  const novo = await asaas('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: nome, cpfCnpj: doc, mobilePhone: telefone || undefined }),
  });
  return novo.id;
}

/**
 * Emite a cobrança no gateway e devolve o link da fatura e o Pix copia e cola.
 * O chargeId da plataforma vai como referência externa: é por ele que o aviso
 * de pagamento é ligado de volta à cobrança certa.
 */
async function emitirCobranca(evento) {
  const tipo = evento.metodo === 'boleto' ? 'BOLETO' : 'PIX';
  const customer = await clienteAsaas({
    nome: evento.cliente,
    documento: evento.documento,
    telefone: evento.numero,
  });

  const pagamento = await asaas('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer,
      billingType: tipo,
      value: evento.valor,
      dueDate: evento.vencimento,
      externalReference: evento.chargeId,
      description: `Servicos de marketing - ${evento.competencia}`,
    }),
  });

  let pix = null;
  if (tipo === 'PIX') {
    const qr = await asaas(`/payments/${pagamento.id}/pixQrCode`).catch(() => null);
    pix = qr?.payload || null;
  }

  return { gatewayId: pagamento.id, link: pagamento.invoiceUrl || pagamento.bankSlipUrl || null, pix };
}

/* --------------------- Respostas do grupo (entrada) ------------------- */

/**
 * Posts esperando resposta, por grupo. Ao enviar um post para aprovação a
 * plataforma avisa o conector, e é assim que ele sabe a qual post uma
 * mensagem do grupo se refere.
 */
const aguardando = new Map(); // grupo -> [{ postId, titulo, cliente, quando }]

/**
 * Fila do que já foi entendido e ainda não foi buscado pela plataforma:
 * respostas de post (tipo "post") e pagamentos confirmados (tipo "pagamento").
 */
let decisoes = [];

/**
 * Última cobrança enviada a cada número, pra poder responder sozinho
 * perguntas do tipo "qual o valor", "até quando" ou "qual o pix" sem
 * precisar perguntar nada pra plataforma. Fica só na memória (não é
 * segredo, e se o conector reiniciar a próxima cobrança repõe de novo).
 */
const cobrancasAtivas = new Map(); // dígitos do número -> { cliente, valor, vencimento, metodo, chavePix, link, quando }

function soDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const PEDE_ALTERACAO = /\b(alter|ajust|mud|troc|corrig|arrum|refaz|refac|reface|revis)/;
const NAO_GOSTOU = /\b(nao gostei|nao curti|nao ficou|nao era|nao e isso|reprov)/;
const APROVA = /\b(aprovad|aprovo|aprova|pode postar|pode subir|pode publicar|pode ir|liberad|libera|perfeito|ficou otimo|ficou top|ficou show|amei|gostei|ta otimo|ta bom|show de bola|isso mesmo)/;

/**
 * Classifica a mensagem do grupo. O pedido de alteração vem primeiro de
 * propósito: "gostei, mas muda a cor" é alteração, não aprovação.
 */
function interpretar(texto) {
  const t = normalizar(texto);
  if (!t.trim()) return null;
  if (PEDE_ALTERACAO.test(t) || NAO_GOSTOU.test(t)) return 'alteracao';
  if (APROVA.test(t)) return 'aprovado';
  return null; // conversa comum do grupo: não mexe em nada
}

/* --------------------- Atendimento automático (cobrança) --------------- */

const PERGUNTA_PIX = /\bpix\b/;
const PERGUNTA_VALOR = /\b(quanto|valor|preco)\b/;
const PERGUNTA_VENCIMENTO = /\b(quando|vencimento|vence|venci|prazo|ate quando)\b/;
const PERGUNTA_COBRANCA_GERAL = /\b(cobranca|boleto|fatura|pagamento|nota fiscal|debito)\b/;

/** Reconhece se a mensagem está perguntando algo sobre a cobrança. Sem IA — só palavra-chave, pra nunca inventar resposta sobre dinheiro. */
function perguntaSobreCobranca(texto) {
  const t = normalizar(texto);
  if (!t.trim()) return null;
  if (PERGUNTA_PIX.test(t)) return 'pix';
  if (PERGUNTA_VALOR.test(t)) return 'valor';
  if (PERGUNTA_VENCIMENTO.test(t)) return 'vencimento';
  if (PERGUNTA_COBRANCA_GERAL.test(t)) return 'geral';
  return null;
}

/** Monta a resposta a partir dos dados reais da última cobrança enviada a esse número — nunca inventa valor nem data. */
function responderCobranca(numero, pergunta) {
  const c = cobrancasAtivas.get(soDigitos(numero));
  if (!c) return null;
  const venc = new Date(c.vencimento + 'T00:00').toLocaleDateString('pt-BR');

  if (pergunta === 'pix') {
    return c.chavePix
      ? `Nossa chave Pix é: ${c.chavePix}`
      : `Essa cobrança está sendo feita por ${c.metodo === 'boleto' ? 'boleto' : 'nota fiscal'}, não por Pix. Qualquer dúvida é só chamar.`;
  }
  if (pergunta === 'valor') return `O valor da cobrança é ${formatarMoeda(c.valor)}.`;
  if (pergunta === 'vencimento') return `O vencimento é ${venc}.`;

  let msg = `Sobre a sua cobrança: valor ${formatarMoeda(c.valor)}, vencimento ${venc}.`;
  if (c.chavePix) msg += ` Chave Pix: ${c.chavePix}`;
  if (c.link) msg += ` Link: ${c.link}`;
  return msg;
}

/** Tira do payload do provedor o grupo, o texto e se a mensagem é nossa. */
function lerMensagem(corpo) {
  // Z-API
  if (corpo.phone || corpo.chatId) {
    return {
      grupo: corpo.chatId || corpo.phone,
      texto: corpo.text?.message ?? corpo.message ?? corpo.body ?? '',
      minha: Boolean(corpo.fromMe),
    };
  }
  // Evolution API
  const d = corpo.data ?? corpo;
  const chave = d.key ?? {};
  if (chave.remoteJid) {
    const m = d.message ?? {};
    return {
      grupo: chave.remoteJid,
      texto: m.conversation ?? m.extendedTextMessage?.text ?? '',
      minha: Boolean(chave.fromMe),
    };
  }
  return null;
}

async function receberMensagem(corpo) {
  const msg = lerMensagem(corpo);
  if (!msg || msg.minha) return null;
  guardarMensagem(msg.grupo, msg.texto);

  // Pergunta sobre cobrança (valor, vencimento, Pix): responde sozinho na
  // hora, sem precisar de fila nem de post esperando aprovação. Só entra
  // aqui se esse número tiver uma cobrança ativa de verdade — nunca inventa
  // valor pra quem nunca foi cobrado.
  const alvoCobranca = soDigitos(msg.grupo);
  if (cobrancasAtivas.has(alvoCobranca)) {
    const pergunta = perguntaSobreCobranca(msg.texto);
    if (pergunta) {
      const resposta = responderCobranca(msg.grupo, pergunta);
      if (resposta) {
        try {
          await enviarWhatsapp(msg.grupo, resposta);
          registrar('cobranca', `respondeu pergunta de cobrança (${pergunta}) automaticamente`);
        } catch (e) {
          registrar('cobranca', `falha ao responder pergunta de cobrança: ${e.message}`, false);
        }
        return null; // atendimento automático, não é decisão de post
      }
    }
  }

  const fila = aguardando.get(msg.grupo) || [];
  if (fila.length === 0) return null; // nada esperando resposta nesse grupo

  const alvo = fila[fila.length - 1]; // o mais recente enviado ao grupo

  // Cartão em Alteração Automática: não classifica aprova/reprova — cada
  // mensagem que o cliente manda vira um item novo no checklist do cartão,
  // e o cartão continua na fila (aceitando mais itens) até o cliente
  // aprovar de fato. É assim que a lista de alterações vai se formando.
  if (alvo.cardId) {
    const decisao = interpretar(msg.texto);
    if (decisao === 'aprovado') {
      fila.pop();
      if (fila.length === 0) aguardando.delete(msg.grupo);
      decisoes.push({ tipo: 'card', cardId: alvo.cardId, decisao: 'aprovado', texto: String(msg.texto).slice(0, 500), quando: Date.now() });
      registrar('resposta', `${alvo.titulo}: cliente aprovou`);
      return 'aprovado';
    }
    // Qualquer outra coisa que o cliente mandar (reprovou, ou foi só listando
    // o que quer mudar) vira item de alteração — mesmo sem bater com nenhuma
    // palavra-chave, porque nem sempre o cliente escreve "reprovado" antes.
    decisoes.push({ tipo: 'card', cardId: alvo.cardId, decisao: 'alteracao', texto: String(msg.texto).slice(0, 500), quando: Date.now() });
    registrar('resposta', `${alvo.titulo}: cliente pediu alteração`);
    return 'alteracao';
  }

  const decisao = interpretar(msg.texto);
  if (!decisao) return null;

  fila.pop();
  if (fila.length === 0) aguardando.delete(msg.grupo);

  decisoes.push({
    tipo: 'post',
    postId: alvo.postId,
    decisao,
    texto: String(msg.texto).slice(0, 500),
    quando: Date.now(),
  });
  registrar('resposta', `${alvo.titulo}: grupo respondeu "${decisao}"`);
  return decisao;
}

/** Eventos do gateway que significam dinheiro na conta. */
const PAGOU = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function receberPagamento(corpo) {
  if (!PAGOU.has(corpo.event)) return null;
  const p = corpo.payment || {};
  const chargeId = p.externalReference;
  if (!chargeId) return null;

  // Aplica direto no estado compartilhado da equipe (o mesmo da
  // sincronização): a cobrança vira "paga" e a receita entra no caixa aqui
  // mesmo, e o sync leva pra todo mundo em segundos. Antes isso ia pra fila
  // `decisoes`, consumida UMA única vez pelo primeiro navegador que
  // buscasse — com a equipe toda usando ao mesmo tempo virou corrida: o
  // navegador "errado" (sem a cobrança carregada) drenava a fila e o
  // pagamento se perdia pra sempre; reiniciar o Conector também apagava a
  // fila. Era por isso que cliente pagava e a plataforma não marcava.
  const cobranca = dadosCompartilhados.charges.find((c) => c.id === chargeId);
  if (cobranca) {
    if (cobranca.status === 'paga') {
      registrar('pagamento', `pagamento confirmado (${p.value ?? '?'}) para cobrança já paga (${chargeId}) — nada a fazer`);
      return 'pago';
    }
    const agora = Date.now();
    cobranca.status = 'paga';
    cobranca.paidAt = agora;
    cobranca.updatedAt = agora;
    const cliente = dadosCompartilhados.clients.find((c) => c.id === cobranca.clientId);
    const [ano, mes] = String(cobranca.month || '').split('-');
    const rotuloMes = MESES_PT[Number(mes) - 1] ? `${MESES_PT[Number(mes) - 1]} de ${ano}` : cobranca.month;
    dadosCompartilhados.transactions.unshift({
      id: 'tx_' + Math.random().toString(36).slice(2, 13),
      type: 'receita',
      description: `Fee mensal: ${cliente?.name ?? 'cliente'} (${rotuloMes})`,
      amount: Number(p.value) || cobranca.amount,
      category: 'Contrato',
      clientId: cobranca.clientId,
      date: new Date().toISOString().slice(0, 10),
      status: 'pago',
      createdAt: agora,
      updatedAt: agora,
    });
    gravarDadosCompartilhados();
    registrar('pagamento', `pagamento confirmado (${p.value ?? '?'}): cobrança de ${cliente?.name ?? chargeId} marcada como paga e receita lançada no caixa`);
    return 'pago';
  }

  // Cobrança ainda não sincronizada pra cá (equipe nunca abriu a plataforma
  // com o Conector configurado): cai no caminho antigo — fila que a
  // plataforma busca em /decisoes — pra não perder o aviso.
  decisoes.push({
    tipo: 'pagamento',
    chargeId,
    valor: Number(p.value) || 0,
    quando: Date.now(),
  });
  registrar('pagamento', `pagamento confirmado (${p.value ?? '?'}) para a cobrança ${chargeId} (aguardando a plataforma buscar)`);
  return 'pago';
}

/* ----------------- Túnel e registro automático de webhooks ------------ */

/**
 * O provedor de WhatsApp e o gateway precisam alcançar este computador, e
 * `localhost` não serve. O conector sobe um túnel do Cloudflare sozinho,
 * descobre o endereço público e registra os webhooks nos serviços.
 *
 * Assim ninguém precisa copiar endereço para painel nenhum, e quando o
 * túnel troca de endereço (o gratuito troca a cada reinício) o registro é
 * refeito automaticamente.
 */
/**
 * Endereço público fixo. Quem já tem um túnel próprio (Cloudflare pago,
 * ngrok com domínio, ou o conector num servidor) informa aqui e o conector
 * nem tenta subir o túnel gratuito, que troca de endereço a cada reinício.
 */
const TUNEL_FIXO = process.env.TUNEL_URL || '';

let tunel = TUNEL_FIXO
  ? { url: TUNEL_FIXO.replace(/\/$/, ''), estado: 'aberto', erro: '', processo: null }
  : { url: '', estado: 'parado', erro: '', processo: null };

function abrirTunel() {
  if (TUNEL_FIXO) {
    tunel = { url: TUNEL_FIXO.replace(/\/$/, ''), estado: 'aberto', erro: '', processo: null };
    void registrarWebhooks();
    return;
  }
  if (tunel.processo) return;
  tunel = { url: '', estado: 'abrindo', erro: '', processo: null };

  const proc = spawn('npx', ['-y', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  tunel.processo = proc;

  const procurarUrl = (texto) => {
    const achou = String(texto).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (achou && !tunel.url) {
      tunel.url = achou[0];
      tunel.estado = 'aberto';
      registrar('tunel', `endereço público: ${tunel.url}`);
      void registrarWebhooks();
    }
  };
  proc.stdout.on('data', procurarUrl);
  proc.stderr.on('data', procurarUrl);

  proc.on('error', (e) => {
    tunel = { url: '', estado: 'erro', erro: e.message, processo: null };
    registrar('tunel', `não foi possível abrir o túnel: ${e.message}`, false);
  });
  proc.on('exit', (code) => {
    const caiu = tunel.estado === 'aberto';
    tunel = { url: '', estado: code === 0 ? 'parado' : 'erro', erro: '', processo: null };
    if (caiu) {
      registrar('tunel', 'o túnel caiu, reabrindo', false);
      setTimeout(abrirTunel, 5000);
    }
  });
}

function fecharTunel() {
  if (TUNEL_FIXO) return;
  if (tunel.processo) tunel.processo.kill();
  tunel = { url: '', estado: 'parado', erro: '', processo: null };
}

/** Registra os endereços de entrada nos serviços que sabem receber webhook. */
async function registrarWebhooks() {
  if (!tunel.url) return { ok: false, erro: 'o túnel ainda não está aberto' };
  const entrada = `${tunel.url}/entrada?token=${config.entradaToken}`;
  const pagamento = `${tunel.url}/entrada-pagamento?token=${config.entradaToken}`;
  const feitos = [];
  const falhas = [];

  // WhatsApp
  try {
    if (config.provedor === 'zapi' && config.zapiInstancia && config.zapiToken) {
      const headers = { 'Content-Type': 'application/json' };
      if (config.zapiClientToken) headers['Client-Token'] = config.zapiClientToken;
      const r = await fetch(
        `${API_ZAPI}/instances/${config.zapiInstancia}/token/${config.zapiToken}/update-webhook-received`,
        { method: 'PUT', headers, body: JSON.stringify({ value: entrada }) },
      );
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      feitos.push('Z-API');
    } else if (config.provedor === 'evolution' && config.evolutionUrl && config.evolutionInstancia) {
      const base = config.evolutionUrl.replace(/\/$/, '');
      const r = await fetch(`${base}/webhook/set/${config.evolutionInstancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.evolutionApiKey },
        body: JSON.stringify({ webhook: { enabled: true, url: entrada, events: ['MESSAGES_UPSERT'] } }),
      });
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      feitos.push('Evolution');
    }
  } catch (e) {
    falhas.push(`WhatsApp: ${e.message}`);
  }

  // Gateway de cobrança
  if (config.asaasToken) {
    try {
      await asaas('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Orikay',
          url: pagamento,
          enabled: true,
          interrupted: false,
          sendType: 'SEQUENTIALLY',
          events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'],
        }),
      });
      feitos.push('Asaas');
    } catch (e) {
      // O Asaas recusa webhook repetido; isso não é falha de verdade.
      if (/already|existe|duplicad/i.test(e.message)) feitos.push('Asaas (já estava registrado)');
      else falhas.push(`Asaas: ${e.message}`);
    }
  }

  registrar(
    'webhooks',
    feitos.length ? `registrados em ${feitos.join(', ')}` : 'nenhum serviço configurado para registrar',
    falhas.length === 0,
  );
  for (const f of falhas) registrar('webhooks', f, false);
  return { ok: falhas.length === 0, feitos, falhas };
}

/* ------------------------- Roteamento dos eventos --------------------- */

async function processar(evento) {
  const { tipo } = evento;

  if (tipo === 'aprovacao') {
    await enviarWhatsapp(evento.grupo, evento.mensagem);
    if (evento.postId || evento.cardId) {
      const fila = aguardando.get(evento.grupo) || [];
      fila.push({ postId: evento.postId, cardId: evento.cardId, titulo: evento.titulo, cliente: evento.cliente, quando: Date.now() });
      aguardando.set(evento.grupo, fila);
    }
    registrar('aprovacao', `"${evento.titulo}" enviado ao grupo de ${evento.cliente || 'cliente'}`);
    return;
  }

  if (tipo === 'cobranca') {
    // Com o gateway ligado, a cobrança é emitida de verdade e o link entra na
    // mensagem. Sem ele, segue a mensagem simples (Pix na mão).
    let emissao = null;
    if (config.asaasToken && evento.metodo !== 'nf') {
      try {
        emissao = await emitirCobranca(evento);
      } catch (e) {
        registrar('cobranca', `não emitiu no gateway (${e.message}), enviando mensagem simples`, false);
      }
    }

    let mensagem = evento.mensagem;
    if (emissao?.link) mensagem += `\n\nPague por aqui: ${emissao.link}`;
    if (emissao?.pix) mensagem += `\n\nPix copia e cola:\n${emissao.pix}`;

    // Guarda os dados desta cobrança pra poder responder sozinho se o
    // cliente perguntar o valor, o vencimento ou o Pix depois — grava antes
    // de mandar, porque o atendimento automático tem que valer mesmo que o
    // envio inicial falhe e a cobrança seja reenviada de outro jeito.
    cobrancasAtivas.set(soDigitos(evento.numero), {
      cliente: evento.cliente,
      valor: evento.valor,
      vencimento: evento.vencimento,
      metodo: evento.metodo,
      chavePix: emissao?.pix || evento.chavePix || null,
      link: emissao?.link || null,
      quando: Date.now(),
    });

    await enviarWhatsapp(evento.numero, mensagem);
    registrar('cobranca', `cobrança de ${evento.cliente} enviada (${evento.metodo})`);

    return emissao ? { gatewayId: emissao.gatewayId, gatewayUrl: emissao.link } : undefined;
  }

  if (tipo === 'mensagem') {
    await enviarWhatsapp(evento.numero, evento.mensagem);
    registrar('mensagem', `aviso enviado para ${evento.cliente || evento.numero}`);
    return;
  }

  if (tipo === 'nota_fiscal') {
    await enviarWhatsapp(evento.numero, evento.mensagem);
    registrar('nota_fiscal', `pedido de NF de ${evento.cliente} enviado ao contador`);
    return;
  }

  if (tipo === 'metricas') {
    const { metricas, avisos } = await buscarMetricas(evento.campanhas || []);
    registrar('metricas', `${metricas.length} campanha(s) consultada(s)` + (avisos.length ? ` (${avisos.join('; ')})` : ''), avisos.length === 0);
    return { metricas, avisos };
  }

  if (tipo === 'publicar') {
    await publicarInstagram(evento.destino, evento.legenda, evento.mediaUrl);
    registrar('publicar', `publicado no ${evento.destino} (${evento.cliente || 'cliente'})`);
    return;
  }

  throw new Error(`tipo de evento desconhecido: ${tipo}`);
}

/* ------------------------------- Servidor ----------------------------- */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// O estado compartilhado da equipe (posts, vídeos etc.) carrega as imagens
// junto, em base64 — por isso o limite aqui precisa ser generoso: 5MB
// travava a sincronização de todo mundo assim que a equipe acumulava
// algumas fotos, sem erro nenhum na tela (parecia bug de permissão, não
// era). Com a compressão de imagem no navegador antes de guardar, isso
// deve raramente chegar perto do limite — mas ele existe pra não deixar
// a memória do processo crescer sem controle com uma requisição absurda.
function corpo(req) {
  return new Promise((resolve) => {
    let dados = '';
    let estourou = false;
    req.on('data', (p) => {
      if (estourou) return;
      dados += p;
      if (dados.length > 40e6) { estourou = true; req.destroy(); }
    });
    req.on('end', () => {
      if (estourou) { resolve({}); return; } // mesmo padrão de "corpo malformado" abaixo — nunca null
      try { resolve(JSON.parse(dados || '{}')); } catch { resolve({}); }
    });
  });
}

const servidor = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // /entrada e /entrada-pagamento têm o próprio token (endereço fixo dado
  // aos serviços externos) e continuam liberados aqui — sem eles a Z-API e
  // o Asaas nunca conseguiriam entregar nada.
  const rotaComTokenProprio = url.pathname === '/entrada' || url.pathname === '/entrada-pagamento';
  if (EXIGIR_TOKEN && !rotaComTokenProprio && url.searchParams.get('token') !== config.entradaToken) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, erro: 'token inválido ou ausente — confira o endereço colado na Orikay' }));
  }

  // Recebe os eventos da plataforma.
  if (url.pathname === '/webhook' && req.method === 'POST') {
    const evento = await corpo(req);
    try {
      const extra = await processar(evento);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ...(extra || {}) }));
    } catch (e) {
      registrar(evento.tipo || 'evento', e.message, false);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  }

  // Recebe as mensagens do grupo, vindas do provedor de WhatsApp.
  if (url.pathname === '/entrada' && req.method === 'POST') {
    if (url.searchParams.get('token') !== config.entradaToken) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, erro: 'token inválido' }));
    }
    let decisao = null;
    try {
      decisao = await receberMensagem(await corpo(req));
    } catch (e) {
      registrar('resposta', e.message, false);
    }
    // Sempre 200: provedor que recebe erro fica reenviando a mesma mensagem.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, decisao }));
  }

  // Recebe os avisos de pagamento, vindos do gateway.
  if (url.pathname === '/entrada-pagamento' && req.method === 'POST') {
    if (url.searchParams.get('token') !== config.entradaToken) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, erro: 'token inválido' }));
    }
    let resultado = null;
    try {
      resultado = receberPagamento(await corpo(req));
    } catch (e) {
      registrar('pagamento', e.message, false);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, resultado }));
  }

  // Sincronização de clientes/posts/vídeos/financeiro/biblioteca/campanhas/
  // checklist entre a equipe. GET só lê o que já está aqui (primeira
  // carga); POST manda o que o dispositivo tem, o Conector mescla com o
  // que já tinha de todo mundo e devolve a verdade combinada — é isso que
  // faz um cartão criado, uma imagem anexada ou um lançamento financeiro
  // em um dispositivo aparecer nos outros.
  if (url.pathname === '/dados' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, dados: dadosCompartilhados }));
  }

  // Configuração de IA compartilhada da equipe: a chave mora aqui (no
  // conector.config.json, que não vai pro Git) e cada navegador se acerta
  // sozinho na sincronização — colou a chave uma vez em qualquer
  // dispositivo, todo mundo passa a usar a IA.
  if (url.pathname === '/config-ia' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      ia: { endpoint: config.iaEndpoint || '', chave: config.iaChave || '', modelo: config.iaModelo || '' },
    }));
  }
  if (url.pathname === '/config-ia' && req.method === 'POST') {
    const b = await corpo(req);
    if (typeof b.chave === 'string') config.iaChave = b.chave.trim();
    if (typeof b.endpoint === 'string') config.iaEndpoint = b.endpoint.trim();
    if (typeof b.modelo === 'string') config.iaModelo = b.modelo.trim();
    gravarConfig(config);
    registrar('config', 'configuração de IA da equipe atualizada');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === '/dados' && req.method === 'POST') {
    try {
      const recebido = await corpo(req);
      const mesclado = mesclarDados(recebido);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, dados: mesclado }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  }

  // A IA Helper (só admin) lê aqui as mensagens cruas recebidas no WhatsApp
  // — diferente de /decisoes, não consome: pode reler quantas vezes quiser.
  // ?desde=<timestamp ms> filtra só o que chegou depois; ?grupo= filtra por
  // grupo/número específico; ?limite= corta o tamanho da resposta.
  if (url.pathname === '/mensagens') {
    const desde = Number(url.searchParams.get('desde') || 0);
    const grupo = url.searchParams.get('grupo');
    const limite = Math.min(Number(url.searchParams.get('limite') || 100), 300);
    let lista = mensagensRecebidas;
    if (desde) lista = lista.filter((m) => m.quando > desde);
    if (grupo) lista = lista.filter((m) => m.grupo === grupo || soDigitos(m.grupo) === soDigitos(grupo));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mensagens: lista.slice(0, limite) }));
  }

  // A plataforma busca aqui as respostas já entendidas.
  if (url.pathname === '/decisoes') {
    const pendentes = decisoes;
    decisoes = [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, decisoes: pendentes }));
  }

  // Liga, desliga e registra o túnel pela tela.
  if (url.pathname === '/tunel' && req.method === 'POST') {
    const { acao } = await corpo(req);
    if (acao === 'parar') fecharTunel();
    else if (acao === 'registrar') {
      const r = await registrarWebhooks();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(r));
    } else abrirTunel();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, tunel: { url: tunel.url, estado: tunel.estado } }));
  }

  // Salva a configuração pela tela.
  if (url.pathname === '/config' && req.method === 'POST') {
    config = { ...config, ...(await corpo(req)) };
    gravarConfig(config);
    registrar('config', 'configuração salva');
    // Credencial nova com túnel no ar: registra os webhooks de novo.
    if (tunel.url) void registrarWebhooks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // A plataforma pede aqui a lista de grupos pra casar sozinha com os clientes.
  if (url.pathname === '/grupos') {
    try {
      const grupos = await listarGrupos();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, grupos }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  }

  if (url.pathname === '/estado') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      config,
      historico,
      whatsapp: whatsappConfigurado(),
      instagram: Boolean(config.igUserId && config.igToken),
      ads: Boolean(config.adsToken || config.igToken),
      aguardando: [...aguardando.values()].reduce((n, f) => n + f.length, 0),
      google: Boolean(config.googleCustomerId && config.googleRefreshToken && config.googleDevToken),
      tiktok: Boolean(config.tiktokToken && config.tiktokAdvertiserId),
      gateway: Boolean(config.asaasToken),
      tunel: { url: tunel.url, estado: tunel.estado, erro: tunel.erro },
    }));
  }

  // Teste rápido de envio, direto da tela.
  if (url.pathname === '/testar' && req.method === 'POST') {
    const { numero } = await corpo(req);
    try {
      await enviarWhatsapp(numero, 'Teste do Conector Orikay. Se você recebeu isto, está tudo certo.');
      registrar('teste', `mensagem de teste enviada para ${numero}`);
      res.writeHead(200); return res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      registrar('teste', e.message, false);
      res.writeHead(200); return res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  }

  // Sem cache: se o navegador guardar esta página, correções feitas aqui
  // não aparecem numa aba já aberta mesmo depois de reiniciar o conector.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(PAGINA);
});

servidor.listen(PORT, () => {
  const sufixo = EXIGIR_TOKEN ? `?token=${config.entradaToken}` : '';
  console.log('');
  console.log('  Conector Orikay em execução.');
  if (EXIGIR_TOKEN) {
    console.log('  Modo hospedado: a tela e as rotas exigem o token de acesso.');
    console.log(`  Endereço da tela:  ${TUNEL_FIXO || `http://localhost:${PORT}`}/${sufixo}`);
    console.log(`  Endereço para colar na plataforma:  ${TUNEL_FIXO || `http://localhost:${PORT}`}/webhook${sufixo}`);
  } else {
    console.log(`  Abra no navegador:  http://localhost:${PORT}`);
    console.log(`  Endereço para colar na plataforma:  http://localhost:${PORT}/webhook`);
  }
  console.log('');
  console.log('  Deixe esta janela aberta enquanto usar a plataforma.');
  console.log('');
  if (config.tunelAutomatico) abrirTunel();
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => { fecharTunel(); process.exit(0); });
}

/* --------------------------- Tela de configuração --------------------- */

// Sobe a cada correção na tela de configuração, para dar pra confirmar
// por telefone se a pessoa está mesmo na versão nova (sem precisar de print).
const VERSAO_TELA = '4';

const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Conector Orikay</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0c;color:#e7e7ea;padding:32px 20px;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:26px;font-weight:600;letter-spacing:-.02em}
  .sub{color:#8a8a99;font-size:14px;margin-top:4px}
  .card{background:#121216;border:1px solid #24242c;border-radius:14px;padding:22px;margin-top:18px}
  h2{font-size:15px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .dot{width:8px;height:8px;border-radius:99px;background:#f59e0b}
  .dot.on{background:#34d399}
  label{display:block;font-size:12px;color:#9a9aa8;margin:12px 0 5px}
  input,select{width:100%;background:#17171c;border:1px solid #24242c;border-radius:9px;padding:10px 12px;color:#fff;font-size:14px;outline:none}
  input:focus,select:focus{border-color:#7c5cff}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  button{background:#7c5cff;color:#fff;border:0;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:500;cursor:pointer;margin-top:16px}
  button:hover{background:#9a7dff}
  button.sec{background:#17171c;border:1px solid #24242c}
  .end{background:#17171c;border:1px solid #24242c;border-radius:9px;padding:12px;font-family:ui-monospace,monospace;font-size:13px;color:#b6a2ff;word-break:break-all;margin-top:8px}
  .hint{font-size:12px;color:#8a8a99;margin-top:8px}
  .log{font-size:13px;border-top:1px solid #24242c;padding:9px 0;display:flex;gap:10px}
  .log:first-of-type{border-top:0}
  .log .t{color:#6a6a78;font-size:11px;min-width:52px}
  .log.err .m{color:#f87171}
  a{color:#b6a2ff}
</style></head><body><div class="wrap">
  <h1>Conector Orikay</h1>
  <p class="sub">Liga a plataforma ao WhatsApp e ao Instagram. Deixe este programa aberto enquanto a equipe usar o Orikay.</p>

  <div class="card">
    <h2>Endereço para a plataforma</h2>
    <div class="end" id="url"></div>
    <p class="hint">Cole este endereço na plataforma, em <b>Integrações → Conector Orikay</b>,
      no campo "Endereço do conector". É o único campo necessário — ele cobre WhatsApp,
      publicação e cobrança de uma vez.</p>
  </div>

  <div class="card">
    <h2><span class="dot" id="dw"></span> WhatsApp</h2>
    <label>Provedor</label>
    <select id="provedor">
      <option value="zapi">Z-API</option>
      <option value="evolution">Evolution API</option>
    </select>
    <div id="zapi">
      <div class="row">
        <div><label>ID da instância</label><input id="zapiInstancia" autocomplete="off" autocorrect="off" spellcheck="false"></div>
        <div><label>Token</label><input id="zapiToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      </div>
      <label>Client-Token (segurança da conta)</label><input id="zapiClientToken" autocomplete="off" autocorrect="off" spellcheck="false">
      <p class="hint">Os três aparecem no painel da Z-API depois de conectar o número por QR Code.</p>
    </div>
    <div id="evolution" style="display:none">
      <label>URL do servidor</label><input id="evolutionUrl" placeholder="https://seu-servidor.com">
      <div class="row">
        <div><label>Instância</label><input id="evolutionInstancia" autocomplete="off" autocorrect="off" spellcheck="false"></div>
        <div><label>API Key</label><input id="evolutionApiKey" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      </div>
    </div>
    <label>Testar envio (número com DDI, ex.: 5524999999999)</label>
    <input id="numeroTeste" placeholder="5524999999999">
    <button class="sec" onclick="testar()">Enviar mensagem de teste</button>
  </div>

  <div class="card">
    <h2><span class="dot" id="di"></span> Instagram</h2>
    <div class="row">
      <div><label>ID da conta (IG User ID)</label><input id="igUserId" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div><label>Token de acesso</label><input id="igToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <p class="hint">Gerados no app da Meta, com a conta do Instagram como Profissional.
      A imagem do post precisa estar numa URL pública para o Instagram aceitar.</p>
  </div>

  <div class="card">
    <h2><span class="dot" id="da"></span> Tráfego pago (Meta Ads)</h2>
    <div class="row">
      <div><label>Conta de anúncios</label><input id="adAccountId" placeholder="act_123456789"></div>
      <div><label>Token de anúncios</label><input id="adsToken" placeholder="deixe vazio para usar o token do Instagram"></div>
    </div>
    <p class="hint">Usado para trazer investimento, cliques e resultados das campanhas
      para a aba Tráfego. O token precisa da permissão <b>ads_read</b>.</p>
  </div>

  <div class="card">
    <h2><span class="dot" id="dg"></span> Tráfego pago (Google Ads)</h2>
    <div class="row">
      <div><label>ID da conta</label><input id="googleCustomerId" placeholder="123-456-7890"></div>
      <div><label>Developer token</label><input id="googleDevToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <div class="row">
      <div><label>Client ID</label><input id="googleClientId" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div><label>Client secret</label><input id="googleClientSecret" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <div class="row">
      <div><label>Refresh token</label><input id="googleRefreshToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div><label>Conta gerenciadora (MCC), se houver</label><input id="googleLoginCustomerId" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <p class="hint">O developer token sai do Google Ads API Center; os outros três vêm de um
      projeto no Google Cloud com a API do Google Ads liberada. É mais trabalhoso que a Meta,
      mas é feito uma vez só.</p>
  </div>

  <div class="card">
    <h2><span class="dot" id="dt"></span> Tráfego pago (TikTok Ads)</h2>
    <div class="row">
      <div><label>ID do anunciante</label><input id="tiktokAdvertiserId" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div><label>Token de acesso</label><input id="tiktokToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <p class="hint">Gerados no TikTok for Business, em Ferramentas para desenvolvedores.</p>
  </div>

  <div class="card">
    <h2><span class="dot" id="de"></span> Endereço público (automático)</h2>
    <p class="hint" style="margin:0 0 10px">Para o WhatsApp avisar das respostas do grupo e o
      gateway avisar dos pagamentos, os dois precisam alcançar este computador. O conector abre
      um túnel sozinho e registra os endereços nos serviços. Você não precisa copiar nada.</p>
    <div class="end" id="tunelUrl">abrindo o túnel...</div>
    <p class="hint" id="tunelInfo"></p>
    <button class="sec" onclick="tunel('abrir')">Reabrir túnel</button>
    <button class="sec" onclick="tunel('registrar')">Registrar webhooks agora</button>
    <p class="hint">Se o túnel não abrir, dá para fazer à mão: rode
      <code>npx cloudflared tunnel --url http://localhost:8787</code> em outra janela e cole os
      endereços abaixo nos painéis dos serviços.</p>
    <div class="end" id="entrada"></div>
    <div class="end" id="entradaPagamento"></div>
  </div>

  <div class="card">
    <h2><span class="dot" id="dp"></span> Cobrança automática (Asaas)</h2>
    <div class="row">
      <div><label>Token da API</label><input id="asaasToken" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div><label>Ambiente</label><select id="asaasAmbiente"><option value="producao">Produção</option><option value="sandbox">Sandbox (teste)</option></select></div>
    </div>
    <p class="hint">Com isto ligado, a cobrança sai com link de pagamento e Pix copia e cola,
      e a baixa acontece sozinha quando o cliente paga. O cliente precisa ter CPF ou CNPJ
      cadastrado na plataforma.</p>
    <p class="hint">O endereço de aviso de pagamento é registrado sozinho no Asaas assim que
      o túnel abre.</p>
  </div>

  <button onclick="salvar()">Salvar configuração</button>

  <div class="card">
    <h2>Atividade</h2>
    <div id="hist"><p class="sub">Nada ainda. As ações da plataforma aparecem aqui.</p></div>
  </div>
  <p class="sub" style="text-align:center;margin-top:18px">versão da tela: ${VERSAO_TELA}</p>
</div>
<script>
  const campos = ['provedor','zapiInstancia','zapiToken','zapiClientToken','evolutionUrl','evolutionInstancia','evolutionApiKey','igUserId','igToken','adAccountId','adsToken','googleCustomerId','googleDevToken','googleClientId','googleClientSecret','googleRefreshToken','googleLoginCustomerId','tiktokAdvertiserId','tiktokToken','asaasToken','asaasAmbiente'];
  const u = (p) => p + location.search; // preserva o ?token= em todo pedido desta página
  document.getElementById('url').textContent = location.origin + '/webhook' + location.search;
  document.getElementById('provedor').onchange = trocar;
  function trocar(){
    const p = document.getElementById('provedor').value;
    document.getElementById('zapi').style.display = p === 'zapi' ? '' : 'none';
    document.getElementById('evolution').style.display = p === 'evolution' ? '' : 'none';
  }
  let preenchidoUmaVez = false;
  async function carregar(){
    const r = await (await fetch(u('/estado'))).json();
    // Os campos só são preenchidos na primeira carga da página. Depois
    // disso a atualização automática (a cada 4s) mexe só nos status e no
    // túnel — nunca mais no valor dos campos, senão qualquer coisa colada
    // e ainda não salva (às vezes o Ctrl+V já dispara o próximo tique)
    // é apagada antes da pessoa clicar em Salvar.
    if (!preenchidoUmaVez) {
      campos.forEach(c => { if (r.config[c] !== undefined) document.getElementById(c).value = r.config[c]; });
      preenchidoUmaVez = true;
    }
    trocar();
    document.getElementById('dw').className = 'dot' + (r.whatsapp ? ' on' : '');
    document.getElementById('di').className = 'dot' + (r.instagram ? ' on' : '');
    document.getElementById('da').className = 'dot' + (r.ads ? ' on' : '');
    document.getElementById('de').className = 'dot' + (r.aguardando ? ' on' : '');
    document.getElementById('dg').className = 'dot' + (r.google ? ' on' : '');
    document.getElementById('dt').className = 'dot' + (r.tiktok ? ' on' : '');
    document.getElementById('dp').className = 'dot' + (r.gateway ? ' on' : '');
    const base = r.tunel && r.tunel.url ? r.tunel.url : location.origin;
    document.getElementById('entrada').textContent = base + '/entrada?token=' + r.config.entradaToken;
    document.getElementById('entradaPagamento').textContent = base + '/entrada-pagamento?token=' + r.config.entradaToken;
    const t = r.tunel || {};
    const rotulo = { aberto: t.url, abrindo: 'abrindo o túnel...', parado: 'túnel desligado', erro: 'não foi possível abrir o túnel' };
    document.getElementById('tunelUrl').textContent = rotulo[t.estado] || 'túnel desligado';
    document.getElementById('tunelInfo').textContent = t.estado === 'aberto'
      ? 'Endereço no ar. Os webhooks já foram registrados nos serviços configurados.'
      : (t.erro || 'O endereço muda a cada reinício, e o conector registra o novo sozinho.');
    const h = document.getElementById('hist');
    if (r.historico.length) {
      h.innerHTML = r.historico.map(e =>
        '<div class="log' + (e.ok ? '' : ' err') + '"><span class="t">' +
        new Date(e.quando).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) +
        '</span><span class="m">' + e.texto + '</span></div>').join('');
    }
  }
  async function salvar(){
    const dados = {};
    campos.forEach(c => dados[c] = document.getElementById(c).value.trim());
    await fetch(u('/config'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(dados) });
    carregar();
  }
  async function tunel(acao){
    const r = await (await fetch(u('/tunel'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ acao }) })).json();
    if (acao === 'registrar') {
      alert(r.ok ? ('Registrado em: ' + (r.feitos || []).join(', ')) : ('Falhou: ' + (r.falhas || [r.erro]).join(' | ')));
    }
    carregar();
  }
  async function testar(){
    await salvar();
    const numero = document.getElementById('numeroTeste').value.trim();
    const r = await (await fetch(u('/testar'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ numero }) })).json();
    alert(r.ok ? 'Mensagem enviada. Confira o WhatsApp.' : 'Não foi enviada: ' + r.erro);
    carregar();
  }
  carregar();
  setInterval(carregar, 4000);
</script></body></html>`;
