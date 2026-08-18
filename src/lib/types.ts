export type ID = string;

export interface Account {
  id: ID;
  name: string;
  /** Identificador de login (nome de usuário). */
  login: string;
  email?: string;
  /** Hash simples — armazenamento local, sem servidor. */
  passHash: string;
  role: string;
  color: string;
  /** Permissão especial para ver o Financeiro. */
  canFinance: boolean;
  /** Pode gerenciar contas e permissões. */
  admin: boolean;
  /**
   * Senha provisória: o acesso fica travado até a pessoa definir a dela.
   * As senhas de fábrica passaram pelo histórico do Git, então não podem
   * continuar valendo depois do primeiro acesso.
   */
  mustChangePassword?: boolean;
  createdAt: number;
}

/** Cadência semanal: para cada dia da semana (0=Dom..6=Sáb), tipos de conteúdo. */
export type WeeklyPlan = Record<number, string[]>;

export interface Client {
  id: ID;
  name: string;
  color: string;
  contact?: string;
  monthlyFee?: number;
  /** Briefing do cliente — contexto para a IA gerar conteúdo. */
  briefing?: string;
  /**
   * Cidades onde o cliente atua. Um cliente regional atende várias, e cada
   * uma traz as próprias datas locais para o planejamento.
   */
  cities?: string[];
  /**
   * Datas próprias deste cliente: aniversário de cidade, aniversário da loja,
   * data do setor. Formato MM-DD. O planejamento cria post em cada uma.
   */
  localDates?: Array<{ md: string; name: string }>;
  /** Cadência semanal de entregas. */
  weeklyPlan?: WeeklyPlan;
  /** ID/nome do grupo de WhatsApp deste cliente. */
  whatsappGroup?: string;
  /** Perfil do Instagram do cliente (para publicação). */
  instagram?: string;
  /** WhatsApp pessoal do responsável pelo pagamento (cobrança). */
  billingWhatsapp?: string;
  /** Forma de cobrança combinada com o cliente. */
  billingMethod?: BillingMethod;
  /** Dia do mês do vencimento (1 a 28). */
  billingDay?: number;
  /** CPF ou CNPJ, exigido pelo gateway para emitir Pix e boleto. */
  document?: string;
  /** Até onde o cliente atende. Base da conferência de região no tráfego. */
  serviceArea?: ServiceArea;
  /** Raio de atendimento em km, quando a área é por raio. */
  serviceRadiusKm?: number;
  createdAt: number;
}

// -------------------------- Cobrança ----------------------------------
export type BillingMethod = 'pix' | 'boleto' | 'nf';
export type ChargeStatus = 'pendente' | 'enviada' | 'paga';

export interface Charge {
  id: ID;
  clientId: ID;
  /** Competência no formato YYYY-MM. */
  month: string;
  amount: number;
  method: BillingMethod;
  dueDate: string; // ISO
  status: ChargeStatus;
  sentAt?: number;
  paidAt?: number;
  /** Identificador da cobrança no gateway, quando emitida por ele. */
  gatewayId?: string;
  /** Link da fatura (Pix e boleto) gerado pelo gateway. */
  gatewayUrl?: string;
  createdAt: number;
}

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Card {
  id: ID;
  title: string;
  description?: string;
  labels: string[];
  priority?: Priority;
  dueDate?: string; // ISO date
  clientId?: ID;
  assigneeId?: ID;
  checklist: ChecklistItem[];
  createdAt: number;
  /** Link público da arte/vídeo pronto — usado pela coluna "Post Automático" para publicar. */
  mediaUrl?: string;
  /** Marca que o cartão está numa coluna de Alteração Automática, esperando resposta do grupo. */
  awaitingClientReply?: boolean;
}

/**
 * O que acontece sozinho quando um cartão entra na coluna:
 * - envio: manda o cartão pro grupo de WhatsApp do cliente certo.
 * - alteracao: manda pro grupo e, a partir daí, cada resposta do cliente
 *   vira um item novo no checklist do cartão (as alterações pedidas).
 * - post: publica automaticamente feed + story no Instagram do cliente.
 */
export type ColumnAutomation = 'nenhuma' | 'envio' | 'alteracao' | 'post';

