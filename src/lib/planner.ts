import { useData } from './dataStore';
import type { Client, PostPlatform } from './types';

export interface Holiday {
  md: string; // 'MM-DD'
  name: string;
  universal?: boolean; // gera post extra para todos os clientes
}

/**
 * Aniversários das cidades da região, confirmados em fonte oficial.
 * O planejador aplica sozinho a quem tiver a cidade no cadastro: preencher a
 * cidade do cliente já traz o aniversário, sem cadastrar data à mão.
 */
export const ANIVERSARIO_CIDADE: Record<string, string> = {
  'Barra Mansa': '10-03',
  'Volta Redonda': '07-17',
  'Resende': '09-29',
  'Barra do Piraí': '03-10',
};

/** Datas comemorativas (Brasil). */
export const HOLIDAYS: Holiday[] = [
  { md: '01-01', name: 'Ano Novo', universal: true },
  { md: '03-08', name: 'Dia da Mulher', universal: true },
  { md: '03-15', name: 'Dia do Consumidor' },
  { md: '04-21', name: 'Tiradentes' },
  { md: '05-01', name: 'Dia do Trabalho' },
  { md: '05-11', name: 'Dia das Mães', universal: true },
  { md: '06-05', name: 'Dia do Meio Ambiente' },
  { md: '06-12', name: 'Dia dos Namorados', universal: true },
  { md: '06-24', name: 'São João' },
  { md: '07-20', name: 'Dia do Amigo' },
  { md: '08-11', name: 'Dia dos Pais', universal: true },
  { md: '09-07', name: 'Independência do Brasil' },
  { md: '09-15', name: 'Dia do Cliente', universal: true },
  { md: '10-12', name: 'Dia das Crianças', universal: true },
  { md: '10-15', name: 'Dia do Professor' },
  { md: '11-20', name: 'Consciência Negra' },
  { md: '11-27', name: 'Black Friday', universal: true },
  { md: '12-25', name: 'Natal', universal: true },
  { md: '12-31', name: 'Réveillon', universal: true },
];

