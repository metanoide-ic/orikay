import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { generateCopy } from './ai';
import type { EventChannel, EventStatus, Post } from './types';
import { coverOf } from './utils';

function log(channel: EventChannel, title: string, status: EventStatus, detail?: string, postId?: string) {
  useData.getState().addEvent({ channel, title, status, detail, postId });
}

/**
 * Dispara um webhook e diz se deu certo de verdade.
 *
 * Primeiro tenta uma chamada normal, que deixa ler a resposta: o Conector
 * responde `{ ok: false, erro }` quando o WhatsApp ou o Instagram recusam, e
 * isso tem que aparecer como erro (antes, com `no-cors`, tudo virava "ok").
 * Só se o destino não aceitar CORS (Make, n8n...) cai no envio cego, e aí o
 * resultado é "entregue, sem confirmação".
 */
export async function fireWebhook(url: string, payload: unknown): Promise<boolean> {
  const corpo = JSON.stringify(payload);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data && typeof data === 'object' && 'ok' in data ? Boolean((data as { ok: unknown }).ok) : true;
  } catch {
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: corpo });
      return true;
    } catch {
      return false;
    }
  }
}

function clientOf(post: Post) {
  return useData.getState().clients.find((c) => c.id === post.clientId);
}

/**
 * Enviar para aprovação: gera a copy e manda no grupo do WhatsApp com a
 * mensagem "Segue aqui para aprovação". (Disparado ao entrar em "Aprovação".)
 */
export async function sendForApproval(postId: string): Promise<void> {
  const store = useData.getState();
  const s = useSettings.getState();
  const post = store.posts.find((p) => p.id === postId);
  if (!post) return;
  const client = clientOf(post);

  // Copy que a equipe já escreveu é a que vai pro cliente. Só gera quando
  // o post chega em Aprovação sem legenda nenhuma.
  let copy = post.copy?.trim() ?? '';
  if (!copy) {
    log('ia', `Gerando copy para "${post.title}"…`, 'ok', undefined, postId);
    copy = await generateCopy(post, client);
  }
  store.updatePost(postId, { copy, sentForApproval: true });

  const message =
    `*Segue aqui para aprovação*\n\n` +
    `*${post.title}* — ${post.platform}${client ? ` (${client.name})` : ''}\n\n` +
    `${copy}\n\n` +
    `Responda *APROVADO* para publicar, ou diga o que ajustar.`;

  const payload = {
    tipo: 'aprovacao',
    // O grupo do cliente manda; o grupo geral é só reserva para quem
    // ainda não cadastrou o grupo próprio.
    grupo: client?.whatsappGroup || s.whatsappGroup || null,
    postId,
    titulo: post.title,
    plataforma: post.platform,
    cliente: client?.name || null,
    instagram: client?.instagram || null,
    mensagem: message,
    copy,
    mediaUrl: coverOf(post) || null,
  };

  // O Conector entende o mesmo evento que o webhook antigo (Make/n8n) —
  // com o Conector conectado (bolinha verde), não precisa configurar mais
  // nada pra mandar de verdade.
  const canalWhatsapp = s.whatsappWebhook || s.connectorUrl;
  if (s.sendOnApprovalStage && canalWhatsapp) {
    const ok = await fireWebhook(canalWhatsapp, payload);
    log('whatsapp', `Enviado ao grupo: "${post.title}"`, ok ? 'ok' : 'erro',
      ok ? `Mensagem "Segue aqui para aprovação" + copy disparada via webhook.` : 'Falha ao disparar o webhook.', postId);
  } else {
    log('whatsapp', `(Simulado) Enviaria ao grupo: "${post.title}"`, 'simulado',
      `Configure o webhook do WhatsApp nas Integrações para enviar de verdade. Mensagem pronta:\n\n${message}`, postId);
  }
}

/**
 * Publicar automaticamente no feed e no story. (Disparado quando o grupo aprova.)
 */
export async function publishPost(postId: string): Promise<void> {
  const store = useData.getState();
  const s = useSettings.getState();
  const post = store.posts.find((p) => p.id === postId);
  if (!post) return;
  const client = clientOf(post);
  const caption = post.copy || post.caption || post.title;

  let algumOk = false;
  let tentou = false;
  for (const destino of ['feed', 'story'] as const) {
    const payload = {
      tipo: 'publicar',
      destino,
      postId,
      plataforma: post.platform,
      cliente: client?.name || null,
      instagram: client?.instagram || null,
      legenda: caption,
      mediaUrl: coverOf(post) || null,
    };
    // Mesmo caso do WhatsApp: o Conector também publica (tipo 'publicar').
    const canalPublicacao = s.publishWebhook || s.connectorUrl;
    if (canalPublicacao) {
      tentou = true;
      const ok = await fireWebhook(canalPublicacao, payload);
      algumOk ||= ok;
      log('instagram', `Publicado no ${destino}: "${post.title}"`, ok ? 'ok' : 'erro',
        ok ? `Enviado ao webhook de publicação (${destino}).` : 'Falha no webhook de publicação.', postId);
    } else {
      log('instagram', `(Simulado) Publicaria no ${destino}: "${post.title}"`, 'simulado',
        `Configure o webhook de publicação nas Integrações para postar de verdade.`, postId);
    }
  }

  // Só vira "publicado" se saiu de verdade (ou se é simulação, sem canal).
  if (algumOk || !tentou) store.updatePost(postId, { published: true, stage: 'publicado' });
  else log('instagram', `Não publicou "${post.title}"`, 'erro', 'O post continua em Aprovação. Confira o Conector e tente "Aprovado, publicar" de novo.', postId);
}

/**
 * O grupo aprovou → publica automaticamente.
 */
export async function onApproved(postId: string): Promise<void> {
  const s = useSettings.getState();
  log('whatsapp', 'Aprovação recebida do grupo', 'ok', undefined, postId);
  if (s.autoPublishOnApproval) {
    await publishPost(postId);
  } else {
    useData.getState().updatePost(postId, { stage: 'agendado' });
    log('sistema', 'Marcado como Agendado (publicação automática desativada).', 'ok', undefined, postId);
  }
}

/**
 * Postagem manual: o cliente não respondeu e a equipe publicou por conta
 * própria. Marca como publicado sem disparar os webhooks.
 */
export function markPublishedManual(postId: string): void {
  const store = useData.getState();
  store.updatePost(postId, { stage: 'publicado', published: true });
  log('sistema', 'Marcado como publicado (postagem manual)', 'ok',
    'A equipe publicou direto no perfil do cliente, sem passar pela automação.', postId);
}

/**
 * O grupo não gostou → vai para "Alteração" com o pedido registrado.
 */
export function onRejected(postId: string, changeText: string): void {
  const store = useData.getState();
  store.addRevision(postId, changeText);
  store.updatePost(postId, { stage: 'alteracao', sentForApproval: false });
  log('whatsapp', 'Alteração solicitada pelo grupo', 'ok', changeText, postId);
}

/**
 * Chamado sempre que um post muda de etapa (arrastar/soltar ou seleção).
 * Ao entrar em "Aprovação", dispara o envio para o grupo.
 */
export function onPostStageChange(postId: string, from: string, to: string): void {
  if (to === 'aprovacao' && from !== 'aprovacao') {
    void sendForApproval(postId);
  }
}
