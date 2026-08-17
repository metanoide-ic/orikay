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
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isVideoType(type: string): boolean {
  return /víd|reels/i.test(type);
}

/**
 * Ângulos editoriais do gerador local de temas. Cada um já vem com a
 * instrução do formato — foto pede o material real, vídeo vem com roteiro
 * de gancho/conteúdo/CTA — pra ninguém abrir o card sem saber o que fazer.
 */
const ANGLES = {
  foto: [
    { titulo: 'Dica prática para o público', material: 'foto real do produto, ambiente ou equipe relacionada à dica', arte: '[NÚMERO] DICA(S) PRA [RESULTADO QUE O PÚBLICO QUER]' },
    { titulo: 'Bastidores do trabalho', material: 'foto tirada no local, mostrando a equipe ou o processo em ação', arte: 'BASTIDORES: COMO A GENTE FAZ ACONTECER' },
    { titulo: 'Prova social com resultado de cliente', material: 'foto do resultado entregue, ou print do depoimento do cliente', arte: 'MAIS UM CLIENTE SATISFEITO' },
    { titulo: 'Mito e verdade do segmento', material: 'foto de produto ou ambiente que ilustre o tema (pode ser de estúdio)', arte: 'MITO OU VERDADE?' },
    { titulo: 'Apresentação de produto ou serviço', material: 'foto real do produto/serviço em destaque, boa iluminação', arte: '[NOME DO PRODUTO/SERVIÇO]' },
    { titulo: 'Conteúdo educativo sobre o segmento', material: 'foto de apoio ao tema (pode ser de estúdio, sem precisar do cliente)', arte: 'VOCÊ SABIA?' },
    { titulo: 'Depoimento ou avaliação', material: 'print do depoimento ou foto do cliente satisfeito (pedir autorização)', arte: '"[FRASE CURTA DO DEPOIMENTO]"' },
    { titulo: 'Oferta ou condição comercial', material: 'foto do produto com destaque para o preço/condição', arte: '[CONDIÇÃO/OFERTA] — POR TEMPO LIMITADO' },
  ],
  video: [
    { titulo: 'Bastidores gravados no local', gancho: 'Abre mostrando algo inesperado do dia a dia do negócio', conteudo: 'Mostra o processo/trabalho acontecendo de verdade, sem roteiro engessado', cta: 'Convite pra visitar, marcar horário ou mandar mensagem', arte: 'BASTIDORES' },
    { titulo: 'Antes e depois', gancho: 'Mostra o "antes", o problema real', conteudo: 'Corte pro "depois", o resultado alcançado', cta: 'Chamada pra quem tem o mesmo problema entrar em contato', arte: 'ANTES x DEPOIS' },
    { titulo: 'Tutorial rápido', gancho: 'Promessa direta: "em X segundos você aprende..."', conteudo: 'Passo a passo simples, linguagem acessível', cta: 'Pedir pra salvar o vídeo e seguir o perfil', arte: 'APRENDA EM SEGUNDOS' },
    { titulo: 'Resposta a uma dúvida frequente', gancho: 'Repete a pergunta que os clientes mais fazem', conteudo: 'Resposta direta, sem enrolação, com exemplo real', cta: 'Convite pra mandar outras dúvidas nos comentários', arte: 'RESPONDENDO SUA DÚVIDA' },
    { titulo: 'Tendência adaptada ao segmento', gancho: 'Usa o formato/áudio em alta do momento', conteudo: 'Adapta a tendência pro contexto do negócio, sem forçar', cta: 'CTA leve, foco em engajamento (comentar, compartilhar)', arte: '' },
    { titulo: 'Tour ou demonstração', gancho: 'Abre já mostrando o espaço ou o produto em uso', conteudo: 'Percorre os pontos fortes do local/produto', cta: 'Convite direto pra visitar ou comprar', arte: 'VEM CONHECER' },
  ],
} as const;

function anglePool(type: string) {
  return isVideoType(type) ? ANGLES.video : ANGLES.foto;
}

function localTitle(type: string, index: number, holiday?: string): string {
  if (holiday) return `${type} comemorativo: ${holiday}`;
  const angle = anglePool(type)[index % anglePool(type).length];
  return `${type}: ${angle.titulo}`;
}

