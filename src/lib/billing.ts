import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { fireWebhook } from './automations';
import { uid, money, todayISO } from './utils';
import type { BillingMethod, Charge } from './types';

export const METHOD_LABEL: Record<BillingMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  nf: 'Nota fiscal',
};

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function isOverdue(ch: Charge): boolean {
  return ch.status !== 'paga' && ch.dueDate < todayISO();
}

/**
 * Gera as cobranças do mês corrente para todos os clientes com fee.
 * Idempotente: quem já tem cobrança no mês é pulado.
 */
export function generateMonthlyCharges(): number {
  const s = useData.getState();
  const month = currentMonthKey();
  const created: Charge[] = [];

  for (const c of s.clients) {
    if (!c.monthlyFee) continue;
    if (s.charges.some((ch) => ch.clientId === c.id && ch.month === month)) continue;
    const day = Math.min(Math.max(c.billingDay ?? 5, 1), 28);
    created.push({
      id: uid('chg'),
      clientId: c.id,
      month,
      amount: c.monthlyFee,
      method: c.billingMethod ?? 'pix',
      dueDate: `${month}-${String(day).padStart(2, '0')}`,
      status: 'pendente',
      createdAt: Date.now(),
    });
  }

  if (created.length) {
    s.upsertCharges(created);
    s.addEvent({
      channel: 'sistema',
      title: `Cobranças de ${monthLabel(month)} geradas`,
      status: 'ok',
      detail: `${created.length} cobrança(s) criada(s) a partir dos fees dos clientes.`,
    });
  }
  return created.length;
}

/** A segunda cobrança em diante é um lembrete educado, não repete a mensagem inteira. */
function reminderMessage(ch: Charge): string {
  const venc = new Date(ch.dueDate + 'T00:00').toLocaleDateString('pt-BR');
  return (
    `Olá! Aqui é a equipe da Origem, tudo bem?\n\n` +
    `Passando só para lembrar da cobrança de ${monthLabel(ch.month)} (venc. ${venc}), ` +
    `no valor de ${money(ch.amount)}. Consegue confirmar se o pagamento já foi feito?\n\n` +
    `Se já tiver pago, pode desconsiderar — muito obrigado! Qualquer dúvida é só responder por aqui.`
  );
}

function chargeMessage(ch: Charge, pixKey: string, reenvio: boolean): string {
  if (reenvio) return reminderMessage(ch);
  const venc = new Date(ch.dueDate + 'T00:00').toLocaleDateString('pt-BR');
  const base =
    `Olá! Aqui é a equipe da Origem.\n\n` +
    `Segue a cobrança de ${monthLabel(ch.month)} referente aos nossos serviços:\n` +
    `Valor: ${money(ch.amount)}\n` +
    `Vencimento: ${venc}\n`;
  if (ch.method === 'pix') {
    return base + (pixKey ? `\nChave Pix: ${pixKey}\n` : '') + `\nQualquer dúvida é só responder por aqui. Obrigado!`;
  }
  if (ch.method === 'boleto') {
    return base + `\nO boleto segue em instantes nesta conversa.\n\nQualquer dúvida é só responder por aqui. Obrigado!`;
  }
  return base + `\nA nota fiscal está sendo emitida e chega em seguida.\n\nQualquer dúvida é só responder por aqui. Obrigado!`;
}

/**
 * Envia (ou reenvia) a cobrança no WhatsApp pessoal de cobrança do cliente.
 * Método "nota fiscal" também dispara o pedido de emissão para o contador.
 */