export interface PlanItem {
  date: string; // ISO
  type: string; // Post, Carrossel, Stories, Vídeo, Reels, Foto
  title: string;
  holiday?: string;
  /** true quando o formato precisa de foto/vídeo real, não arte de estúdio. */
  isVideo: boolean;
  /** Instrução concreta do que fazer — foto pede material, vídeo vem com roteiro. */
  brief: string;
  /** Texto pra escrever na arte/capa — o que o designer coloca na peça, diferente da legenda. */
  arte: string;
  /** Legenda do post (Instagram etc.) já pronta pra publicar, ou o roteiro completo quando é vídeo. */
  caption: string;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isVideoType(type: string): boolean {
  return /víd|reels/i.test(type);
}

/**
 * Ângulos editoriais do gerador local — usado quando não há IA configurada,
 * ou como ponto de partida pra IA lapidar em cima do briefing real do
 * cliente. Pool grande de propósito: com a memória por cliente (nunca repete
 * antes de passar por todos), quanto maior o pool, mais tempo até repetir
 * de verdade um ângulo pro mesmo cliente.
 */
const ANGLES = {
  foto: [
    { titulo: 'Dica prática para o público', material: 'foto real do produto, ambiente ou equipe relacionada à dica', arte: 'A DICA QUE FAZ TODA DIFERENÇA', subheadline: 'Simples de aplicar, no seu dia a dia.' },
    { titulo: 'Prova social com resultado de cliente', material: 'foto do resultado entregue, ou print do depoimento do cliente', arte: 'MAIS UM RESULTADO CONFIRMADO', subheadline: 'Prova de que o trabalho bem feito aparece.' },
    { titulo: 'Mito e verdade do segmento', material: 'foto de produto ou ambiente que ilustre o tema (pode ser de estúdio)', arte: 'MITO OU VERDADE?', subheadline: 'Vamos separar o que é real do que não é.' },
    { titulo: 'Apresentação de produto ou serviço em destaque', material: 'foto real do produto/serviço em destaque, boa iluminação', arte: 'CONHEÇA DE PERTO', subheadline: 'O que a gente oferece, na prática.' },
    { titulo: 'Depoimento ou avaliação de cliente real', material: 'print do depoimento ou foto do cliente satisfeito (pedir autorização)', arte: 'QUEM JÁ PASSOU POR AQUI CONTA', subheadline: 'A opinião de quem viveu a experiência.' },
    { titulo: 'Oferta ou condição comercial do mês', material: 'foto do produto com destaque para o preço/condição', arte: 'CONDIÇÃO ESPECIAL DESSE MÊS', subheadline: 'Por tempo limitado, só aqui.' },
    { titulo: 'Erro comum que o público comete', material: 'foto de produto/ambiente que ilustre o erro ou a solução', arte: 'O ERRO QUE QUASE TODO MUNDO COMETE', subheadline: 'E como evitar isso a partir de hoje.' },
    { titulo: 'Comparativo: com vs. sem o produto/serviço', material: 'foto de antes/depois ou comparação lado a lado', arte: 'FAZ TODA A DIFERENÇA', subheadline: 'Veja lado a lado o antes e o depois.' },
    { titulo: 'Curiosidade do segmento', material: 'foto de apoio ao tema (pode ser de estúdio, sem precisar do cliente)', arte: 'VOCÊ SABIA?', subheadline: 'Uma curiosidade sobre o nosso segmento.' },
    { titulo: 'Pergunta pro público responder nos comentários', material: 'foto que ilustre a pergunta, engajamento direto', arte: 'E VOCÊ, JÁ PASSOU POR ISSO?', subheadline: 'Conta pra gente aqui nos comentários.' },
    { titulo: 'Numeros e resultados que o negócio já entregou', material: 'foto do ambiente/equipe, dado em destaque na arte', arte: 'NÚMEROS QUE FALAM POR SI', subheadline: 'O resultado que a gente já entregou.' },
    { titulo: 'Passo a passo de como funciona o serviço', material: 'foto do processo ou etapa específica do serviço', arte: 'COMO FUNCIONA, NA PRÁTICA', subheadline: 'Do primeiro passo até o resultado final.' },
    { titulo: 'Novidade ou lançamento', material: 'foto real do que é novo — produto, serviço ou espaço', arte: 'CHEGOU NOVIDADE', subheadline: 'Você vai querer conhecer isso de perto.' },
    { titulo: 'Convite pra visitar ou agendar', material: 'foto convidativa do ambiente/fachada/equipe pronta pra atender', arte: 'TE ESPERAMOS POR AQUI', subheadline: 'Vem conhecer de perto o que preparamos.' },
  ],
  video: [
    { titulo: 'Bastidores gravados no local', gancho: 'Abre mostrando algo inesperado do dia a dia do negócio', conteudo: 'Mostra o processo/trabalho acontecendo de verdade, sem roteiro engessado', cta: 'Convite pra visitar, marcar horário ou mandar mensagem', arte: 'BASTIDORES', subheadline: 'O que acontece por trás do resultado.' },
    { titulo: 'Antes e depois', gancho: 'Mostra o "antes", o problema real', conteudo: 'Corte pro "depois", o resultado alcançado', cta: 'Chamada pra quem tem o mesmo problema entrar em contato', arte: 'ANTES x DEPOIS', subheadline: 'A diferença que o resultado faz.' },
    { titulo: 'Tutorial rápido', gancho: 'Promessa direta: "em X segundos você aprende..."', conteudo: 'Passo a passo simples, linguagem acessível', cta: 'Pedir pra salvar o vídeo e seguir o perfil', arte: 'APRENDA RÁPIDO', subheadline: 'Direto ao ponto, sem enrolação.' },
    { titulo: 'Resposta a uma dúvida frequente', gancho: 'Repete a pergunta que os clientes mais fazem', conteudo: 'Resposta direta, sem enrolação, com exemplo real', cta: 'Convite pra mandar outras dúvidas nos comentários', arte: 'RESPONDENDO SUA DÚVIDA', subheadline: 'A pergunta que mais chega por aqui.' },
    { titulo: 'Tendência adaptada ao segmento', gancho: 'Usa o formato/áudio em alta do momento', conteudo: 'Adapta a tendência pro contexto do negócio, sem forçar', cta: 'CTA leve, foco em engajamento (comentar, compartilhar)', arte: 'ENTROU NA TENDÊNCIA', subheadline: 'Adaptado do nosso jeito.' },
    { titulo: 'Tour ou demonstração', gancho: 'Abre já mostrando o espaço ou o produto em uso', conteudo: 'Percorre os pontos fortes do local/produto', cta: 'Convite direto pra visitar ou comprar', arte: 'VEM CONHECER', subheadline: 'Um tour por dentro, de perto.' },
    { titulo: 'Dia a dia da equipe', gancho: 'Mostra a equipe trabalhando, sem cenário montado', conteudo: 'Passa confiança mostrando quem está por trás do negócio', cta: 'Reforça o convite pra conhecer quem vai atender', arte: 'QUEM FAZ ACONTECER', subheadline: 'A equipe por trás de cada entrega.' },
    { titulo: 'Reação a uma pergunta ou comentário real', gancho: 'Lê um comentário/pergunta real de cliente na tela', conteudo: 'Responde de forma direta, olhando pra câmera', cta: 'Convite pra deixar a próxima pergunta nos comentários', arte: 'RESPONDENDO DE VERDADE', subheadline: 'Sua pergunta, respondida na hora.' },
    { titulo: 'Um dia de trabalho resumido', gancho: 'Corte rápido mostrando o início do expediente', conteudo: 'Sequência de momentos do dia, ritmo ágil', cta: 'Convite pra acompanhar mais nos stories', arte: 'UM DIA POR AQUI', subheadline: 'Do começo ao fim do expediente.' },
    { titulo: 'Explicando um erro comum do segmento', gancho: 'Alerta direto: "isso pode estar te prejudicando"', conteudo: 'Explica o erro e como o negócio resolve isso', cta: 'Convite pra chamar no direct/WhatsApp', arte: 'CUIDADO COM ISSO', subheadline: 'Um erro comum que pode te prejudicar.' },
    { titulo: 'Resultado real de cliente contado em vídeo', gancho: 'Mostra o resultado final logo de cara', conteudo: 'Conta rapidamente como chegou lá', cta: 'Convite pra quem quer o mesmo resultado', arte: 'RESULTADO REAL', subheadline: 'Contado por quem viveu.' },
    { titulo: 'Bastidores de uma entrega/atendimento', gancho: 'Abre no meio da ação, sem introdução longa', conteudo: 'Acompanha a entrega/atendimento até o fim', cta: 'Convite pra agendar o próprio atendimento', arte: 'BASTIDORES DA ENTREGA', subheadline: 'Do pedido até a entrega final.' },
  ],
} as const;

type AnguloFoto = (typeof ANGLES.foto)[number];
type AnguloVideo = (typeof ANGLES.video)[number];

/** Tira o próximo ângulo pra esse cliente+formato, sem repetir nenhum antes de passar pelo pool inteiro (memória persistida). */
function pickAngle(clientId: string, type: string): AnguloFoto | AnguloVideo {
  const isVideo = isVideoType(type);
  const pool = isVideo ? ANGLES.video : ANGLES.foto;
  const idx = useData.getState().nextAngle(clientId, isVideo ? 'video' : 'foto', pool.length);
  return pool[idx] ?? pool[0];
}

function localTitle(type: string, angle: AnguloFoto | AnguloVideo, holiday?: string): string {
  if (holiday) return `${type} comemorativo: ${holiday}`;
  return `${type}: ${angle.titulo}`;
}

/** Instrução concreta do que fazer com o item — formato explícito, nunca vago. */
function localBrief(type: string, angle: AnguloFoto | AnguloVideo, holiday?: string): string {
  if (isVideoType(type)) {
    const a = angle as AnguloVideo;
    const tema = holiday ? `Vídeo sobre ${holiday}.` : '';
    return `Formato: vídeo. ${tema} Roteiro — Gancho: ${a.gancho}. Conteúdo: ${a.conteudo}. CTA: ${a.cta}.`;
  }
  const a = angle as AnguloFoto;
  const tema = holiday ? `Arte sobre ${holiday}.` : '';
  return `Formato: foto/arte estática. ${tema} Material necessário: ${a.material}.`;
}

/**
 * Texto pra escrever na arte/capa — headline + subheadline curta, o que o
 * designer bota na peça, diferente da legenda (que vai no texto do post).
 * Data comemorativa sempre tem prioridade sobre o ângulo, porque é o que o
 * público espera ver na peça. Sem IA configurada esse texto sai genérico
 * de propósito (não tem como inventar dado real do cliente) — a IA, quando
 * configurada, sobrescreve com algo específico pro briefing (ver ai.ts).
 */
function localArte(angle: AnguloFoto | AnguloVideo, holiday?: string): string {
  if (holiday) return `${holiday.toUpperCase()}\nUm dia especial pra celebrar com você.`;
  return `${angle.arte}\n${angle.subheadline}`;
}

const CTAS_LOCAIS = [
  'Comenta aqui embaixo que a gente te ajuda.',
  'Chama no direct e vamos conversar.',
  'Manda mensagem que a gente te explica tudo.',
  'Salva esse post pra não esquecer.',
  'Compartilha com quem precisa ver isso.',
];

/**
 * Legenda local (sem IA) — nunca genérica a ponto de servir pra qualquer
 * negócio: sempre nomeia o cliente e o ângulo específico do post. Não
 * substitui uma IA de verdade (não tem como "pesquisar" o cliente sozinha),
 * mas também não solta frase solta tipo "Você sabia?" sem contexto nenhum.
 */
function localCaption(type: string, angle: AnguloFoto | AnguloVideo, client: Client, holiday?: string): string {
  const seed = angle.titulo.length + client.name.length;
  const cta = CTAS_LOCAIS[seed % CTAS_LOCAIS.length];
  if (holiday) {
    return `Hoje é ${holiday}! A equipe da ${client.name} passa por aqui pra lembrar desse dia com você. ${cta}`;
  }
  if (isVideoType(type)) {
    const a = angle as AnguloVideo;
    return `[Roteiro completo]\n\nGANCHO: ${a.gancho}, falando da ${client.name}.\nCONTEÚDO: ${a.conteudo}\nCTA: ${a.cta}`;
  }
  const a = angle as AnguloFoto;
  return `${a.titulo} — direto aqui da ${client.name}.\n\n${client.briefing ? client.briefing.split('.')[0] + '.' : ''} ${cta}`.trim();
}

/**
 * Monta os slots do mês a partir da cadência semanal + datas comemorativas.
 * `fromDay` pula os dias antes dele (padrão 1 = mês inteiro) — pra gerar só
 * o que falta do mês corrente, por exemplo hoje até o fim do mês.
 */
export function buildClientSlots(client: Client, year: number, month: number, fromDay = 1): PlanItem[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Datas do calendário nacional mais as datas próprias do cliente
  // (aniversário de cada cidade onde ele atua, aniversário da loja, data do
  // setor). Um cliente regional pode ter várias.
  const proprias: Holiday[] = (client.localDates ?? []).map((d) => ({ md: d.md, name: d.name }));
  for (const cidade of client.cities ?? []) {
    const md = ANIVERSARIO_CIDADE[cidade];
    if (md && !proprias.some((x) => x.md === md)) {
      proprias.push({ md, name: `Aniversário de ${cidade}` });
    }
  }
  const monthHolidays = [...HOLIDAYS, ...proprias].filter(
    (h) => Number(h.md.slice(0, 2)) === month + 1,
  );
  const items: PlanItem[] = [];

  function montarItem(date: string, type: string, holiday?: string): PlanItem {
    const angle = pickAngle(client.id, type);
    return {
      date, type, title: localTitle(type, angle, holiday), holiday,
      isVideo: isVideoType(type),
      brief: localBrief(type, angle, holiday),
      arte: localArte(angle, holiday),
      caption: localCaption(type, angle, client, holiday),
    };
  }

  for (let d = fromDay; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const types = client.weeklyPlan?.[dow] ?? [];
    const hol = monthHolidays.find((h) => Number(h.md.slice(3)) === d);
    for (const type of types) {
      items.push(montarItem(iso(year, month, d), type, hol?.name));
    }
  }

  // Post extra nas datas universais e nas datas próprias do cliente, mesmo
  // que não haja cadência naquele dia.
  const proprioNoMes = new Set(proprias.map((p) => p.md));
  for (const h of monthHolidays.filter((x) => (x.universal || proprioNoMes.has(x.md)) && Number(x.md.slice(3)) >= fromDay)) {
    const date = iso(year, month, Number(h.md.slice(3)));
    if (!items.some((i) => i.date === date && i.holiday === h.name)) {
      items.push(montarItem(date, 'Post', h.name));
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function platformFor(type: string): PostPlatform {
  const t = type.toLowerCase();
  if (t.includes('tiktok')) return 'TikTok';
  if (t.includes('youtube')) return 'YouTube';
  return 'Instagram';
}

/** Prazo de produção: dois dias antes da publicação (nunca antes de hoje). */
function dueDateFor(publishDate: string): string {
  const d = new Date(publishDate + 'T00:00');
  d.setDate(d.getDate() - 2);
  const today = new Date().toISOString().slice(0, 10);
  const due = d.toISOString().slice(0, 10);
  return due < today ? today : due;
}

export interface ApplyResult {
  posts: number;
  videos: number;
}

function notasCompletas(item: PlanItem): string {
  let notas = item.brief;
  if (item.arte) notas += `\n\nTexto da arte: ${item.arte}`;
  if (item.holiday) notas += `\n\nData comemorativa: ${item.holiday}.`;
  return notas;
}

/**
 * Envia o plano para produção: cria os posts no pipeline (formatos de
 * foto/arte) e os projetos de vídeo (formatos de vídeo) — cada item vira
 * UMA coisa só, nunca as duas, pra não duplicar "Vídeo: X" tanto em Posts
 * quanto em Vídeos. Itens já existentes (mesmo título e data) são pulados,
 * então gerar de novo não duplica.
 */
export function applyPlanToWorkspace(client: Client, items: PlanItem[]): ApplyResult {
  const store = useData.getState();
  let posts = 0, videos = 0;

  // Verifica por cliente+data (contando quantos já existem naquele dia), não
  // por título: com a memória de ângulos o título muda a cada geração, então
  // checar só o título deixaria duplicar ao gerar de novo o mesmo mês. Conta
  // por dia (não só "existe algum") pra não quebrar dias com mais de um
  // formato agendado (ex.: Post e Reels no mesmo dia).
  const jaExistePost = new Map<string, number>();
  const jaExisteVideo = new Map<string, number>();
  for (const p of store.posts) if (p.clientId === client.id && p.scheduledDate) jaExistePost.set(p.scheduledDate, (jaExistePost.get(p.scheduledDate) ?? 0) + 1);
  for (const v of store.videos) if (v.clientId === client.id && v.dueDate) jaExisteVideo.set(v.dueDate, (jaExisteVideo.get(v.dueDate) ?? 0) + 1);
  const vistoPost = new Map<string, number>();
  const vistoVideo = new Map<string, number>();

  for (const item of items) {
    const due = dueDateFor(item.date);

    if (item.isVideo) {
      const ja = jaExisteVideo.get(due) ?? 0;
      const visto = vistoVideo.get(due) ?? 0;
      vistoVideo.set(due, visto + 1);
      if (visto < ja) continue; // esse "slot" do dia já tinha vídeo — não duplica
      store.addVideo({ title: item.title, clientId: client.id, dueDate: due, notes: `${notasCompletas(item)}\n\n${item.caption}` });
      videos++;
      continue;
    }

    const ja = jaExistePost.get(item.date) ?? 0;
    const visto = vistoPost.get(item.date) ?? 0;
    vistoPost.set(item.date, visto + 1);
    if (visto < ja) continue; // esse "slot" do dia já tinha post — não duplica
    store.addPost({
      title: item.title,
      platform: platformFor(item.type),
      clientId: client.id,
      stage: 'ideia',
      scheduledDate: item.date,
      notes: notasCompletas(item),
      // A copy já sai pronta do planejamento — não precisa esperar chegar
      // em Aprovação pra ter texto nenhum.
      copy: item.caption,
    });
    posts++;
  }

  store.addEvent({
    channel: 'sistema',
    title: `Planejamento de ${client.name} enviado para produção`,
    status: 'ok',
    detail: `${posts} posts e ${videos} vídeos criados com prazos e copy prontos.`,
  });

  return { posts, videos };
}