export interface Column {
  id: ID;
  title: string;
  cardIds: ID[];
  automation?: ColumnAutomation;
}

/** Área do quadro: de qual função da equipe é a rotina de trabalho. */
export type BoardArea = 'designer' | 'filmmaker' | 'trafego' | 'outro';

export interface Board {
  id: ID;
  name: string;
  description?: string;
  clientId?: ID;
  area?: BoardArea;
  columns: Column[];
  cards: Record<ID, Card>;
  createdAt: number;
}

export type TxType = 'receita' | 'despesa';
export type TxStatus = 'pago' | 'pendente';

export interface Transaction {
  id: ID;
  type: TxType;
  description: string;
  amount: number;
  category: string;
  clientId?: ID;
  date: string; // ISO date
  status: TxStatus;
  createdAt: number;
}

export type PostPlatform =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'LinkedIn'
  | 'Facebook'
  | 'Blog';

export type PostStage =
  | 'ideia'
  | 'roteiro'
  | 'producao'
  | 'edicao'
  | 'aprovacao'
  | 'alteracao'
  | 'agendado'
  | 'publicado';

/** Pedido de alteração — empilhados separadamente. */
export interface Revision {
  id: ID;
  text: string;
  resolved: boolean;
  createdAt: number;
}

export interface Post {
  id: ID;
  title: string;
  platform: PostPlatform;
  clientId?: ID;
  stage: PostStage;
  scheduledDate?: string; // ISO date
  caption?: string;
  /** Copy gerada (IA ou template). */
  copy?: string;
  /** Responsável (id da conta). */
  assigneeId?: ID;
  notes?: string;
  /** Imagem/mídia de referência (data URL) — mantido por compatibilidade; a capa é mediaUrls[0] ?? mediaUrl. */
  mediaUrl?: string;
  /** Galeria de anexos (data URLs) — pode ter várias imagens, a primeira é a capa do cartão. */
  mediaUrls?: string[];
  checklist: ChecklistItem[];
  revisions: Revision[];
  /** true quando foi enviado ao grupo para aprovação. */
  sentForApproval?: boolean;
  /** true quando publicado automaticamente. */
  published?: boolean;
  /** true quando falta o cliente mandar foto/vídeo — trava a produção até chegar. */
  awaitingMaterial?: boolean;
  /** true quando arquivado — sai do quadro sem apagar (alternativa a excluir). */
  archived?: boolean;
  createdAt: number;
}

// -------------------------- Edição de vídeo ---------------------------
export type VideoStage =
  | 'briefing'
  | 'gravacao'
  | 'decupagem'
  | 'edicao'
  | 'revisao'
  | 'aprovacao'
  | 'alteracao'
  | 'entregue';

export interface VideoLink {
  id: ID;
  label: string;
  url: string;
}

export interface VideoProject {
  id: ID;
  title: string;
  clientId?: ID;
  stage: VideoStage;
  dueDate?: string;
  editor?: string;
  assigneeId?: ID;
  notes?: string;
  links: VideoLink[];
  checklist: ChecklistItem[];
  revisions: Revision[];
  /** Imagem/thumbnail de referência (data URL) — capa, print, frame de exemplo. Mantido por compatibilidade; a capa é mediaUrls[0] ?? mediaUrl. */
  mediaUrl?: string;
  /** Galeria de anexos (data URLs) — pode ter várias imagens, a primeira é a capa do cartão. */
  mediaUrls?: string[];
  /** true quando arquivado — sai do quadro sem apagar (alternativa a excluir). */
  archived?: boolean;
  createdAt: number;
}

// -------------------------- Biblioteca --------------------------------
export interface LibraryItem {
  id: ID;
  title: string;
  platform?: PostPlatform;
  category: string;
  caption: string;
  hashtags?: string;
  mediaUrl?: string;
  createdAt: number;
  /** Texto pra escrever na arte — o que vai na peça, diferente da legenda. */
  arte?: string;
  /** true quando o formato é vídeo (o "caption" vira o roteiro, não legenda de post). */
  isVideo?: boolean;
  /**
   * true quando veio do botão "Guardar" do planejamento — aparece na aba
   * Guardados em vez de Modelos. Modelo é feito à mão pra reutilizar
   * sempre; guardado é um item específico do planejamento que se quis
   * salvar pra usar depois.
   */
  guardado?: boolean;
}