export async function sendCharge(chargeId: string): Promise<void> {
  const store = useData.getState();
  const settings = useSettings.getState();
  const ch = store.charges.find((c) => c.id === chargeId);
  if (!ch) return;
  const client = store.clients.find((c) => c.id === ch.clientId);
  if (!client) return;

  const reenvio = ch.status === 'enviada';
  const message = chargeMessage(ch, settings.pixKey, reenvio);
  const payload = {
    tipo: 'cobranca',
    chargeId: ch.id,
    numero: client.billingWhatsapp || null,
    cliente: client.name,
    documento: client.document || null,
    valor: ch.amount,
    metodo: ch.method,
    vencimento: ch.dueDate,
    competencia: ch.month,
    chavePix: ch.method === 'pix' ? settings.pixKey || null : null,
    mensagem: message,
  };

  // Sem o número de cobrança do cliente não tem pra onde mandar — nem tenta,
  // pra não gastar a chamada do Conector com um erro óbvio.
  if (!client.billingWhatsapp) {
    store.addEvent({
      channel: 'whatsapp',
      title: `Não foi possível cobrar: ${client.name}`,
      status: 'erro',
      detail: 'Este cliente não tem WhatsApp de cobrança cadastrado. Preencha em Clientes ou pelo importador.',
    });
    return;
  }

  // Com o Conector, dá para ler a resposta e guardar o link da fatura que o
  // gateway emitiu. Um webhook comum é de mão única, então só dispara.
  // "enviouDeVerdade" controla se a cobrança pode ser marcada como enviada:
  // uma falha real (Conector fora do ar, erro do gateway) tem que deixar a
  // cobrança pendente, pra poder tentar de novo — nunca marcar como enviada
  // uma cobrança que não saiu.
  let enviouDeVerdade = false;
  if (settings.connectorUrl) {
    let ok = false;
    let detalhe = '';
    try {
      const res = await fetch(settings.connectorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      ok = Boolean(data?.ok);
      detalhe = data?.erro ?? '';
      if (ok && data.gatewayId) {
        store.updateCharge(chargeId, { gatewayId: data.gatewayId, gatewayUrl: data.gatewayUrl ?? undefined });
      }
    } catch (e) {
      detalhe = (e as Error).message;
    }
    enviouDeVerdade = ok;
    store.addEvent({
      channel: 'whatsapp',
      title: `Cobrança enviada: ${client.name} (${money(ch.amount)})`,
      status: ok ? 'ok' : 'erro',
      detail: ok
        ? `Enviada para ${client.billingWhatsapp} por ${METHOD_LABEL[ch.method]}.`
        : `Não foi enviada: ${detalhe || 'o Conector não respondeu — confira se ele está aberto no computador.'}`,
    });
  } else if (settings.whatsappWebhook) {
    const ok = await fireWebhook(settings.whatsappWebhook, payload);
    enviouDeVerdade = ok;
    store.addEvent({
      channel: 'whatsapp',
      title: `Cobrança enviada: ${client.name} (${money(ch.amount)})`,
      status: ok ? 'ok' : 'erro',
      detail: ok
        ? `Enviada para ${client.billingWhatsapp} por ${METHOD_LABEL[ch.method]}.`
        : 'Falha ao disparar o webhook do WhatsApp.',
    });
  } else {
    store.addEvent({
      channel: 'whatsapp',
      title: `(Simulado) Cobrança de ${client.name} (${money(ch.amount)})`,
      status: 'simulado',
      detail: `Conecte o Conector ou o webhook do WhatsApp nas Integrações para enviar de verdade. Mensagem pronta:\n\n${message}`,
    });
  }

  if (!enviouDeVerdade) return; // fica pendente — dá pra tentar de novo

  if (ch.method === 'nf') {
    const nfPayload = {
      tipo: 'nota_fiscal',
      numero: settings.contadorWhatsapp || null,
      cliente: client.name,
      valor: ch.amount,
      competencia: ch.month,
      mensagem:
        `Olá! Pode emitir a nota fiscal de ${monthLabel(ch.month)} para ${client.name}, ` +
        `no valor de ${money(ch.amount)}? Referente aos serviços de marketing da Origem. Obrigado!`,
    };
    if (settings.whatsappWebhook && settings.contadorWhatsapp) {
      const ok = await fireWebhook(settings.whatsappWebhook, nfPayload);
      store.addEvent({
        channel: 'whatsapp',
        title: `Nota fiscal pedida ao contador (${client.name})`,
        status: ok ? 'ok' : 'erro',
        detail: ok ? `Pedido enviado para ${settings.contadorWhatsapp}.` : 'Falha ao disparar o webhook.',
      });
    } else {
      store.addEvent({
        channel: 'whatsapp',
        title: `(Simulado) Pedido de nota fiscal ao contador (${client.name})`,
        status: 'simulado',
        detail: settings.contadorWhatsapp
          ? 'Conecte o webhook do WhatsApp para enviar de verdade.'
          : 'Cadastre o WhatsApp do contador nas Integrações.',
      });
    }
  }

  store.updateCharge(chargeId, { status: 'enviada', sentAt: Date.now() });
}

/** Envia as cobranças do mês corrente que já venceram (ou vencem hoje) e ainda não foram pagas. */
export async function sendAllPending(): Promise<number> {
  const store = useData.getState();
  const month = currentMonthKey();
  const hoje = todayISO();
  const pending = store.charges.filter((c) => c.month === month && c.status !== 'paga' && c.dueDate <= hoje);
  for (const ch of pending) await sendCharge(ch.id);
  return pending.length;
}

/**
 * Cobrança do dia, sem precisar abrir o Financeiro nem clicar em nada: gera
 * as cobranças do mês (se ainda não existirem) e manda quem venceu hoje ou
 * já passou do vencimento e ainda está pendente. Roda uma vez por dia — o
 * settingsStore guarda a última data em que rodou para não mandar de novo
 * a cada tela aberta.
 *
 * Só envia de verdade quando existe um canal de WhatsApp configurado
 * (Conector ou webhook). Sem isso, fica pendente à espera de um envio
 * manual — nunca marca como "enviada" uma cobrança que não saiu de fato.
 */
export async function autoSendDueCharges(): Promise<number> {
  const settings = useSettings.getState();
  if (!settings.autoBilling) return 0;

  const hoje = todayISO();
  if (settings.lastAutoBillingRun === hoje) return 0;
  settings.update({ lastAutoBillingRun: hoje });

  // Gerar as cobranças do mês não depende de canal de WhatsApp nenhum —
  // só o envio depende. Sem isso, elas nem apareciam no Financeiro.
  generateMonthlyCharges();
  if (!settings.connectorUrl && !settings.whatsappWebhook) return 0;

  const store = useData.getState();
  const vencidas = store.charges.filter((c) => c.status === 'pendente' && c.dueDate <= hoje);
  for (const ch of vencidas) await sendCharge(ch.id);
  return vencidas.length;
}

/**
 * Baixa manual: marca como paga e lança a receita no caixa.
 */
export function markChargePaid(chargeId: string): void {
  const store = useData.getState();
  const ch = store.charges.find((c) => c.id === chargeId);
  if (!ch || ch.status === 'paga') return;
  const client = store.clients.find((c) => c.id === ch.clientId);

  store.updateCharge(chargeId, { status: 'paga', paidAt: Date.now() });
  store.addTx({
    type: 'receita',
    description: `Fee mensal: ${client?.name ?? 'cliente'} (${monthLabel(ch.month)})`,
    amount: ch.amount,
    category: 'Contrato',
    clientId: ch.clientId,
    date: todayISO(),
    status: 'pago',
  });
  store.addEvent({
    channel: 'sistema',
    title: `Pagamento confirmado: ${client?.name ?? 'cliente'} (${money(ch.amount)})`,
    status: 'ok',
    detail: 'Receita lançada no caixa.',
  });
}
