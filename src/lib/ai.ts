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

/**
 * Melhora os temas do planejamento mensal com a IA configurada.
 * Recebe os slots (data + formato) e devolve um tema por slot, no mesmo
 * tamanho e ordem. Sem IA configurada (ou em erro), mantém os temas locais.
 */
export async function generatePlanIdeas(
  client: Client,
  slots: Array<{ date: string; type: string; holiday?: string; title: string }>,
): Promise<string[]> {
  const s = useSettings.getState();
  const fallback = slots.map((x) => x.title);
  if (s.aiMode !== 'api' || !s.aiKey || !s.aiEndpoint) return fallback;
  try {
    const listado = slots
      .map((x, i) => `${i + 1}. ${x.date} — formato: ${x.type}${x.holiday ? ` — data comemorativa: ${x.holiday}` : ''}`)
      .join('\n');
    const prompt =
      `Você planeja conteúdo de redes sociais para o cliente "${client.name}" da agência Origem.\n` +
      (client.briefing ? `Sobre o cliente: ${client.briefing}\n` : '') +
      (client.cities?.length ? `Cidades onde atende: ${client.cities.join(', ')}.\n` : '') +
      `Crie um tema curto e específico (até 12 palavras, sem emojis, sem aspas) para cada item:\n${listado}\n` +
      `Responda somente com uma lista numerada, um tema por linha, na mesma ordem.`;
    const res = await fetch(s.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.aiKey}` },
      body: JSON.stringify({
        model: s.aiModel,
        messages: [
          { role: 'system', content: 'Você é um estrategista de conteúdo sênior. Seja específico e direto.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const lines = text
      .split('\n')
      .map((l: string) => l.replace(/^\s*\d+[.)-]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length < slots.length) throw new Error('resposta incompleta');
    return slots.map((x, i) => `${x.type}: ${lines[i]}`);
  } catch {
    return fallback;
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