// -------------------------- Automações --------------------------------
export type EventChannel = 'whatsapp' | 'instagram' | 'sistema' | 'ia';
export type EventStatus = 'ok' | 'simulado' | 'erro';

export interface AutomationEvent {
  id: ID;
  channel: EventChannel;
  title: string;
  detail?: string;
  status: EventStatus;
  postId?: ID;
  createdAt: number;
}

// -------------------------- Tráfego pago ------------------------------
export type AdPlatform = 'Meta' | 'Google' | 'TikTok';
export type CampaignStatus = 'planejada' | 'ativa' | 'pausada' | 'encerrada';
export type CampaignObjective =
  | 'Reconhecimento'
  | 'Tráfego'
  | 'Engajamento'
  | 'Mensagens'
  | 'Leads'
  | 'Vendas';

export interface CampaignMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  /** Conversões, leads ou mensagens, conforme o objetivo. */
  results: number;
  /** Média de vezes que a mesma pessoa viu o anúncio. Base da fadiga. */
  frequency?: number;
  /** Valor de conversão, quando a plataforma devolve (base do ROAS). */
  revenue?: number;
  updatedAt?: number;
}

/** Um dia de números, para enxergar tendência e ritmo de gasto. */
export interface CampaignDay {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  revenue?: number;
  frequency?: number;
}

/**
 * Etapa do funil. Muda o que é aceitável: em prospecção a mesma pessoa ver o
 * anúncio 3 vezes já cansa, em remarketing 5 ainda é normal.
 */
export type CampaignFunnel = 'topo' | 'meio' | 'fundo';

/**
 * Até onde o negócio atende de fato. É o que impede uma pizzaria de bairro
 * de ter o anúncio entregue para o Brasil inteiro.
 */
export type ServiceArea = 'raio' | 'cidade' | 'regiao' | 'estado' | 'nacional';

/** Segmentação geográfica lida da plataforma de anúncios. */
export interface GeoReal {
  paises: string[];
  estados: string[];
  cidades: Array<{ nome: string; raioKm?: number }>;
  /** Quando a plataforma não devolveu nada utilizável. */
  desconhecido?: boolean;
}

export interface Campaign {
  id: ID;
  clientId?: ID;
  name: string;
  platform: AdPlatform;
  objective: CampaignObjective;
  status: CampaignStatus;
  dailyBudget?: number;
  totalBudget?: number;
  startDate?: string;
  endDate?: string;
  /** ID da campanha na plataforma de anúncios, usado para sincronizar. */
  externalId?: string;
  notes?: string;
  metrics: CampaignMetrics;
  /** Etapa do funil, usada nos limites de frequência. */
  funnel?: CampaignFunnel;
  /** Quanto se aceita pagar por resultado. Base de quase todo diagnóstico. */
  targetCpa?: number;
  /** Retorno esperado sobre o investimento (só faz sentido em vendas). */
  targetRoas?: number;
  /** Endereço de destino do anúncio, para montar as UTMs. */
  landingUrl?: string;
  /** Alcance geográfico combinado para esta campanha. */
  geoMode?: ServiceArea;
  /** Cidades, estados ou ponto central, conforme o alcance. */
  geoPlaces?: string;
  /** Raio em km, quando o alcance é por raio. */
  geoRadiusKm?: number;
  /** O que a plataforma de anúncios está realmente segmentando. */
  geoReal?: GeoReal;
  /** Últimos dias de números, do mais antigo para o mais recente. */
  history?: CampaignDay[];
  /** Marca que o investimento já virou despesa no caixa. */
  postedToFinance?: boolean;
  createdAt: number;
}

export interface WorkspaceData {
  clients: Client[];
  boards: Board[];
  transactions: Transaction[];
  posts: Post[];
  videos: VideoProject[];
  library: LibraryItem[];
  events: AutomationEvent[];
  charges: Charge[];
  campaigns: Campaign[];
}
