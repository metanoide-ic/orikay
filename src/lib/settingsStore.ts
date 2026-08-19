import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  // --- IA (copy) ---
  aiMode: 'template' | 'api';
  aiEndpoint: string; // URL compatível com OpenAI /chat/completions
  aiKey: string;
  aiModel: string;
  brandVoice: string; // tom de voz da marca

  // --- Publicação (Instagram) ---
  publishWebhook: string;
  autoPublishOnApproval: boolean;

  // --- WhatsApp ---
  whatsappWebhook: string;
  whatsappGroup: string;
  sendOnApprovalStage: boolean;

  // --- Notificações ---
  notifyEnabled: boolean;

  /** Endereço do Conector Orikay, para recursos que precisam de resposta. */
  connectorUrl: string;

  // --- Cobrança ---
  /** Chave Pix da agência (vai na mensagem de cobrança). */
  pixKey: string;
  /** WhatsApp do contador, para pedidos de nota fiscal. */
  contadorWhatsapp: string;
  /** Gera as cobranças do mês automaticamente ao abrir o Financeiro. */
  autoBilling: boolean;
  /** Última data (AAAA-MM-DD) em que a cobrança automática do dia já rodou. */
  lastAutoBillingRun: string;

  // --- Ordem das colunas (o usuário pode arrastar pra reorganizar) ---
  /** Ordem das colunas de Posts. Vazio = usa a ordem padrão (STAGE_ORDER). */
  postStageOrder: string[];
  /** Ordem das colunas de Vídeos. Vazio = usa a ordem padrão (VIDEO_STAGE_ORDER). */
  videoStageOrder: string[];
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

const defaults: Settings = {
  // IA externa (OpenAI) é o padrão da plataforma — a chave em si não fica
  // aqui (código público!): ela mora no Conector e cada navegador puxa
  // sozinho na sincronização. Sem chave nenhuma, tudo continua funcionando
  // com o gerador local (template), como sempre.
  aiMode: 'api',
  aiEndpoint: 'https://api.openai.com/v1/chat/completions',
  aiKey: '',
  aiModel: 'gpt-4o',
  brandVoice:
    'Tom moderno, direto e confiante. Marketing com estratégia e resultado. Não use emojis.',
  publishWebhook: '',
  autoPublishOnApproval: true,
  whatsappWebhook: '',
  whatsappGroup: '',
  sendOnApprovalStage: true,
  notifyEnabled: false,
  connectorUrl: '',
  pixKey: '',
  contadorWhatsapp: '',
  autoBilling: true,
  lastAutoBillingRun: '',
  postStageOrder: [],
  videoStageOrder: [],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      update: (patch) => set(patch),
    }),
    {
      name: 'origem.settings',
      version: 1,
      // Navegadores que já existiam antes da OpenAI virar o padrão da
      // equipe ainda estavam nos padrões antigos do Groq (ou no modo
      // template) — atualiza pra OpenAI, preservando qualquer endpoint ou
      // modelo que a pessoa tenha trocado de propósito. Chave já colada
      // fica intacta.
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<Settings>;
        if (!s.aiEndpoint || s.aiEndpoint === 'https://api.groq.com/openai/v1/chat/completions') {
          s.aiEndpoint = defaults.aiEndpoint;
          if (!s.aiModel || s.aiModel === 'llama-3.3-70b-versatile') s.aiModel = defaults.aiModel;
        }
        s.aiMode = 'api';
        return s as SettingsState;
      },
    },
  ),
);
