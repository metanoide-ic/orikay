import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { generateCopy } from './ai';
import type { EventChannel, EventStatus, Post } from './types';

function log(channel: EventChannel, title: string, status: EventStatus, detail?: string, postId?: string) {
  useData.getState().addEvent({ channel, title, status, detail, postId });
}

/** Dispara um webhook (fire-and-forget). Retorna se foi entregue de fato. */
export async function fireWebhook(url: string, payload: unknown): Promise<boolean> {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // entrega cross-origin sem exigir CORS do destino
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
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

  log('ia', `Gerando copy para "${post.title}"…`, 'ok', undefined, postId);
  const copy = await generateCopy(post, client);
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
    mediaUrl: post.mediaUrl || null,
  };

  if (s.sendOnApprovalStage && s.whatsappWebhook) {
    const ok = await fireWebhook(s.whatsappWebhook, payload);
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

  for (const destino of ['feed', 'story'] as const) {
    const payload = {
      tipo: 'publicar',
      destino,
      postId,
      plataforma: post.platform,
      cliente: client?.name || null,
      instagram: client?.instagram || null,
      legenda: caption,
      mediaUrl: post.mediaUrl || null,
    };
    if (s.publishWebhook) {
      const ok = await fireWebhook(s.publishWebhook, payload);
      log('instagram', `Publicado no ${destino}: "${post.title}"`, ok ? 'ok' : 'erro',
        ok ? `Enviado ao webhook de publicação (${destino}).` : 'Falha no webhook de publicação.', postId);
    } else {
      log('instagram', `(Simulado) Publicaria no ${destino}: "${post.title}"`, 'simulado',
        `Configure o webhook de publicação nas Integrações para postar de verdade.`, postId);
    }
  }

  store.updatePost(postId, { published: true, stage: 'publicado' });
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
