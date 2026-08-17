import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { fireWebhook } from './automations';
import type { Card, Client, ColumnAutomation } from './types';

function log(title: string, status: 'ok' | 'simulado' | 'erro', detail?: string) {
  useData.getState().addEvent({ channel: 'whatsapp', title, status, detail });
}

function clientOf(card: Card): Client | undefined {
  if (!card.clientId) return undefined;
  return useData.getState().clients.find((c) => c.id === card.clientId);
}

/**
 * Envio Automático: manda o cartão pro grupo de WhatsApp do cliente certo —
 * ele lê o cliente vinculado ao cartão e acha o grupo sozinho, sem precisar
 * escolher nada na hora.
 */
async function runEnvio(card: Card): Promise<void> {
  const client = clientOf(card);
  if (!client) {
    log(`Não enviei "${card.title}"`, 'erro', 'O cartão não tem cliente vinculado — abra o cartão e escolha o cliente.');
    return;
  }
  if (!client.whatsappGroup) {
    log(`Não enviei "${card.title}"`, 'erro', `${client.name} não tem grupo de WhatsApp cadastrado (em Integrações → grupos por cliente).`);
    return;
  }

  const s = useSettings.getState();
  const mensagem =
    `*${card.title}*\n\n` +
    (card.description ? `${card.description}\n\n` : '') +
    (card.mediaUrl ? `Arte: ${card.mediaUrl}\n\n` : '') +
    `— equipe Origem`;

  const payload = { tipo: 'aprovacao', grupo: client.whatsappGroup, titulo: card.title, cliente: client.name, mensagem };

  if (s.whatsappWebhook) {
    const ok = await fireWebhook(s.whatsappWebhook, payload);
    log(`Enviado ao grupo: "${card.title}"`, ok ? 'ok' : 'erro', ok ? `Mandado para ${client.name}.` : 'Falha ao disparar o webhook do WhatsApp.');
  } else {
    log(`(Simulado) Enviaria ao grupo: "${card.title}"`, 'simulado', 'Configure o webhook do WhatsApp nas Integrações para enviar de verdade.');
  }
}

/**
 * Alteração Automática: manda o cartão pro grupo pedindo aprovação e marca
 * como "esperando resposta". A partir daí, cada mensagem que o grupo mandar
 * vira um item novo no checklist do cartão — é onde a lista de alterações
 * vai se formando sozinha, conforme o cliente for falando.
 */
async function runAlteracao(boardId: string, card: Card): Promise<void> {
  const client = clientOf(card);
  if (!client) {
    log(`Não enviei "${card.title}"`, 'erro', 'O cartão não tem cliente vinculado — abra o cartão e escolha o cliente.');
    return;
  }
  if (!client.whatsappGroup) {
    log(`Não enviei "${card.title}"`, 'erro', `${client.name} não tem grupo de WhatsApp cadastrado (em Integrações → grupos por cliente).`);
    return;
  }

  const s = useSettings.getState();
  const mensagem =
    `*${card.title}* está pronto para sua avaliação.\n\n` +
    (card.description ? `${card.description}\n\n` : '') +
    (card.mediaUrl ? `Confira aqui: ${card.mediaUrl}\n\n` : '') +
    `Pode aprovar ou já me diz o que precisa mudar — cada coisa que você mandar eu já registro certinho.`;

  const payload = { tipo: 'aprovacao', grupo: client.whatsappGroup, cardId: card.id, titulo: card.title, cliente: client.name, mensagem };
  useData.getState().updateCard(boardId, card.id, { awaitingClientReply: true });

  if (s.whatsappWebhook) {
    const ok = await fireWebhook(s.whatsappWebhook, payload);
    log(`Aguardando resposta: "${card.title}"`, ok ? 'ok' : 'erro', ok ? `Enviado a ${client.name}. Cada resposta vira um item no checklist do cartão.` : 'Falha ao disparar o webhook do WhatsApp.');
  } else {
    log(`(Simulado) Pediria aprovação de: "${card.title}"`, 'simulado', 'Configure o webhook do WhatsApp nas Integrações para enviar de verdade.');
  }
}

/**
 * Post Automático: publica feed + story no Instagram do cliente, com a
 * copy pronta. Exige que o cartão tenha o link da arte (mediaUrl) — sem
 * isso não tem o que publicar, então avisa em vez de tentar adivinhar.
 */
async function runPost(card: Card): Promise<void> {
  const client = clientOf(card);
  if (!card.mediaUrl) {
    log(`Não publiquei "${card.title}"`, 'erro', 'Falta o link da arte/vídeo no cartão — abra o cartão e cole o link público antes de arrastar para cá.');
    return;
  }

  const s = useSettings.getState();
  // A copy vem do próprio cartão: quem preenche a descrição já escreve a legenda.
  // Sem descrição, publica só com o título — melhor isso do que inventar texto
  // sobre um cliente sem ter briefing pra se basear.
  const legenda = card.description || card.title;

  for (const destino of ['feed', 'story'] as const) {
    const payload = { tipo: 'publicar', destino, cardId: card.id, cliente: client?.name || null, instagram: client?.instagram || null, legenda, mediaUrl: card.mediaUrl };
    if (s.publishWebhook) {
      const ok = await fireWebhook(s.publishWebhook, payload);
      log(`Publicado no ${destino}: "${card.title}"`, ok ? 'ok' : 'erro', ok ? undefined : 'Falha no webhook de publicação.');
    } else {
      log(`(Simulado) Publicaria no ${destino}: "${card.title}"`, 'simulado', 'Configure o webhook de publicação nas Integrações para postar de verdade.');
    }
  }
}

/** Roda a automação da coluna de destino — chamada ao soltar um cartão numa coluna marcada. */
export async function runColumnAutomation(boardId: string, cardId: string, automation: ColumnAutomation): Promise<void> {
  if (automation === 'nenhuma' || !automation) return;
  const board = useData.getState().boards.find((b) => b.id === boardId);
  const card = board?.cards[cardId];
  if (!card) return;

  if (automation === 'envio') await runEnvio(card);
  else if (automation === 'alteracao') await runAlteracao(boardId, card);
  else if (automation === 'post') await runPost(card);
}
