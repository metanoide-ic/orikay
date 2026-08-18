import type { Post, Client } from './types';
import { useSettings } from './settingsStore';

const HOOKS = [
  'Para sua marca,',
  'Chegou a hora:',
  'A real é a seguinte:',
  'Sabe o que separa quem cresce de quem estagna?',
  'Estratégia não é sorte.',
];

const CTAS = [
  'Comenta “EU QUERO” que a gente te chama.',
  'Chama no direct e vamos tirar do papel.',
  'Salva esse post pra não esquecer.',
  'Marca aquele sócio que precisa ver isso.',
  'Bora crescer junto? Fala com a gente.',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashados(platform?: string): string {
  const base = ['#marketing', '#estrategia', '#origem', '#resultado', '#conteudo'];
  if (platform === 'Instagram') base.push('#instagram', '#socialmedia');
  if (platform === 'TikTok') base.push('#tiktokbrasil', '#viral');
  if (platform === 'LinkedIn') base.push('#negocios', '#b2b');
  return base.slice(0, 6).join(' ');
}

/** Gerador local — grátis e ilimitado, sem rede. */
export function templateCopy(post: Post, client?: Client): string {
  const seed = post.title.length + (post.createdAt % 97);
  const marca = client?.name ? ` da ${client.name}` : '';
  const hook = pick(HOOKS, seed);
  const cta = pick(CTAS, seed + 3);
  const tema = post.title.replace(/[.:-].*$/, '').trim();

  return (
    `${hook} ${tema}${marca} é sobre transformar ideia em resultado.\n\n` +
    `Na Origem, a gente une estratégia, criatividade e execução pra sua marca ` +
    `aparecer do jeito certo, pra pessoa certa, na hora certa.\n\n` +
    `${cta}\n\n${hashados(post.platform)}`
  );
}

function buildPrompt(post: Post, client?: Client, brandVoice?: string): string {
  return (
    `Você é redator publicitário da agência Origem. Escreva a LEGENDA (copy) de um post.\n` +
    `Tom de voz da marca: ${brandVoice || 'moderno, direto e confiante'}.\n` +
    `Plataforma: ${post.platform}.\n` +
    `Cliente: ${client?.name || 'Origem'}.\n` +
    `Tema do post: ${post.title}.\n` +
    (post.notes ? `Observações: ${post.notes}.\n` : '') +
    `Regras: português do Brasil, gancho forte na 1ª linha, SEM emojis, ` +
    `chamada para ação no fim e 5 a 7 hashtags relevantes. Devolva apenas a legenda.`
  );
}

export interface PlanIdea {
  title: string;
  caption: string;
}

/**
 * Melhora o planejamento mensal com a IA configurada: gera tema E copy/roteiro
 * completo por slot, com base real no briefing do cliente — sem IA configurada
 * (ou em erro), devolve null e quem chamou usa o conteúdo local (template) já
 * pronto no próprio slot.
 */
export async function generatePlanIdeas(
  client: Client,
  slots: Array<{ date: string; type: string; holiday?: string; title: string; caption?: string; recentTitles?: string[] }>,
): Promise<PlanIdea[] | null> {
  const s = useSettings.getState();
  if (s.aiMode !== 'api' || !s.aiKey || !s.aiEndpoint) return null;
  try {
    const listado = slots
      .map((x, i) => `${i + 1}. ${x.date} — formato: ${x.type}${x.holiday ? ` — data comemorativa: ${x.holiday}` : ''}`)
      .join('\n');
    const evitar = slots
      .flatMap((x) => x.recentTitles ?? [])
      .filter((t, i, arr) => t && arr.indexOf(t) === i)
      .slice(0, 20);
    const prompt =
      `Você é redator e estrategista de conteúdo da agência Origem, planejando o mês do cliente "${client.name}".\n` +
      (client.briefing ? `Sobre o cliente (use só o que está aqui, não invente fatos novos sobre o negócio): ${client.briefing}\n` : '') +
      (client.cities?.length ? `Cidades onde atende: ${client.cities.join(', ')}.\n` : '') +
      (evitar.length ? `Já foram usados esses temas recentemente, NÃO repita o mesmo ângulo: ${evitar.join(' | ')}\n` : '') +
      `Regras importantes:\n` +
      `- Cada item tem que ter a ver de verdade com esse cliente específico, nada de tema genérico tipo "Você sabia?" sem ligação com o negócio.\n` +
      `- Não invente números, prêmios, depoimentos ou fatos que não estejam no briefing. Se faltar informação, escreva algo genérico mas honesto (sem fingir dado concreto).\n` +
      `- Para formato de vídeo, "legenda" é o ROTEIRO completo (gancho, conteúdo, CTA). Para foto/post, é a legenda pronta pra publicar.\n` +
      `- Sem emojis. Português do Brasil. CTA claro no fim.\n\n` +
      `Itens do mês:\n${listado}\n\n` +
      `Responda SOMENTE com um JSON array (sem markdown, sem texto fora do array), na mesma ordem e quantidade dos itens, cada elemento assim: {"titulo": "...", "legenda": "..."}`;
    const res = await fetch(s.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.aiKey}` },
      body: JSON.stringify({
        model: s.aiModel,
        messages: [
          { role: 'system', content: 'Você é um estrategista e redator de conteúdo sênior. Responde só com JSON válido quando pedido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('resposta sem JSON');
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ titulo?: string; legenda?: string }>;
    if (parsed.length < slots.length) throw new Error('resposta incompleta');
    return slots.map((x, i) => ({
      title: parsed[i]?.titulo?.trim() ? `${x.type}: ${parsed[i].titulo!.trim()}` : x.title,
      caption: parsed[i]?.legenda?.trim() || x.caption || '',
    }));
  } catch {
    return null;
  }
}

/**
 * Transforma uma instrução curta ("avisa que amanhã é feriado e não tem
 * postagem") numa mensagem de WhatsApp pronta pra mandar. Sem IA configurada,
 * devolve a própria instrução — o disparo funciona igual, só sem o texto
 * lapidado.
 */
export async function draftBroadcastMessage(instrucao: string): Promise<string> {
  const s = useSettings.getState();
  const texto = instrucao.trim();
  if (s.aiMode !== 'api' || !s.aiKey || !s.aiEndpoint) return texto;
  try {
    const res = await fetch(s.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.aiKey}` },
      body: JSON.stringify({
        model: s.aiModel,
        messages: [
          {
            role: 'system',
            content:
              'Você escreve mensagens curtas de WhatsApp para clientes de uma agência de marketing. ' +
              'Português do Brasil, tom educado e direto, sem emojis em excesso, sem assinatura. ' +
              'Devolva só o texto da mensagem, pronto pra copiar e colar.',
          },
          { role: 'user', content: `Escreva a mensagem a partir desta instrução: "${texto}"` },
        ],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const out: string | undefined = data?.choices?.[0]?.message?.content;
    return out?.trim() || texto;
  } catch {
    return texto;
  }
}

/**
 * Gera a copy do post. Usa a IA configurada (endpoint compatível com OpenAI)
 * quando disponível; caso contrário, usa o gerador local grátis.
 */
export async function generateCopy(post: Post, client?: Client): Promise<string> {
  const s = useSettings.getState();
  if (s.aiMode !== 'api' || !s.aiKey || !s.aiEndpoint) {
    return templateCopy(post, client);
  }
  try {
    const res = await fetch(s.aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.aiKey}`,
      },
      body: JSON.stringify({
        model: s.aiModel,
        messages: [
          { role: 'system', content: 'Você é um redator publicitário sênior.' },
          { role: 'user', content: buildPrompt(post, client, s.brandVoice) },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Resposta vazia da IA');
    return text.trim();
  } catch (e) {
    // Fallback garantido: nunca deixa o usuário sem copy.
    return templateCopy(post, client) + `\n\n— (gerado localmente; IA indisponível: ${(e as Error).message})`;
  }
}

/**
 * Ferramentas expostas pra IA no formato "function calling" compatível com
 * OpenAI. `parameters` é um JSON Schema simples (o suficiente pro modelo
 * saber o que preencher).
 */
export interface AiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

/**
 * Um passo da conversa com a IA Helper: manda o histórico + as ferramentas
 * disponíveis, devolve a resposta do modelo — que pode ser texto final ou um
 * pedido pra chamar uma ou mais ferramentas (`tool_calls`). Quem chama decide
 * o que fazer com cada chamada (a IA Helper executa e chama de novo em
 * loop; ferramentas sensíveis pausam pra confirmação antes de rodar).
 *
 * Precisa de uma chave de IA configurada com suporte a function calling
 * (Groq com Llama 3.3/3.1 funciona bem). Sem IA configurada, lança erro —
 * quem chama trata e avisa o usuário, já que aqui não existe fallback local
 * sensato pra "executar ações".
 */
export async function chatStep(messages: AiChatMessage[], tools: AiTool[]): Promise<AiChatMessage> {
  const s = useSettings.getState();
  if (s.aiMode !== 'api' || !s.aiKey || !s.aiEndpoint) {
    throw new Error('Configure uma chave de IA em Ajustes (com suporte a function calling) pra usar a IA Helper.');
  }
  const res = await fetch(s.aiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.aiKey}` },
    body: JSON.stringify({
      model: s.aiModel,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`IA respondeu ${res.status}: ${texto.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new Error('Resposta vazia da IA.');
  return { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls };
}