/** Instrução concreta do que fazer com o item — formato explícito, nunca vago. */
function localBrief(type: string, index: number, holiday?: string): string {
  if (isVideoType(type)) {
    const a = ANGLES.video[index % ANGLES.video.length];
    const tema = holiday ? `Vídeo sobre ${holiday}.` : '';
    return `Formato: vídeo. ${tema} Roteiro — Gancho: ${a.gancho}. Conteúdo: ${a.conteudo}. CTA: ${a.cta}.`;
  }
  const a = ANGLES.foto[index % ANGLES.foto.length];
  const tema = holiday ? `Arte sobre ${holiday}.` : '';
  return `Formato: foto/arte estática. ${tema} Material necessário: ${a.material}.`;
}

/**
 * Texto pra escrever na arte/capa — o que o designer bota na peça, diferente
 * da legenda (que vai no texto do post). Data comemorativa sempre tem
 * prioridade sobre o ângulo, porque é o que o público espera ver na peça.
 */
function localArte(type: string, index: number, holiday?: string): string {
  if (holiday) return holiday.toUpperCase();
  const a = anglePool(type)[index % anglePool(type).length];
  return a.arte;
}

/** Monta os slots do mês a partir da cadência semanal + datas comemorativas. */
export function buildClientSlots(client: Client, year: number, month: number): PlanItem[] {
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
  let idx = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const types = client.weeklyPlan?.[dow] ?? [];
    const hol = monthHolidays.find((h) => Number(h.md.slice(3)) === d);
    for (const type of types) {
      const i = idx++;
      items.push({
        date: iso(year, month, d), type, title: localTitle(type, i, hol?.name), holiday: hol?.name,
        isVideo: isVideoType(type), brief: localBrief(type, i, hol?.name), arte: localArte(type, i, hol?.name),
      });
    }
  }

  // Post extra nas datas universais e nas datas próprias do cliente, mesmo
  // que não haja cadência naquele dia.
  const proprioNoMes = new Set(proprias.map((p) => p.md));
  for (const h of monthHolidays.filter((x) => x.universal || proprioNoMes.has(x.md))) {
    const date = iso(year, month, Number(h.md.slice(3)));
    if (!items.some((i) => i.date === date && i.holiday === h.name)) {
      const i = idx++;
      items.push({
        date, type: 'Post', title: localTitle('Post', i, h.name), holiday: h.name,
        isVideo: false, brief: localBrief('Post', i, h.name), arte: localArte('Post', i, h.name),
      });
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

/**
 * Envia o plano para produção: cria os posts no pipeline e os projetos de
 * vídeo. Itens já existentes (mesmo título e data) são pulados, então gerar
 * de novo não duplica.
 */
function notasCompletas(item: PlanItem): string {
  let notas = item.brief;
  if (item.arte) notas += `\n\nTexto da arte: ${item.arte}`;
  if (item.holiday) notas += `\n\nData comemorativa: ${item.holiday}.`;
  return notas;
}

export function applyPlanToWorkspace(client: Client, items: PlanItem[]): ApplyResult {
  const store = useData.getState();
  let posts = 0, videos = 0;

  for (const item of items) {
    const due = dueDateFor(item.date);
    const isVideo = item.isVideo;

    const postExists = store.posts.some(
      (p) => p.clientId === client.id && p.scheduledDate === item.date && p.title === item.title,
    );
    if (!postExists) {
      store.addPost({
        title: item.title,
        platform: platformFor(item.type),
        clientId: client.id,
        stage: 'ideia',
        scheduledDate: item.date,
        // Sem material de vídeo em mãos, o post já nasce marcado — a lista
        // mostra o selo "falta material" sem precisar abrir o card.
        awaitingMaterial: isVideo,
        notes: notasCompletas(item),
      });
      posts++;
    }

    if (isVideo) {
      const vidExists = store.videos.some((v) => v.clientId === client.id && v.title === item.title && v.dueDate === due);
      if (!vidExists) {
        store.addVideo({ title: item.title, clientId: client.id, dueDate: due, notes: notasCompletas(item) });
        videos++;
      }
    }
  }

  store.addEvent({
    channel: 'sistema',
    title: `Planejamento de ${client.name} enviado para produção`,
    status: 'ok',
    detail: `${posts} posts e ${videos} vídeos criados com prazos.`,
  });

  return { posts, videos };
}
